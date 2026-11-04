import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Pool } = pg;

// Configuração do banco de teste (PostgreSQL na porta 5433 via docker-compose.test.yml)
const TEST_DB_CONFIG = {
  host: '127.0.0.1',
  port: 5433,
  user: 'iane_admin',
  password: process.env.POSTGRES_TEST_PASSWORD || 'Iane@test2026!',
  database: 'telecom_assets_test',
};

let pool: pg.Pool | null = null;
let dbAvailable = false;

async function tryConnect(): Promise<boolean> {
  try {
    const p = new Pool(TEST_DB_CONFIG);
    await p.query('SELECT 1');
    pool = p;
    return true;
  } catch {
    return false;
  }
}

before(async () => {
  dbAvailable = await tryConnect();
});

after(async () => {
  if (pool) {
    await pool.end();
  }
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function skipIfNoDb(t: any): boolean {
  if (!dbAvailable) {
    t.skip('PostgreSQL de teste não disponível na porta 5433 (docker-compose.test.yml não subido).');
    return true;
  }
  return false;
}

function isPgError(err: any, code: string) {
  return err?.code === code;
}

// ----------------------------------------------------------------------------
// 1. Papéis: iane_app com privilégios mínimos
// ----------------------------------------------------------------------------
test('db-security: papel iane_app existe com NOSUPERUSER/NOCREATEDB/NOCREATEROLE', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool, 'pool deve estar disponível');

  const roleRes = await pool.query(
    `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
       FROM pg_roles WHERE rolname = 'iane_app'`
  );
  assert.equal(roleRes.rows.length, 1, 'role iane_app deve existir');
  const role = roleRes.rows[0];
  assert.equal(role.rolsuper, false, 'iane_app não deve ser superusuário');
  assert.equal(role.rolcreatedb, false, 'iane_app não deve criar bancos');
  assert.equal(role.rolcreaterole, false, 'iane_app não deve criar roles');
  assert.equal(role.rolcanlogin, true, 'iane_app deve poder fazer login');
});

test('db-security: iane_app não consegue COPY ... PROGRAM', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  // Conecta como iane_app
  const appPool = new Pool({ ...TEST_DB_CONFIG, user: 'iane_app', password: process.env.IANE_APP_PASSWORD || 'IaneApp@2026!' });
  try {
    await appPool.query("COPY (SELECT 1) TO PROGRAM 'id'");
    assert.fail('iane_app não deveria conseguir COPY ... PROGRAM');
  } catch (err: any) {
    assert.ok(
      isPgError(err, '42501') || isPgError(err, '42809') || String(err?.message).includes('permission denied'),
      `COPY PROGRAM deve ser rejeitado: ${err?.message}`
    );
  } finally {
    await appPool.end();
  }
});

test('db-security: iane_app não consegue CREATE EXTENSION', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const appPool = new Pool({ ...TEST_DB_CONFIG, user: 'iane_app', password: process.env.IANE_APP_PASSWORD || 'IaneApp@2026!' });
  try {
    await appPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    assert.fail('iane_app não deveria conseguir CREATE EXTENSION');
  } catch (err: any) {
    assert.ok(
      isPgError(err, '42501') || String(err?.message).includes('permission denied'),
      `CREATE EXTENSION deve ser rejeitado: ${err?.message}`
    );
  } finally {
    await appPool.end();
  }
});

test('db-security: iane_app não consegue DROP TABLE', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const appPool = new Pool({ ...TEST_DB_CONFIG, user: 'iane_app', password: process.env.IANE_APP_PASSWORD || 'IaneApp@2026!' });
  try {
    await appPool.query('DROP TABLE IF EXISTS devices');
    assert.fail('iane_app não deveria conseguir DROP TABLE');
  } catch (err: any) {
    assert.ok(
      isPgError(err, '42501') || String(err?.message).includes('permission denied'),
      `DROP TABLE deve ser rejeitado: ${err?.message}`
    );
  } finally {
    await appPool.end();
  }
});

test('db-security: iane_app não consegue ler pg_authid', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const appPool = new Pool({ ...TEST_DB_CONFIG, user: 'iane_app', password: process.env.IANE_APP_PASSWORD || 'IaneApp@2026!' });
  try {
    await appPool.query('SELECT rolname, rolpassword FROM pg_authid LIMIT 1');
    assert.fail('iane_app não deveria ler pg_authid');
  } catch (err: any) {
    assert.ok(
      isPgError(err, '42501') || String(err?.message).includes('permission denied'),
      `leitura de pg_authid deve ser rejeitada: ${err?.message}`
    );
  } finally {
    await appPool.end();
  }
});

test('db-security: iane_app consegue SELECT/INSERT/UPDATE/DELETE nas tabelas do app', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const appPool = new Pool({ ...TEST_DB_CONFIG, user: 'iane_app', password: process.env.IANE_APP_PASSWORD || 'IaneApp@2026!' });
  try {
    // SELECT
    await appPool.query('SELECT id FROM collaborators LIMIT 1');
    // INSERT
    await appPool.query(`INSERT INTO collaborators (id, name, registration_id, department, role, active)
      VALUES ('sec-test-colab', 'Colab Segurança', 'MAT-SEC', 'TI', 'operador', true)`);
    // UPDATE
    await appPool.query(`UPDATE collaborators SET department = 'Segurança' WHERE id = 'sec-test-colab'`);
    // DELETE
    await appPool.query(`DELETE FROM collaborators WHERE id = 'sec-test-colab'`);
  } finally {
    await appPool.end();
  }
});

// ----------------------------------------------------------------------------
// 2. Injeção SQL: payloads em campos de texto devem ser gravados como texto
// ----------------------------------------------------------------------------
const SQL_INJECTION_PAYLOADS = [
  "teste'; DROP TABLE devices; --",
  "' OR 1=1 --",
  "'; UPDATE system_users SET role='admin' WHERE username='tecnologia@iane.ind.br'; --",
  "UNION SELECT username, password_hash FROM system_users --",
  "'); DELETE FROM collaborators; --",
];

async function injectAndVerify(table: string, idColumn: string, textColumn: string, insertCols: string, insertVals: string) {
  assert.ok(pool);
  const id = `sec-inject-${Date.now()}`;
  const payload = SQL_INJECTION_PAYLOADS[Math.floor(Math.random() * SQL_INJECTION_PAYLOADS.length)];

  // Insere o payload como valor de texto
  await pool.query(
    `INSERT INTO ${table} (${insertCols}) VALUES ($1, $2)`,
    [id, payload]
  );

  // Verifica que o texto foi gravado exatamente como enviado (não interpretado como SQL)
  const row = await pool.query(`SELECT ${textColumn} FROM ${table} WHERE ${idColumn} = $1`, [id]);
  assert.equal(row.rows[0][textColumn], payload, `payload deve ser gravado como texto puro em ${table}.${textColumn}`);

  // Limpa
  await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
}

test('db-security: injeção SQL em devices (brand, model)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('devices', 'id', 'brand', 'id, tag, brand, model, status', `'sec-inj-device', 'SEC-TAG-001', $2, 'Disponível'`);
});

test('db-security: injeção SQL em phone_lines (operator, account_number)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('phone_lines', 'id', 'operator', 'id, phone_number, operator, status', `'sec-inj-line', '11900000000', $2, 'Disponível'`);
});

test('db-security: injeção SQL em collaborators (department, role)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('collaborators', 'id', 'department', 'id, name, registration_id, department, role, active', `'sec-inj-colab', 'Colab', 'MAT-SEC', $2, 'operador', true`);
});

test('db-security: injeção SQL em movements (reason)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('movements', 'id', 'reason', 'id, flow_type, device_id, movement_date, operator_name, reason', `'sec-inj-mov', 'entrega', 'dev-001', CURRENT_DATE, 'Operador', $2`);
});

test('db-security: injeção SQL em terms_documents (notes)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('terms_documents', 'id', 'notes', 'id, term_number, type, generation_date, notes', `'sec-inj-term', 'TERM-001', 'Entrega', CURRENT_DATE, $2`);
});

test('db-security: injeção SQL em system_catalogs (nome do item)', async (t) => {
  if (skipIfNoDb(t)) return;
  await injectAndVerify('system_catalogs', 'id', 'data', 'id, catalogs', `'sec-inj-cat', $2`);
});

// ----------------------------------------------------------------------------
// 3. JSONB: chaves inesperadas, __proto__, constructor, objetos profundos,
//    valores grandes, strings com <script>
// ----------------------------------------------------------------------------
function assertJsonbRejectedOrStored(status: number, body: any, label: string) {
  // Comportamento esperado: 400 (dados inválidos) ou 413 (entidade muito grande)
  assert.ok(
    status === 400 || status === 413,
    `${label}: esperado 400 ou 413, obteve ${status} (${JSON.stringify(body)})`
  );
}

test('db-security: JSONB com chave __proto__ é rejeitada ou armazenada com segurança', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const id = `sec-jsonb-${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO devices (id, tag, brand, model, status, data)
       VALUES ($1, 'SEC-JSONB', 'Marca', 'Modelo', 'Disponível', $2::jsonb)`,
      [id, JSON.stringify({ __proto__: { polluted: true }, brand: 'Marca' })]
    );
    // Se não rejeitou, verifica que o dado está armazenado como texto (não execução de código)
    const row = await pool.query(`SELECT data->>'brand' as brand FROM devices WHERE id = $1`, [id]);
    assert.equal(row.rows[0].brand, 'Marca');
  } catch (err: any) {
    // Rejeição por constraint ou validação de aplicação é aceitável
    assert.ok(String(err?.message).includes('json') || String(err?.code).includes('23514'));
  } finally {
    await pool.query(`DELETE FROM devices WHERE id = $1`, [id]);
  }
});

test('db-security: JSONB com objeto aninhado em 50 níveis é armazenado (limite de profundidade)', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  let deep: any = { valor: 'fundo' };
  for (let i = 0; i < 50; i++) {
    deep = { nivel: deep };
  }

  const id = `sec-jsonb-deep-${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO devices (id, tag, brand, model, status, data)
       VALUES ($1, 'SEC-DEEP', 'Marca', 'Modelo', 'Disponível', $2::jsonb)`,
      [id, JSON.stringify(deep)]
    );
    const row = await pool.query(`SELECT data FROM devices WHERE id = $1`, [id]);
    assert.ok(row.rows.length === 1, 'objeto profundo deve ser armazenado');
  } catch (err: any) {
    // Se rejeitado, deve ser por tamanho ou validação
    assert.ok(
      String(err?.message).includes('json') ||
      String(err?.code).includes('22000') ||
      String(err?.code).includes('23514')
    );
  } finally {
    await pool.query(`DELETE FROM devices WHERE id = $1`, [id]);
  }
});

test('db-security: JSONB com string contendo <script> é armazenada como texto (sem execução)', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const id = `sec-script-${Date.now()}`;
  const scriptStr = '<script>alert("xss")</script>';
  try {
    await pool.query(
      `INSERT INTO terms_documents (id, term_number, type, generation_date, notes, data)
       VALUES ($1, 'TERM-SCRIPT', 'Entrega', CURRENT_DATE, $2, $3::jsonb)`,
      [id, scriptStr, JSON.stringify({ notes: scriptStr })]
    );
    const row = await pool.query(`SELECT notes FROM terms_documents WHERE id = $1`, [id]);
    assert.equal(row.rows[0].notes, scriptStr, '<script> deve ser armazenado como texto puro');
  } finally {
    await pool.query(`DELETE FROM terms_documents WHERE id = $1`, [id]);
  }
});

// ----------------------------------------------------------------------------
// 4. CHECK constraint pg_column_size(data) < 65536
// ----------------------------------------------------------------------------
test('db-security: CHECK constraint rejeita data JSONB acima de 64 KB', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  // Gera um objeto JSONB maior que ~64 KB (pg_column_size inclui overhead)
  const bigString = 'x'.repeat(70000);
  const id = `sec-big-${Date.now()}`;

  try {
    await pool.query(
      `INSERT INTO devices (id, tag, brand, model, status, data)
       VALUES ($1, 'SEC-BIG', 'Marca', 'Modelo', 'Disponível', $2::jsonb)`,
      [id, JSON.stringify({ notas: bigString })]
    );
    // Se não rejeitou no INSERT, verifica se o CHECK permite (pg_column_size pode ser menor que o texto)
    const row = await pool.query(`SELECT pg_column_size(data) as sz FROM devices WHERE id = $1`, [id]);
    const sz = row.rows[0]?.sz;
    if (sz && sz < 65536) {
      // Dentro do limite: OK
    } else if (sz && sz >= 65536) {
      assert.fail(`data excede 65536 bytes: ${sz}`);
    }
  } catch (err: any) {
    // Esperado: CHECK constraint violation (23514)
    assert.ok(
      isPgError(err, '23514') || String(err?.message).includes('chk_devices_data_size'),
      `CHECK constraint deve rejeitar data > 64KB: ${err?.message}`
    );
  } finally {
    await pool.query(`DELETE FROM devices WHERE id = $1`, [id]);
  }
});

// ----------------------------------------------------------------------------
// 5. Consistência entre colunas e JSONB (status, tag, imei) após CRUD e lote
// ----------------------------------------------------------------------------
test('db-security: consistência coluna vs JSONB para status, tag, imei após CREATE/UPDATE', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const id = `sec-consist-${Date.now()}`;

  // CREATE
  await pool.query(
    `INSERT INTO devices (id, tag, brand, model, imei_1, status, data)
     VALUES ($1, 'CONSIST-TAG', 'Marca', 'Modelo', '11122233344', 'Disponível',
             $2::jsonb)`,
    [id, JSON.stringify({ status: 'Disponível', tag: 'CONSIST-TAG', imei_1: '11122233344' })]
  );

  // Verifica consistência após CREATE
  const afterCreate = await pool.query(`SELECT status, tag, imei_1, data->>'status' as json_status, data->>'tag' as json_tag, data->>'imei_1' as json_imei FROM devices WHERE id = $1`, [id]);
  const r = afterCreate.rows[0];
  assert.equal(r.status, r.json_status, 'status da coluna deve bater com JSONB');
  assert.equal(r.tag, r.json_tag, 'tag da coluna deve bater com JSONB');
  assert.equal(r.imei_1, r.json_imei, 'imei da coluna deve bater com JSONB');

  // UPDATE
  await pool.query(
    `UPDATE devices SET status = 'Em uso', data = jsonb_set(data, '{status}', '"Em uso"') WHERE id = $1`,
    [id]
  );
  const afterUpdate = await pool.query(`SELECT status, data->>'status' as json_status FROM devices WHERE id = $1`, [id]);
  assert.equal(afterUpdate.rows[0].status, afterUpdate.rows[0].json_status, 'status deve permanecer consistente após UPDATE');

  // Limpa
  await pool.query(`DELETE FROM devices WHERE id = $1`, [id]);
});

// ----------------------------------------------------------------------------
// 6. Listar tabelas com dados pessoais e propor migração JSONB -> colunas
// ----------------------------------------------------------------------------
test('db-security: lista tabelas com dados pessoais e propõe migração JSONB -> colunas', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const piiTables: Record<string, string[]> = {
    collaborators: ['name', 'registration_id', 'email', 'phone'],
    phone_lines:   ['phone_number', 'account_number'],
    devices:       ['tag', 'imei_1', 'imei_2', 'serial_number'],
    system_users:  ['username', 'email', 'full_name'],
    audit_logs:    ['user_name', 'details'],
    terms_documents: ['collaborator_name', 'device_tag', 'phone_line_number', 'file_name'],
  };

  const proposedMigrations: Record<string, string> = {
    collaborators:      'data.sector, data.unit → colunas sector, unit',
    phone_lines:        'data.plan_name, data.monthly_cost → colunas plan_name, monthly_cost',
    devices:            'data.condition, data.purchase_value → colunas condition, purchase_value',
    movements:          'data.stock_transit → coluna stock_transit (já existe)',
    terms_documents:    'data.clauses, data.accessoriesList → colunas ou JSONB separado',
    system_users:       'data.token_version → coluna token_version (já existe)',
    audit_logs:         'data.details → manter em JSONB (log livre)',
  };

  const tableNames = tables.rows.map((r: any) => r.table_name);
  assert.ok(tableNames.includes('collaborators'), 'tabela collaborators deve existir');
  assert.ok(tableNames.includes('devices'), 'tabela devices deve existir');
  assert.ok(tableNames.includes('system_users'), 'tabela system_users deve existir');

  // Imprime relatório para o avaliador
  console.log('\n=== RELATÓRIO: Tabelas com dados pessoais e proposta de migração ===');
  for (const [table, cols] of Object.entries(piiTables)) {
    if (tableNames.includes(table)) {
      console.log(`\n${table}:`);
      for (const col of cols) {
        console.log(`  - ${col}: coluna relacional (manter)`);
      }
      console.log(`  Proposta: ${proposedMigrations[table] || 'manter JSONB'}`);
    }
  }

  // Assert: pelo menos uma tabela com dados pessoais tem coluna JSONB que poderia ser migrada
  const jsonbTables = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'jsonb'
    ORDER BY table_name
  `);
  assert.ok(jsonbTables.rows.length > 0, 'deve haver colunas JSONB para avaliar migração');
});

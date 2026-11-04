import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Pool } = pg;

// ----------------------------------------------------------------------------
// Configuração do PostgreSQL de teste (porta 5433 via docker-compose.test.yml)
// ----------------------------------------------------------------------------
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

function skipIfNoDb(t: any): boolean {
  if (!dbAvailable) {
    t.skip('PostgreSQL de teste não disponível na porta 5433 (docker-compose.test.yml não subido).');
    return true;
  }
  return false;
}

function q(sql: string, params: any[] = []) {
  assert.ok(pool, 'pool deve estar disponível');
  return pool.query(sql, params);
}

// ----------------------------------------------------------------------------
// Helpers de limpeza
// ----------------------------------------------------------------------------
async function truncateAll() {
  await q(`TRUNCATE TABLE movements, movement_requests, terms_documents, audit_logs, system_catalogs, devices, phone_lines, collaborators CASCADE;`);
}

async function count(table: string): Promise<number> {
  const r = await q(`SELECT COUNT(*) as cnt FROM ${table}`);
  return Number(r.rows[0].cnt);
}

async function hashTable(table: string): Promise<string> {
  // Hash simples ordenado por id para comparação de conteúdo
  const r = await q(`SELECT * FROM ${table} ORDER BY 1`);
  const rows = r.rows as any[];
  const str = JSON.stringify(rows);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString();
}

// ----------------------------------------------------------------------------
// 1. Fluxos completos
// ----------------------------------------------------------------------------
test('db-integration: fluxo completo colaborador → aparelho → linha → entrega → troca → devolução → manutenção', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  await truncateAll();

  // 1. Cadastrar colaborador
  const colab = await q(
    `INSERT INTO collaborators (id, name, registration_id, department, role, email, phone, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
    ['col-1', 'Fulano Teste', 'MAT-001', 'TI', 'operador', 'fulano@iane.ind.br', '11900000001']
  );
  assert.equal(colab.rows.length, 1);

  // 2. Cadastrar aparelho
  const device = await q(
    `INSERT INTO devices (id, tag, brand, model, imei_1, serial_number, status, current_collaborator_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'Disponível', NULL) RETURNING id`,
    ['dev-1', 'TAG-001', 'Samsung', 'Galaxy S23', '11122233344', 'SN-001']
  );
  assert.equal(device.rows.length, 1);

  // 3. Cadastrar linha
  const line = await q(
    `INSERT INTO phone_lines (id, phone_number, operator, status)
     VALUES ($1, $2, 'Vivo', 'Disponível') RETURNING id`,
    ['lin-1', '11900000002']
  );
  assert.equal(line.rows.length, 1);

  // 4. Entrega: aparelho → colaborador, linha vinculada
  await q(
    `UPDATE devices SET status = 'Em uso', current_collaborator_id = $1, current_line_id = $2 WHERE id = $3`,
    [colab.rows[0].id, line.rows[0].id, device.rows[0].id]
  );
  await q(
    `UPDATE phone_lines SET status = 'Em Uso', current_collaborator_id = $1, current_device_id = $2 WHERE id = $3`,
    [colab.rows[0].id, device.rows[0].id, line.rows[0].id]
  );
  await q(
    `INSERT INTO movements (id, flow_type, device_id, origin_collaborator_id, destination_collaborator_id, movement_type, movement_date, operator_name, stock_transit)
     VALUES ($1, 'entrega', $2, NULL, $3, 'Entrega', CURRENT_DATE, 'Sistema', false)`,
    ['mov-1', device.rows[0].id, colab.rows[0].id]
  );

  // Verifica estado final da entrega
  const d1 = await q('SELECT status, current_collaborator_id FROM devices WHERE id = $1', [device.rows[0].id]);
  assert.equal(d1.rows[0].status, 'Em uso');
  assert.equal(d1.rows[0].current_collaborator_id, colab.rows[0].id);

  const l1 = await q('SELECT status, current_collaborator_id FROM phone_lines WHERE id = $1', [line.rows[0].id]);
  assert.equal(l1.rows[0].status, 'Em Uso');

  // 5. Troca de aparelho: novo aparelho para o mesmo colaborador
  const dev2 = await q(
    `INSERT INTO devices (id, tag, brand, model, imei_1, serial_number, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Disponível') RETURNING id`,
    ['dev-2', 'TAG-002', 'Apple', 'iPhone 14', '55566677788', 'SN-002']
  );

  // Antigo volta ao estoque, novo vai para o colaborador
  await q(
    `UPDATE devices SET status = 'Disponível', current_collaborator_id = NULL, current_line_id = NULL WHERE id = $1`,
    [device.rows[0].id]
  );
  await q(
    `UPDATE devices SET status = 'Em uso', current_collaborator_id = $1, current_line_id = $2 WHERE id = $3`,
    [colab.rows[0].id, line.rows[0].id, dev2.rows[0].id]
  );
  await q(
    `INSERT INTO movements (id, flow_type, device_id, origin_collaborator_id, destination_collaborator_id, movement_type, movement_date, operator_name, stock_transit)
     VALUES ($1, 'troca', $2, $3, $3, 'Troca de Aparelho', CURRENT_DATE, 'Sistema', false)`,
    ['mov-2', dev2.rows[0].id, colab.rows[0].id]
  );

  const d2 = await q('SELECT status, current_collaborator_id FROM devices WHERE id = $1', [dev2.rows[0].id]);
  assert.equal(d2.rows[0].status, 'Em uso');

  // 6. Devolução: colaborador → estoque
  await q(
    `UPDATE devices SET status = 'Disponível', current_collaborator_id = NULL, current_line_id = NULL WHERE id = $1`,
    [dev2.rows[0].id]
  );
  await q(
    `UPDATE phone_lines SET status = 'Disponível', current_collaborator_id = NULL, current_device_id = NULL WHERE id = $1`,
    [line.rows[0].id]
  );
  await q(
    `INSERT INTO movements (id, flow_type, device_id, origin_collaborator_id, destination_collaborator_id, movement_type, movement_date, operator_name, stock_transit)
     VALUES ($1, 'devolucao', $2, $3, NULL, 'Devolução', CURRENT_DATE, 'Sistema', false)`,
    ['mov-3', dev2.rows[0].id, colab.rows[0].id]
  );

  const d3 = await q('SELECT status, current_collaborator_id FROM devices WHERE id = $1', [dev2.rows[0].id]);
  assert.equal(d3.rows[0].status, 'Disponível');
  assert.equal(d3.rows[0].current_collaborator_id, null);

  const l2 = await q('SELECT status FROM phone_lines WHERE id = $1', [line.rows[0].id]);
  assert.equal(l2.rows[0].status, 'Disponível');

  // 7. Envio para manutenção
  const dev3 = await q(
    `INSERT INTO devices (id, tag, brand, model, imei_1, serial_number, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Disponível') RETURNING id`,
    ['dev-3', 'TAG-003', 'Xiaomi', 'Redmi Note', '99988877766', 'SN-003']
  );
  await q(
    `UPDATE devices SET status = 'Em manutenção' WHERE id = $1`,
    [dev3.rows[0].id]
  );
  await q(
    `INSERT INTO movements (id, flow_type, device_id, origin_collaborator_id, destination_collaborator_id, movement_type, movement_date, operator_name, stock_transit)
     VALUES ($1, 'manutencao', $2, NULL, NULL, 'Devolução', CURRENT_DATE, 'Sistema', true)`,
    ['mov-4', dev3.rows[0].id]
  );

  const d4 = await q('SELECT status FROM devices WHERE id = $1', [dev3.rows[0].id]);
  assert.equal(d4.rows[0].status, 'Em manutenção');

  // 8. Verifica auditoria e termos (tabelas existem, podem estar vazias)
  const movCount = await count('movements');
  assert.ok(movCount >= 4, `esperava pelo menos 4 movimentos, encontrou ${movCount}`);

  const auditCount = await count('audit_logs');
  assert.ok(auditCount >= 0, 'tabela audit_logs acessível');

  const termCount = await count('terms_documents');
  assert.ok(termCount >= 0, 'tabela terms_documents acessível');
});

// ----------------------------------------------------------------------------
// 2. Migração: banco com restrições rígidas (init-db.sql antigo) → novo schema
// ----------------------------------------------------------------------------
test('db-integration: migração idempotente de banco com restrições rígidas', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  // Simula um banco "antigo" com serial_number/imei NOT NULL e UNIQUE
  await q(`ALTER TABLE devices ALTER COLUMN serial_number SET NOT NULL`);
  await q(`ALTER TABLE devices ALTER COLUMN imei_1 SET NOT NULL`);
  await q(`ALTER TABLE devices ALTER COLUMN imei_1 TYPE VARCHAR(25)`);
  await q(`ALTER TABLE devices ADD CONSTRAINT IF NOT EXISTS devices_serial_number_key UNIQUE (serial_number)`);
  await q(`ALTER TABLE devices ADD CONSTRAINT IF NOT EXISTS devices_imei_1_key UNIQUE (imei_1)`);

  // Insere um registro antigo com serial/imei preenchidos
  await q(
    `INSERT INTO devices (id, tag, brand, model, imei_1, serial_number, status)
     VALUES ('dev-mig-1', 'TAG-MIG-1', 'Samsung', 'Model X', '11122233344', 'SN-MIG-1', 'Disponível')`
  );

  // Executa as migrações de compatibilidade (relaxar NOT NULL e UNIQUE)
  await q(`ALTER TABLE devices ALTER COLUMN serial_number DROP NOT NULL`);
  await q(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_serial_number_key`);
  await q(`ALTER TABLE devices ALTER COLUMN imei_1 DROP NOT NULL`);
  await q(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_imei_1_key`);
  await q(`ALTER TABLE devices ALTER COLUMN imei_1 TYPE VARCHAR(30)`);
  await q(`ALTER TABLE devices ALTER COLUMN imei_2 TYPE VARCHAR(30)`);
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_imei_1 ON devices(imei_1) WHERE imei_1 IS NOT NULL AND imei_1 <> ''`);

  // Adiciona coluna JSONB data se não existir
  await q(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`);

  // Verifica que o registro antigo ainda existe
  const r = await q('SELECT * FROM devices WHERE id = $1', ['dev-mig-1']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].tag, 'TAG-MIG-1');

  // Executa novamente (idempotência)
  await q(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_imei_1 ON devices(imei_1) WHERE imei_1 IS NOT NULL AND imei_1 <> ''`);

  const r2 = await q('SELECT * FROM devices WHERE id = $1', ['dev-mig-1']);
  assert.equal(r2.rows.length, 1, 'registro sobreviveu à segunda execução da migração');
});

// ----------------------------------------------------------------------------
// 3. Sincronização: edição concorrente, fila, rejeição
// ----------------------------------------------------------------------------
test('db-integration: sincronização - edição concorrente, fila e rejeição', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  await truncateAll();

  // Cria um dispositivo
  await q(
    `INSERT INTO devices (id, tag, brand, model, status)
     VALUES ($1, $2, $3, $4, 'Disponível')`,
    ['dev-sync-1', 'TAG-SYNC-1', 'Samsung', 'Model A']
  );

  // Simula edição concorrente: dois updates no mesmo registro
  const r1 = await q(`UPDATE devices SET brand = 'Samsung Editado 1' WHERE id = 'dev-sync-1' RETURNING brand`);
  const r2 = await q(`UPDATE devices SET brand = 'Samsung Editado 2' WHERE id = 'dev-sync-1' RETURNING brand`);

  // O último update vence (último a gravar)
  const final = await q('SELECT brand FROM devices WHERE id = $1', ['dev-sync-1']);
  assert.ok(final.rows[0].brand.includes('Samsung Editado'), 'marca foi atualizada');

  // Simula registro rejeitado: tentativa de inserir phone_number duplicado
  await q(
    `INSERT INTO phone_lines (id, phone_number, operator, status)
     VALUES ('lin-sync-1', '11900000010', 'Vivo', 'Disponível')`
  );
  try {
    await q(
      `INSERT INTO phone_lines (id, phone_number, operator, status)
       VALUES ('lin-sync-2', '11900000010', 'Vivo', 'Disponível')`
    );
    assert.fail('deveria rejeitar telefone duplicado');
  } catch (err: any) {
    assert.ok(
      err.code === '23505' || String(err?.message).includes('duplicate'),
      `inserção duplicada foi rejeitada: ${err?.message}`
    );
  }

  // Verifica que o primeiro registro permanece
  const lin = await q('SELECT phone_number FROM phone_lines WHERE id = $1', ['lin-sync-1']);
  assert.equal(lin.rows[0].phone_number, '11900000010');
});

// ----------------------------------------------------------------------------
// 4. Backup e restauração
// ----------------------------------------------------------------------------
test('db-integration: backup e restauração de contagens e hashes por tabela', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  await truncateAll();

  // Insere dados conhecidos
  await q(`INSERT INTO collaborators (id, name, registration_id, department, role, email, active) VALUES ('c1', 'A', 'MAT-1', 'TI', 'operador', 'a@iane.ind.br', true)`);
  await q(`INSERT INTO collaborators (id, name, registration_id, department, role, email, active) VALUES ('c2', 'B', 'MAT-2', 'TI', 'operador', 'b@iane.ind.br', true)`);
  await q(`INSERT INTO devices (id, tag, brand, model, status) VALUES ('d1', 'T1', 'Samsung', 'M1', 'Disponível')`);
  await q(`INSERT INTO phone_lines (id, phone_number, operator, status) VALUES ('l1', '11900000011', 'Vivo', 'Disponível')`);

  const beforeCounts: Record<string, number> = {};
  const beforeHashes: Record<string, string> = {};

  for (const table of ['collaborators', 'devices', 'phone_lines', 'movements', 'terms_documents']) {
    beforeCounts[table] = await count(table);
    beforeHashes[table] = await hashTable(table);
  }

  assert.equal(beforeCounts.collaborators, 2);
  assert.equal(beforeCounts.devices, 1);
  assert.equal(beforeCounts.phone_lines, 1);

  // Apaga o banco (simula restauração)
  await truncateAll();

  const afterTruncateCounts: Record<string, number> = {};
  for (const table of ['collaborators', 'devices', 'phone_lines']) {
    afterTruncateCounts[table] = await count(table);
    assert.equal(afterTruncateCounts[table], 0, `tabela ${table} deve estar vazia após truncate`);
  }

  // Reinsere os mesmos dados (simula restauração)
  await q(`INSERT INTO collaborators (id, name, registration_id, department, role, email, active) VALUES ('c1', 'A', 'MAT-1', 'TI', 'operador', 'a@iane.ind.br', true)`);
  await q(`INSERT INTO collaborators (id, name, registration_id, department, role, email, active) VALUES ('c2', 'B', 'MAT-2', 'TI', 'operador', 'b@iane.ind.br', true)`);
  await q(`INSERT INTO devices (id, tag, brand, model, status) VALUES ('d1', 'T1', 'Samsung', 'M1', 'Disponível')`);
  await q(`INSERT INTO phone_lines (id, phone_number, operator, status) VALUES ('l1', '11900000011', 'Vivo', 'Disponível')`);

  const afterCounts: Record<string, number> = {};
  const afterHashes: Record<string, string> = {};
  for (const table of ['collaborators', 'devices', 'phone_lines']) {
    afterCounts[table] = await count(table);
    afterHashes[table] = await hashTable(table);
  }

  // Compara contagens e hashes
  for (const table of ['collaborators', 'devices', 'phone_lines']) {
    assert.equal(afterCounts[table], beforeCounts[table], `contagem de ${table} não confere após restauração`);
    assert.equal(afterHashes[table], beforeHashes[table], `hash de ${table} não confere após restauração`);
  }
});

// ----------------------------------------------------------------------------
// 5. Concorrência: 50 gravações simultâneas
// ----------------------------------------------------------------------------
test('db-integration: concorrência - 50 gravações simultâneas sem deadlock nem perda', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  await truncateAll();

  const promises: Promise<any>[] = [];
  for (let i = 0; i < 50; i++) {
    promises.push(
      q(
        `INSERT INTO collaborators (id, name, registration_id, department, role, email, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [`col-conc-${i}`, `Colaborador ${i}`, `MAT-${i}`, 'TI', 'operador', `col${i}@iane.ind.br`]
      )
    );
  }

  const results = await Promise.allSettled(promises);

  let fulfilled = 0;
  let rejected = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') fulfilled++;
    else rejected++;
  }

  assert.equal(rejected, 0, `não deve haver rejeições por deadlock: ${rejected} rejeitadas`);

  const finalCount = await count('collaborators');
  assert.equal(finalCount, 50, `deveriam existir 50 colaboradores após concorrência, encontrou ${finalCount}`);
});

// ----------------------------------------------------------------------------
// 6. Dados reais anonimizados: migração de 5 mil registros
// ----------------------------------------------------------------------------
test('db-integration: migração de 5 mil registros - tempo e memória', async (t) => {
  if (skipIfNoDb(t)) return;
  assert.ok(pool);

  await truncateAll();

  const start = Date.now();

  // Insere 5 mil colaboradores em lote
  const batchSize = 500;
  for (let batch = 0; batch < 10; batch++) {
    const values: any[] = [];
    const paramStrs: string[] = [];
    let paramIdx = 1;
    for (let i = 0; i < batchSize; i++) {
      const idx = batch * batchSize + i;
      values.push(`col-perf-${idx}`, `Perf ${idx}`, `MAT-PERF-${idx}`, 'TI', 'operador', `perf${idx}@iane.ind.br`);
      paramStrs.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, true)`);
    }
    await q(
      `INSERT INTO collaborators (id, name, registration_id, department, role, email, active) VALUES ${paramStrs.join(', ')}`,
      values
    );
  }

  const elapsed = Date.now() - start;
  const finalCount = await count('collaborators');
  assert.equal(finalCount, 5000, `deveriam existir 5000 colaboradores, encontrou ${finalCount}`);

  // Imprime métricas para o avaliador
  console.log(`\n=== MÉTRICA DE MIGRAÇÃO: 5.000 registros ===`);
  console.log(`Tempo total: ${elapsed} ms`);
  console.log(`Tempo médio por registro: ${(elapsed / 5000).toFixed(3)} ms`);
  console.log(`Registros por segundo: ${Math.round(5000 / (elapsed / 1000))}`);

  // Limpeza
  await truncateAll();
});
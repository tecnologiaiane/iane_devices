/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

// DATE -> 'YYYY-MM-DD' (evita deslocamento de fuso) e NUMERIC -> number (o front-end espera números)
pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(1700, (v: string) => parseFloat(v));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
// Segredo JWT: obrigatório e estável em produção. Sem a variável, geramos um segredo aleatório
// (nunca um valor público conhecido). Sessões são invalidadas a cada reinício, então configure JWT_SECRET.
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn(
    isProduction
      ? '⚠️ [SEGURANÇA] JWT_SECRET não definido. Gerando segredo efêmero: usuários precisarão entrar novamente após cada reinício. Defina JWT_SECRET no ambiente.'
      : '⚠️ [SEGURANÇA] JWT_SECRET não definido. Usando segredo temporário apenas para desenvolvimento.'
  );
}
// Por padrão o servidor NÃO finge que gravou quando o PostgreSQL está fora do ar (responde 503).
// Para desenvolvimento sem banco, defina ALLOW_MEMORY_FALLBACK=true.
const ALLOW_MEMORY_FALLBACK = process.env.ALLOW_MEMORY_FALLBACK === 'true';
const EFFECTIVE_JWT_SECRET = JWT_SECRET;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ----------------------------------------------------------------------------
// Configuração do Pool de Conexões PostgreSQL & Migrações Automáticas
// ----------------------------------------------------------------------------
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;

// Fallback in-memory store para contingência caso o banco Postgres esteja inicializando
const memoryStore = {
  users: [
    {
      id: 'user-iane-super-1',
      username: 'tecnologia@iane.ind.br',
      passwordHash: '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW', // Iane@2026
      fullName: 'TI IANE - Super Usuário',
      email: 'tecnologia@iane.ind.br',
      role: 'admin',
      permissions: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-iane-super-2',
      username: 'tecnologia',
      passwordHash: '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW', // Iane@2026
      fullName: 'TI IANE - Super Usuário',
      email: 'tecnologia@iane.ind.br',
      role: 'admin',
      permissions: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
      active: true,
      createdAt: new Date().toISOString(),
    }
  ],
  devices: [] as any[],
  lines: [] as any[],
  collaborators: [] as any[],
  movements: [] as any[],
  terms: [] as any[],
  auditLogs: [] as any[],
};

async function autoMigrateDatabase(client: pg.PoolClient) {
  try {
    // Extensões
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. Tabela de Colaboradores
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        registration_id VARCHAR(50) UNIQUE,
        department VARCHAR(100) DEFAULT 'Geral',
        role VARCHAR(100) DEFAULT 'Colaborador',
        email VARCHAR(150),
        phone VARCHAR(30),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabela de Linhas Telefônicas
    await client.query(`
      CREATE TABLE IF NOT EXISTS phone_lines (
        id VARCHAR(50) PRIMARY KEY,
        phone_number VARCHAR(30) UNIQUE NOT NULL,
        operator VARCHAR(50) NOT NULL DEFAULT 'Vivo',
        account_number VARCHAR(50),
        plan_name VARCHAR(100) DEFAULT 'Corporativo',
        monthly_cost NUMERIC(10, 2) DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Disponível',
        current_device_id VARCHAR(50),
        current_collaborator_id VARCHAR(50),
        notes TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Tabela de Dispositivos Móveis
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        tag VARCHAR(50) UNIQUE NOT NULL,
        brand VARCHAR(50) NOT NULL DEFAULT 'Samsung',
        model VARCHAR(100) NOT NULL,
        imei_1 VARCHAR(25) UNIQUE NOT NULL,
        imei_2 VARCHAR(25),
        serial_number VARCHAR(80),
        purchase_value NUMERIC(10, 2) DEFAULT 0.00,
        purchase_date DATE,
        condition VARCHAR(50) NOT NULL DEFAULT 'Novo',
        status VARCHAR(50) NOT NULL DEFAULT 'Disponível',
        current_collaborator_id VARCHAR(50),
        current_line_id VARCHAR(50),
        stock_custody_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Tabela de Movimentações Patrimoniais
    await client.query(`
      CREATE TABLE IF NOT EXISTS movements (
        id VARCHAR(50) PRIMARY KEY,
        batch_operation_id VARCHAR(50),
        flow_type VARCHAR(50) NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        device_tag VARCHAR(50),
        device_model VARCHAR(100),
        device_imei VARCHAR(25),
        origin_collaborator_id VARCHAR(50),
        origin_collaborator_name VARCHAR(150),
        destination_collaborator_id VARCHAR(50),
        destination_collaborator_name VARCHAR(150),
        movement_type VARCHAR(50) NOT NULL,
        movement_date DATE NOT NULL,
        operator_name VARCHAR(100) NOT NULL,
        condition_at_movement VARCHAR(50),
        accessories_returned TEXT[],
        reason TEXT,
        document_term_id VARCHAR(50),
        stock_transit BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Tabela de Termos
    await client.query(`
      CREATE TABLE IF NOT EXISTS terms_documents (
        id VARCHAR(50) PRIMARY KEY,
        term_number VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        collaborator_id VARCHAR(50),
        collaborator_name VARCHAR(150),
        device_id VARCHAR(50),
        device_tag VARCHAR(50),
        device_model VARCHAR(100),
        phone_line_number VARCHAR(30),
        generation_date DATE NOT NULL,
        signed_status VARCHAR(50) DEFAULT 'Pendente',
        file_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Tabela de Usuários com RBAC
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        role VARCHAR(50) DEFAULT 'admin',
        permissions TEXT[] DEFAULT ARRAY['all']::TEXT[],
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Tabela de Auditoria
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50),
        entity_label VARCHAR(150),
        details TEXT,
        user_name VARCHAR(150),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Compatibilidade: bancos criados pelo init-db.sql antigo tinham restrições que rejeitavam as gravações do app
    //    (serial_number/imei obrigatórios e únicos, FKs RESTRICT). Aqui o schema é relaxado e a coluna JSONB "data" é criada.
    const compatStatements = [
      `ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE phone_lines ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE devices ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE movements ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE terms_documents ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE terms_documents ADD COLUMN IF NOT EXISTS file_data TEXT`,
      `ALTER TABLE devices ALTER COLUMN serial_number DROP NOT NULL`,
      `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_serial_number_key`,
      `ALTER TABLE devices ALTER COLUMN imei_1 DROP NOT NULL`,
      `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_imei_1_key`,
      `ALTER TABLE devices ALTER COLUMN imei_1 TYPE VARCHAR(30)`,
      `ALTER TABLE devices ALTER COLUMN imei_2 TYPE VARCHAR(30)`,
      `ALTER TABLE movements ALTER COLUMN device_imei TYPE VARCHAR(30)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_imei_1 ON devices(imei_1) WHERE imei_1 IS NOT NULL AND imei_1 <> ''`,
      `ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_device_id_fkey`,
      `ALTER TABLE terms_documents DROP CONSTRAINT IF EXISTS terms_documents_device_id_fkey`,
      `ALTER TABLE terms_documents DROP CONSTRAINT IF EXISTS terms_documents_collaborator_id_fkey`,
    ];
    for (const stmt of compatStatements) {
      try {
        await client.query(stmt);
      } catch (e: any) {
        console.warn(`⚠️ [PostgreSQL] Ajuste de schema ignorado (${e.message}): ${stmt}`);
      }
    }

    // Índices de otimização
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_tag ON devices(tag);
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
      CREATE INDEX IF NOT EXISTS idx_lines_phone ON phone_lines(phone_number);
      CREATE INDEX IF NOT EXISTS idx_collab_name ON collaborators(name);
      CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(movement_date);
    `);

    // 8. Garante que os Super Usuários oficiais existam com senha bcrypt
    const superAdminHash = '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW'; // Iane@2026
    const allPerms = ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'];

    await client.query(`
      INSERT INTO system_users (id, username, password_hash, full_name, email, role, permissions, active)
      VALUES 
        ('user-iane-super-1', 'tecnologia@iane.ind.br', $1, 'TI IANE - Super Usuário', 'tecnologia@iane.ind.br', 'admin', $2, true),
        ('user-iane-super-2', 'tecnologia', $1, 'TI IANE - Super Usuário', 'tecnologia@iane.ind.br', 'admin', $2, true)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          permissions = EXCLUDED.permissions,
          role = EXCLUDED.role;
    `, [superAdminHash, allPerms]);

    console.log('✅ [PostgreSQL] Todas as tabelas e migrações do sistema verificadas com sucesso!');
  } catch (err: any) {
    console.error('⚠️ [PostgreSQL] Erro na automigração:', err.message);
  }
}

async function connectDatabase(attempt = 1): Promise<void> {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      await autoMigrateDatabase(client);
    } finally {
      client.release();
    }
    isDbConnected = true;
    console.log('✅ [PostgreSQL] Conexão com o banco de dados corporativo estabelecida com sucesso!');
  } catch (err: any) {
    isDbConnected = false;
    console.warn(`⚠️ [PostgreSQL] Tentativa ${attempt} de conexão falhou: ${err.message}. Nova tentativa em 5s...`);
    setTimeout(() => connectDatabase(attempt + 1), 5000);
  }
}

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
  });
  pool.on('error', (err) => console.error('⚠️ [PostgreSQL] Erro em conexão ociosa do pool:', err.message));
  connectDatabase();
} else {
  console.log('ℹ️ [PostgreSQL] DATABASE_URL não definida. Defina-a para gravar no banco (ou use ALLOW_MEMORY_FALLBACK=true apenas em desenvolvimento).');
}

// ----------------------------------------------------------------------------
// Middleware de Autenticação JWT e Autorização
// ----------------------------------------------------------------------------
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    (req as any).user = null;
    return next();
  }

  jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, decoded: any) => {
    if (!err && decoded) {
      (req as any).user = decoded;
    } else {
      (req as any).user = null;
    }
    next();
  });
}

app.use(authenticateToken);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
  }
  next();
}

function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
    }
    if (user.role === 'admin') return next();
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('all') || perms.includes(permission)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Acesso negado. Permissão insuficiente.' });
  };
}

// Rotas públicas
const PUBLIC_PATHS = ['/api/health', '/api/auth/login'];
app.use((req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path === p)) return next();
  // Protege todas as rotas /api
  if (req.path.startsWith('/api/')) {
    return requireAuth(req, res, next);
  }
  next();
});

// Rotas de dados exigem o PostgreSQL. Sem banco, respondem 503 para que o front-end mantenha a gravação
// na fila e tente de novo (antes o servidor respondia "sucesso" gravando só em memória).
const DB_REQUIRED_PREFIXES = ['/api/devices', '/api/lines', '/api/collaborators', '/api/movements', '/api/terms', '/api/audit-logs', '/api/sync', '/api/database'];
app.use((req, res, next) => {
  if (!ALLOW_MEMORY_FALLBACK && !isDbConnected && DB_REQUIRED_PREFIXES.some(p => req.path.startsWith(p))) {
    return res.status(503).json({
      success: false,
      message: 'Banco de dados PostgreSQL indisponível no momento. A gravação será tentada novamente.',
    });
  }
  next();
});

// ----------------------------------------------------------------------------
// ROTAS DA API REST (/api/*)
// ----------------------------------------------------------------------------

// 1. Status e Health Check
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'memory_fallback',
    environment: isProduction ? 'production' : 'development',
  });
});

// 2. Autenticação e Login Corporativo
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const trimmedUser = (username || '').trim().toLowerCase();
  const trimmedPass = (password || '').trim();

  if (!trimmedUser || !trimmedPass) {
    return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
  }

  // Se o banco estiver conectado
  if (pool && isDbConnected) {
    try {
      const userRes = await pool.query(
        'SELECT id, username, password_hash, full_name as "fullName", email, role, permissions, active FROM system_users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
        [trimmedUser]
      );

      if (userRes.rows.length > 0) {
        const dbUser = userRes.rows[0];
        if (!dbUser.active) {
          return res.status(403).json({ success: false, message: 'Usuário desativado pelo administrador.' });
        }

        // Verifica bcrypt
        let isMatch = false;
        if (dbUser.password_hash.startsWith('$2a$') || dbUser.password_hash.startsWith('$2b$')) {
          isMatch = await bcrypt.compare(trimmedPass, dbUser.password_hash);
        } else if (dbUser.password_hash === trimmedPass) {
          // Migra senha legada de texto puro para bcrypt
          isMatch = true;
          const newHash = await bcrypt.hash(trimmedPass, 10);
          await pool.query('UPDATE system_users SET password_hash = $1 WHERE id = $2', [newHash, dbUser.id]);
        }

        if (isMatch) {
          const userPayload = {
            id: dbUser.id,
            username: dbUser.username,
            fullName: dbUser.fullName,
            email: dbUser.email,
            role: dbUser.role,
            permissions: dbUser.permissions || ['all'],
          };

          const token = jwt.sign(userPayload, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });

          return res.json({
            success: true,
            user: userPayload,
            token,
          });
        } else {
          return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [Auth] Erro ao consultar banco:', e.message);
    }
  }

  // Fallback em memória (ou sem DB)
  const user = memoryStore.users.find(
    (u) => (u.username.toLowerCase() === trimmedUser || u.email?.toLowerCase() === trimmedUser)
  );

  if (user) {
    if (!user.active) {
      return res.status(403).json({ success: false, message: 'Usuário desativado.' });
    }
    const isMatch = await bcrypt.compare(trimmedPass, user.passwordHash);
    if (isMatch) {
      const userPayload = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role as any,
        permissions: user.permissions,
      };
      const token = jwt.sign(userPayload, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, user: userPayload, token });
    }
  }

  return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
});

// 3. Gestão de Usuários (RBAC / CRUD de Operadores)
app.get('/api/users', requirePermission('manage_users'), async (_req, res) => {
  if (pool && isDbConnected) {
    try {
      const result = await pool.query(`
        SELECT id, username, full_name as "fullName", email, role, permissions, active, created_at as "createdAt"
        FROM system_users
        ORDER BY created_at ASC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  // Fallback
  const safeUsers = memoryStore.users.map(({ passwordHash, ...rest }) => rest);
  res.json({ success: true, data: safeUsers });
});

app.post('/api/users', requirePermission('manage_users'), async (req, res) => {
  const { username, fullName, email, password, role, permissions, active } = req.body || {};

  if (!username || !fullName || !password) {
    return res.status(400).json({ success: false, message: 'Nome, usuário e senha são obrigatórios.' });
  }

  const trimmedUsername = username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password.trim(), 10);
  const id = `user-${Date.now()}`;
  const userRole = role || 'operador';
  const userPerms = Array.isArray(permissions) ? permissions : ['dashboard', 'dispositivos', 'linhas', 'colaboradores'];
  const userActive = active !== undefined ? !!active : true;

  if (pool && isDbConnected) {
    try {
      // Verifica duplicação
      const existing = await pool.query('SELECT id FROM system_users WHERE LOWER(username) = $1', [trimmedUsername]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Este nome de usuário já está em uso.' });
      }

      const result = await pool.query(`
        INSERT INTO system_users (id, username, password_hash, full_name, email, role, permissions, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, username, full_name as "fullName", email, role, permissions, active, created_at as "createdAt"
      `, [id, trimmedUsername, passwordHash, fullName.trim(), email?.trim() || null, userRole, userPerms, userActive]);

      return res.status(201).json({ success: true, data: result.rows[0], message: 'Usuário criado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  if (memoryStore.users.some(u => u.username.toLowerCase() === trimmedUsername)) {
    return res.status(400).json({ success: false, message: 'Este nome de usuário já está em uso.' });
  }
  const newUser = {
    id,
    username: trimmedUsername,
    passwordHash,
    fullName: fullName.trim(),
    email: email?.trim(),
    role: userRole,
    permissions: userPerms,
    active: userActive,
    createdAt: new Date().toISOString(),
  };
  memoryStore.users.push(newUser);
  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, data: safeUser, message: 'Usuário criado com sucesso.' });
});

app.put('/api/users/:id', requirePermission('manage_users'), async (req, res) => {
  const { id } = req.params;
  const { fullName, email, password, role, permissions, active } = req.body || {};

  if (pool && isDbConnected) {
    try {
      let query = `
        UPDATE system_users
        SET full_name = COALESCE($1, full_name),
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            permissions = COALESCE($4, permissions),
            active = COALESCE($5, active)
      `;
      const values: any[] = [fullName?.trim() || null, email?.trim() || null, role || null, permissions || null, active !== undefined ? active : null];

      if (password && password.trim()) {
        const hash = await bcrypt.hash(password.trim(), 10);
        query += `, password_hash = $6 WHERE id = $7 RETURNING id, username, full_name as "fullName", email, role, permissions, active, created_at as "createdAt"`;
        values.push(hash, id);
      } else {
        query += ` WHERE id = $6 RETURNING id, username, full_name as "fullName", email, role, permissions, active, created_at as "createdAt"`;
        values.push(id);
      }

      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      }

      return res.json({ success: true, data: result.rows[0], message: 'Usuário atualizado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const user = memoryStore.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
  if (fullName) user.fullName = fullName.trim();
  if (email !== undefined) user.email = email.trim();
  if (role) user.role = role;
  if (permissions) user.permissions = permissions;
  if (active !== undefined) user.active = active;
  if (password && password.trim()) user.passwordHash = await bcrypt.hash(password.trim(), 10);

  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, data: safeUser, message: 'Usuário atualizado com sucesso.' });
});

app.delete('/api/users/:id', requirePermission('manage_users'), async (req, res) => {
  const { id } = req.params;

  if (id === 'user-iane-super-1' || id === 'user-iane-super-2') {
    return res.status(403).json({ success: false, message: 'O Super Administrador principal da IANE não pode ser excluído.' });
  }

  if (pool && isDbConnected) {
    try {
      await pool.query('DELETE FROM system_users WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Usuário excluído com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const idx = memoryStore.users.findIndex(u => u.id === id);
  if (idx !== -1) memoryStore.users.splice(idx, 1);
  res.json({ success: true, message: 'Usuário excluído com sucesso.' });
});

// 4. Dispositivos (Smartphones)
// ----------------------------------------------------------------------------
// Persistência: helpers compartilhados (rotas individuais + batch-upload)
// Cada registro é gravado nas colunas relacionais E no campo JSONB "data", que
// guarda o objeto completo enviado pelo front-end (nenhum campo se perde).
// ----------------------------------------------------------------------------
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Queryable = { query: (text: string, params?: any[]) => Promise<any> };

const str = (v: any): string | null =>
  v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();
const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const todayISO = () => new Date().toISOString().split('T')[0];
const withId = (body: any, prefix: string) => ({ ...(body || {}), id: body?.id || `${prefix}-${Date.now()}` });

// Junta o objeto completo (JSONB) com as colunas relacionais; coluna preenchida prevalece
function mergeRow(row: any): any {
  const { data, ...cols } = row;
  const out: any = { ...(data || {}) };
  for (const [k, v] of Object.entries(cols)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  // datas de criação/atualização: mantém o formato original gravado pelo front-end
  for (const k of ['createdAt', 'updatedAt']) {
    if (data && data[k]) out[k] = data[k];
  }
  return out;
}

function toHttpError(err: any): { status: number; message: string } {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  const code = String(err?.code || '');
  if (code === '23505') return { status: 409, message: `Registro duplicado no banco de dados: ${err.detail || err.message}` };
  if (code === '23503') return { status: 409, message: `Vínculo inválido, o registro relacionado não existe no banco: ${err.detail || err.message}` };
  if (['23502', '22P02', '22001', '22007', '22003'].includes(code)) return { status: 400, message: `Dados inválidos: ${err.message}` };
  return { status: 500, message: err?.message || 'Erro interno ao gravar no banco de dados.' };
}

// Envolve uma rota: qualquer erro vira JSON com status HTTP coerente (400/409 = rejeição definitiva, 5xx = tentar de novo)
function route(fn: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      const { status, message } = toHttpError(err);
      console.error(`⚠️ [${req.method} ${req.path}] ${status}: ${message}`);
      if (!res.headersSent) res.status(status).json({ success: false, message, error: message });
    }
  };
}

async function upsertCollaborator(q: Queryable, c: any, overwrite = true) {
  const name = str(c.fullName ?? c.name);
  if (!name) throw new HttpError(400, 'O nome do colaborador é obrigatório.');
  const onConflict = overwrite
    ? `DO UPDATE SET name = EXCLUDED.name, registration_id = EXCLUDED.registration_id, department = EXCLUDED.department,
         role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone, active = EXCLUDED.active, data = EXCLUDED.data`
    : 'DO NOTHING';
  await q.query(
    `INSERT INTO collaborators (id, name, registration_id, department, role, email, phone, active, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (id) ${onConflict}`,
    [
      c.id,
      name,
      str(c.registrationNumber ?? c.registration_id) || `MAT-${c.id}`,
      str(c.department) || 'Geral',
      str(c.position ?? c.role) || 'Colaborador',
      str(c.corporateEmail ?? c.email),
      str(c.contactPhone ?? c.phone),
      c.status ? c.status !== 'Desligado' : c.active !== false,
      JSON.stringify(c),
    ]
  );
}

async function upsertLine(q: Queryable, l: any, overwrite = true) {
  const phone = str(l.phoneNumber);
  if (!phone) throw new HttpError(400, 'O número da linha telefônica é obrigatório.');
  const onConflict = overwrite
    ? `DO UPDATE SET phone_number = EXCLUDED.phone_number, operator = EXCLUDED.operator, account_number = EXCLUDED.account_number,
         plan_name = EXCLUDED.plan_name, monthly_cost = EXCLUDED.monthly_cost, status = EXCLUDED.status,
         current_device_id = EXCLUDED.current_device_id, current_collaborator_id = EXCLUDED.current_collaborator_id,
         notes = EXCLUDED.notes, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`
    : 'DO NOTHING';
  await q.query(
    `INSERT INTO phone_lines (id, phone_number, operator, account_number, plan_name, monthly_cost, status, current_device_id, current_collaborator_id, notes, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (id) ${onConflict}`,
    [
      l.id,
      phone,
      str(l.carrier ?? l.operator) || 'Vivo',
      str(l.accountNumber),
      str(l.planName) || 'Corporativo',
      num(l.monthlyCost),
      str(l.status) || 'Disponível',
      str(l.associatedDeviceId),
      str(l.currentCollaboratorId),
      str(l.notes),
      JSON.stringify(l),
    ]
  );
}

async function upsertDevice(q: Queryable, d: any, overwrite = true) {
  const tag = str(d.assetTag ?? d.tag);
  if (!tag) throw new HttpError(400, 'O identificador do ativo (assetTag) é obrigatório.');
  const model = str(d.model);
  if (!model) throw new HttpError(400, `O modelo do aparelho ${tag} é obrigatório.`);
  const onConflict = overwrite
    ? `DO UPDATE SET tag = EXCLUDED.tag, brand = EXCLUDED.brand, model = EXCLUDED.model, imei_1 = EXCLUDED.imei_1,
         imei_2 = EXCLUDED.imei_2, serial_number = EXCLUDED.serial_number, purchase_value = EXCLUDED.purchase_value,
         purchase_date = EXCLUDED.purchase_date, condition = EXCLUDED.condition, status = EXCLUDED.status,
         current_collaborator_id = EXCLUDED.current_collaborator_id, current_line_id = EXCLUDED.current_line_id,
         stock_custody_notes = EXCLUDED.stock_custody_notes, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`
    : 'DO NOTHING';
  await q.query(
    `INSERT INTO devices (id, tag, brand, model, imei_1, imei_2, serial_number, purchase_value, purchase_date, condition, status,
                          current_collaborator_id, current_line_id, stock_custody_notes, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     ON CONFLICT (id) ${onConflict}`,
    [
      d.id,
      tag,
      str(d.brand) || 'Samsung',
      model,
      str(d.imei1 ?? d.imei_1),
      str(d.imei2 ?? d.imei_2),
      str(d.serialNumber ?? d.serial_number),
      num(d.purchaseValue),
      str(d.purchaseDate),
      str(d.condition) || 'Novo',
      str(d.status) || 'Disponível',
      str(d.currentCollaboratorId),
      str(d.associatedLineId ?? d.current_line_id),
      str(d.notes ?? d.stockCustodyNotes),
      JSON.stringify(d),
    ]
  );
}

const flowFromType = (type: any) =>
  String(type || 'entrega')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 50);

async function upsertMovement(q: Queryable, m: any, overwrite = true) {
  if (!str(m.deviceId)) throw new HttpError(400, 'A movimentação não informa o aparelho (deviceId).');
  const onConflict = overwrite
    ? `DO UPDATE SET batch_operation_id = EXCLUDED.batch_operation_id, flow_type = EXCLUDED.flow_type, device_id = EXCLUDED.device_id,
         device_tag = EXCLUDED.device_tag, device_model = EXCLUDED.device_model, device_imei = EXCLUDED.device_imei,
         origin_collaborator_id = EXCLUDED.origin_collaborator_id, origin_collaborator_name = EXCLUDED.origin_collaborator_name,
         destination_collaborator_id = EXCLUDED.destination_collaborator_id, destination_collaborator_name = EXCLUDED.destination_collaborator_name,
         movement_type = EXCLUDED.movement_type, movement_date = EXCLUDED.movement_date, operator_name = EXCLUDED.operator_name,
         condition_at_movement = EXCLUDED.condition_at_movement, accessories_returned = EXCLUDED.accessories_returned,
         reason = EXCLUDED.reason, document_term_id = EXCLUDED.document_term_id, stock_transit = EXCLUDED.stock_transit, data = EXCLUDED.data`
    : 'DO NOTHING';
  await q.query(
    `INSERT INTO movements (
        id, batch_operation_id, flow_type, device_id, device_tag, device_model, device_imei,
        origin_collaborator_id, origin_collaborator_name, destination_collaborator_id, destination_collaborator_name,
        movement_type, movement_date, operator_name, condition_at_movement, accessories_returned, reason, document_term_id,
        stock_transit, data
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb)
     ON CONFLICT (id) ${onConflict}`,
    [
      m.id,
      str(m.batchOperationId),
      str(m.flowType) || flowFromType(m.type),
      m.deviceId,
      str(m.deviceTag),
      str(m.deviceName ?? m.deviceModel),
      str(m.imei),
      str(m.originCollaboratorId),
      str(m.originCollaboratorName),
      str(m.destinationCollaboratorId),
      str(m.destinationCollaboratorName),
      str(m.type) || 'Entrega',
      str(m.date) || todayISO(),
      str(m.registeredBy) || 'Gestor de Telefonia',
      str(m.conditionAtMovement),
      Array.isArray(m.accessoriesIncluded) ? m.accessoriesIncluded.map(String) : [],
      str(m.reason),
      str(m.documentId),
      !!m.stockTransit?.involved,
      JSON.stringify(m),
    ]
  );
}

async function upsertTerm(q: Queryable, t: any, overwrite = true) {
  // O PDF (base64) fica na coluna file_data e NUNCA vai para o JSONB "data",
  // para não trafegar em toda listagem de termos.
  const { fileData, ...termForJson } = t || {};
  const onConflict = overwrite
    ? `DO UPDATE SET type = EXCLUDED.type, collaborator_id = EXCLUDED.collaborator_id, collaborator_name = EXCLUDED.collaborator_name,
         device_id = EXCLUDED.device_id, device_tag = EXCLUDED.device_tag, device_model = EXCLUDED.device_model,
         phone_line_number = EXCLUDED.phone_line_number, generation_date = EXCLUDED.generation_date,
         signed_status = EXCLUDED.signed_status, file_name = EXCLUDED.file_name, notes = EXCLUDED.notes, data = EXCLUDED.data,
         file_data = COALESCE(NULLIF(EXCLUDED.file_data, ''), terms_documents.file_data)`
    : 'DO NOTHING';
  await q.query(
    `INSERT INTO terms_documents (id, term_number, type, collaborator_id, collaborator_name, device_id, device_tag, device_model,
                                  phone_line_number, generation_date, signed_status, file_name, notes, data, file_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     ON CONFLICT (id) ${onConflict}`,
    [
      t.id,
      str(t.code ?? t.termNumber) || `TERMO-${t.id}`,
      str(t.type) || 'Termo de Entrega',
      str(t.collaboratorId),
      str(t.collaboratorName),
      str(t.deviceId),
      str(t.deviceTag),
      str(t.deviceModel),
      str(t.phoneNumber),
      str(t.date) || todayISO(),
      str(t.status) || 'Pendente',
      str(t.fileName),
      str(t.notes),
      JSON.stringify(termForJson),
      str(fileData),
    ]
  );
}

async function insertAudit(q: Queryable, a: any) {
  const parsed = a.timestamp ? new Date(a.timestamp) : new Date();
  const ts = isNaN(parsed.getTime()) ? new Date() : parsed;
  await q.query(
    `INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, details, user_name, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      a.id,
      str(a.action) || 'OPERAÇÃO',
      str(a.entityType) || 'Geral',
      str(a.entityId),
      str(a.entityLabel),
      a.details ?? null,
      str(a.user) || 'Operador',
      ts,
    ]
  );
}

app.get('/api/devices', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        d.id, d.tag as "assetTag", d.brand, d.model, d.imei_1 as "imei1", d.imei_2 as "imei2",
        d.serial_number as "serialNumber", d.purchase_value as "purchaseValue",
        d.purchase_date as "purchaseDate", d.condition, d.status,
        d.current_collaborator_id as "currentCollaboratorId",
        c.name as "currentCollaboratorName",
        d.current_line_id as "associatedLineId",
        l.phone_number as "associatedPhoneNumber",
        d.stock_custody_notes as "notes",
        d.created_at as "createdAt", d.updated_at as "updatedAt",
        d.data
      FROM devices d
      LEFT JOIN collaborators c ON d.current_collaborator_id = c.id
      LEFT JOIN phone_lines l ON d.current_line_id = l.id
      ORDER BY d.tag ASC
    `);
    return res.json({ success: true, data: result.rows.map(mergeRow) });
  }
  res.json({ success: true, data: memoryStore.devices });
}));

app.post('/api/devices', route(async (req, res) => {
  const d = withId(req.body, 'dev');

  if (pool && isDbConnected) {
    await upsertDevice(pool, d);
    return res.status(201).json({ success: true, data: d });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true)
  const existingIndex = memoryStore.devices.findIndex(x => x.id === d.id);
  if (existingIndex >= 0) {
    memoryStore.devices[existingIndex] = { ...memoryStore.devices[existingIndex], ...d };
  } else {
    memoryStore.devices.push(d);
  }
  res.status(201).json({ success: true, data: d });
}));

app.delete('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  if (pool && isDbConnected) {
    try {
      await pool.query('DELETE FROM devices WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Dispositivo excluído.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  memoryStore.devices = memoryStore.devices.filter(d => d.id !== id);
  res.json({ success: true, message: 'Dispositivo excluído.' });
});

// 5. Linhas Telefônicas
app.get('/api/lines', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        l.id, l.phone_number as "phoneNumber", l.operator as "carrier", l.account_number as "accountNumber",
        l.plan_name as "planName", l.monthly_cost as "monthlyCost", l.status,
        l.current_device_id as "associatedDeviceId",
        d.tag as "associatedDeviceTag",
        concat_ws(' ', d.brand, d.model) as "associatedDeviceModel",
        l.current_collaborator_id as "currentCollaboratorId",
        c.name as "currentCollaboratorName",
        l.notes, l.updated_at as "updatedAt",
        l.data
      FROM phone_lines l
      LEFT JOIN devices d ON l.current_device_id = d.id
      LEFT JOIN collaborators c ON l.current_collaborator_id = c.id
      ORDER BY l.phone_number ASC
    `);
    return res.json({ success: true, data: result.rows.map(mergeRow) });
  }
  res.json({ success: true, data: memoryStore.lines });
}));

app.post('/api/lines', route(async (req, res) => {
  const l = withId(req.body, 'line');

  if (pool && isDbConnected) {
    await upsertLine(pool, l);
    return res.status(201).json({ success: true, data: l });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true)
  const existingIdx = memoryStore.lines.findIndex(x => x.id === l.id);
  if (existingIdx >= 0) {
    memoryStore.lines[existingIdx] = { ...memoryStore.lines[existingIdx], ...l };
  } else {
    memoryStore.lines.push(l);
  }
  res.status(201).json({ success: true, data: l });
}));

app.delete('/api/lines/:id', async (req, res) => {
  const { id } = req.params;
  if (pool && isDbConnected) {
    try {
      await pool.query('DELETE FROM phone_lines WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Linha excluída.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  memoryStore.lines = memoryStore.lines.filter(l => l.id !== id);
  res.json({ success: true, message: 'Linha excluída.' });
});

// 6. Colaboradores
app.get('/api/collaborators', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        id, name as "fullName", registration_id as "registrationNumber",
        department, role as "position", email as "corporateEmail",
        phone as "contactPhone", active, created_at as "createdAt", data
      FROM collaborators
      ORDER BY name ASC
    `);
    const rows = result.rows.map(mergeRow).map((c: any) => ({
      ...c,
      status: c.status || (c.active === false ? 'Desligado' : 'Ativo'),
    }));
    return res.json({ success: true, data: rows });
  }
  res.json({ success: true, data: memoryStore.collaborators });
}));

app.post('/api/collaborators', route(async (req, res) => {
  const c = withId(req.body, 'col');

  if (pool && isDbConnected) {
    await upsertCollaborator(pool, c);
    return res.status(201).json({ success: true, data: c });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true)
  const existingIdx = memoryStore.collaborators.findIndex(x => x.id === c.id);
  if (existingIdx >= 0) {
    memoryStore.collaborators[existingIdx] = { ...memoryStore.collaborators[existingIdx], ...c };
  } else {
    memoryStore.collaborators.push(c);
  }
  res.status(201).json({ success: true, data: c });
}));

app.delete('/api/collaborators/:id', async (req, res) => {
  const { id } = req.params;
  if (pool && isDbConnected) {
    try {
      await pool.query('DELETE FROM collaborators WHERE id = $1', [id]);
      return res.json({ success: true, message: 'Colaborador excluído.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  memoryStore.collaborators = memoryStore.collaborators.filter(c => c.id !== id);
  res.json({ success: true, message: 'Colaborador excluído.' });
});

// 7. Movimentações Patrimoniais
app.get('/api/movements', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        id, batch_operation_id as "batchOperationId", flow_type as "flowType",
        device_id as "deviceId", device_tag as "deviceTag", device_model as "deviceName",
        device_imei as "imei", origin_collaborator_id as "originCollaboratorId",
        origin_collaborator_name as "originCollaboratorName",
        destination_collaborator_id as "destinationCollaboratorId",
        destination_collaborator_name as "destinationCollaboratorName",
        movement_type as "type", movement_date as "date",
        operator_name as "registeredBy", condition_at_movement as "conditionAtMovement",
        accessories_returned as "accessoriesIncluded", reason,
        document_term_id as "documentId",
        created_at as "createdAt", data
      FROM movements
      ORDER BY created_at DESC
    `);
    return res.json({ success: true, data: result.rows.map(mergeRow) });
  }
  res.json({ success: true, data: memoryStore.movements });
}));

app.post('/api/movements', route(async (req, res) => {
  const m = withId(req.body, 'mov');

  if (pool && isDbConnected) {
    await upsertMovement(pool, m);
    return res.status(201).json({ success: true, data: m });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true)
  memoryStore.movements.unshift(m);
  res.status(201).json({ success: true, data: m });
}));

// 8. Transação Atômica Oficial: Transferência entre Colaboradores (2 Etapas)
app.post('/api/movements/transfer', async (req, res) => {
  if (!pool || !isDbConnected) {
    return res.json({ success: true, message: 'Transferência registrada localmente (Modo Fallback).' });
  }

  const {
    deviceId,
    originCollaboratorId,
    destinationCollaboratorId,
    movementDate,
    operatorName,
    conditionAtEvaluation,
    stockDestinationStatus,
    accessoriesReturned,
    reason,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchOperationId = `batch-transf-${Date.now()}`;
    const STOCK_LABEL = 'Estoque do Gestor de Telefonia';

    const devRes = await client.query('SELECT * FROM devices WHERE id = $1 FOR UPDATE', [deviceId]);
    if (devRes.rows.length === 0) throw new Error('Dispositivo não encontrado');
    const device = devRes.rows[0];

    const origColRes = await client.query('SELECT name FROM collaborators WHERE id = $1', [originCollaboratorId]);
    const originName = origColRes.rows[0]?.name || 'Colaborador Anterior';

    const destColRes = await client.query('SELECT name FROM collaborators WHERE id = $1', [destinationCollaboratorId]);
    const destName = destColRes.rows[0]?.name || 'Novo Colaborador';

    // ETAPA 1: Retorno ao Estoque com avaliação técnica
    const stage1Id = `mov-${Date.now()}-1`;
    await client.query(`
      INSERT INTO movements (
        id, batch_operation_id, flow_type, device_id, device_tag, device_model, device_imei,
        origin_collaborator_id, origin_collaborator_name, destination_collaborator_id, destination_collaborator_name,
        movement_type, movement_date, operator_name, condition_at_movement, accessories_returned,
        reason, stock_transit
      ) VALUES ($1, $2, 'transferencia', $3, $4, $5, $6, $7, $8, NULL, $9, 'Devolução', $10, $11, $12, $13, $14, true)
    `, [
      stage1Id, batchOperationId, device.id, device.tag, device.model, device.imei_1,
      originCollaboratorId, originName, STOCK_LABEL, movementDate, operatorName,
      conditionAtEvaluation, accessoriesReturned || [],
      `Etapa 1/2 [Transferência]: Retorno ao Estoque com avaliação técnica. Motivo: ${reason || 'Transferência de custódia'}`
    ]);

    // ETAPA 2: Apenas se 'Disponível'
    if (stockDestinationStatus === 'Disponível') {
      const stage2Id = `mov-${Date.now()}-2`;
      await client.query(`
        INSERT INTO movements (
          id, batch_operation_id, flow_type, device_id, device_tag, device_model, device_imei,
          origin_collaborator_id, origin_collaborator_name, destination_collaborator_id, destination_collaborator_name,
          movement_type, movement_date, operator_name, condition_at_movement, reason, stock_transit
        ) VALUES ($1, $2, 'transferencia', $3, $4, $5, $6, NULL, $7, $8, $9, 'Entrega', $10, $11, $12, $13, false)
      `, [
        stage2Id, batchOperationId, device.id, device.tag, device.model, device.imei_1,
        STOCK_LABEL, destinationCollaboratorId, destName, movementDate, operatorName,
        conditionAtEvaluation,
        `Etapa 2/2 [Transferência]: Conclusão da entrega ao novo colaborador após conferência no estoque.`
      ]);

      await client.query(`
        UPDATE devices
        SET status = 'Em uso',
            current_collaborator_id = $1,
            condition = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [destinationCollaboratorId, conditionAtEvaluation, device.id]);
    } else {
      await client.query(`
        UPDATE devices
        SET status = $1,
            current_collaborator_id = NULL,
            current_line_id = NULL,
            condition = $2,
            stock_custody_notes = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [
        stockDestinationStatus,
        conditionAtEvaluation,
        `Transferência interrompida na Etapa 1. Aparelho retido no Estoque (${stockDestinationStatus}) para avaliação/reparo antes de nova atribuição.`,
        device.id
      ]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      batchOperationId,
      message: stockDestinationStatus === 'Disponível'
        ? 'Transferência atômica em 2 etapas concluída com sucesso no PostgreSQL!'
        : `Etapa 1 executada: Aparelho devolvido ao estoque com status '${stockDestinationStatus}'.`
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 9. Termos e Documentos Oficiais
app.get('/api/terms', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        id, term_number as "code", type, collaborator_id as "collaboratorId",
        collaborator_name as "collaboratorName", device_id as "deviceId",
        device_tag as "deviceTag", device_model as "deviceModel",
        phone_line_number as "phoneNumber", generation_date as "date",
        signed_status as "status", file_name as "fileName", notes, data,
        (file_data IS NOT NULL AND file_data <> '') as "hasFile"
      FROM terms_documents
      ORDER BY generation_date DESC, created_at DESC
    `);
    // Registros antigos (sem JSONB) não possuem cláusulas/acessórios: garante listas vazias para o visualizador de termos
    const rows = result.rows.map(mergeRow).map((t: any) => ({
      ...t,
      clauses: Array.isArray(t.clauses) ? t.clauses : [],
      accessoriesList: Array.isArray(t.accessoriesList) ? t.accessoriesList : [],
    }));
    return res.json({ success: true, data: rows });
  }
  const memoryRows = memoryStore.terms.map((t: any) => {
    const { fileData, ...rest } = t;
    return { ...rest, hasFile: !!fileData };
  });
  res.json({ success: true, data: memoryRows });
}));

/** Valida o PDF recebido em base64 (tipo real, tamanho) e devolve somente o conteúdo. */
function readPdfBase64(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  const base64 = input.includes(',') ? input.slice(input.indexOf(',') + 1) : input;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw new HttpError(400, 'O arquivo PDF enviado é inválido.');
  }
  if (buffer.length === 0) throw new HttpError(400, 'O arquivo PDF enviado está vazio.');
  if (buffer.length > 15 * 1024 * 1024) {
    throw new HttpError(413, 'O PDF excede o limite de 15 MB. Reduza o arquivo antes de anexar.');
  }
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new HttpError(400, 'O arquivo enviado não é um PDF válido.');
  }
  return base64;
}

app.post('/api/terms', route(async (req, res) => {
  const body = req.body || {};
  const fileData = body.fileData ? readPdfBase64(body.fileData) : null;
  const t = withId(body, 'term');

  if (fileData) {
    t.fileData = fileData;
    t.hasFile = true;
    if (!str(t.fileName)) t.fileName = `${str(t.code) || t.id}.pdf`;
  }

  if (pool && isDbConnected) {
    await upsertTerm(pool, t);
    return res.status(201).json({ success: true, data: { ...t, fileData: undefined, hasFile: !!fileData } });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true).
  // Mantém a mesma semântica do ON CONFLICT do PostgreSQL: atualiza por id e
  // preserva o PDF anterior quando a requisição não envia um novo arquivo.
  const existingIndex = memoryStore.terms.findIndex((x: any) => x.id === t.id);
  if (existingIndex >= 0) {
    const previous = memoryStore.terms[existingIndex];
    const keptFileData = fileData || previous.fileData || null;
    memoryStore.terms[existingIndex] = {
      ...previous,
      ...t,
      fileData: keptFileData,
      hasFile: !!keptFileData,
    };
  } else {
    memoryStore.terms.unshift(t);
  }
  res.status(201).json({ success: true, data: { ...t, fileData: undefined, hasFile: !!fileData } });
}));

// Download/visualização do PDF anexado ao termo (protegido pelo middleware global de /api)
app.get('/api/terms/:id/file', route(async (req, res) => {
  const { id } = req.params;
  let fileName = 'termo.pdf';
  let fileData: string | null = null;

  if (pool && isDbConnected) {
    const result = await pool.query(
      'SELECT file_name, file_data FROM terms_documents WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) throw new HttpError(404, 'Termo não encontrado.');
    fileName = str(result.rows[0].file_name) || fileName;
    fileData = result.rows[0].file_data;
  } else {
    const term = memoryStore.terms.find((t: any) => t.id === id);
    if (!term) throw new HttpError(404, 'Termo não encontrado.');
    fileName = str(term.fileName) || fileName;
    fileData = term.fileData || null;
  }

  if (!fileData) throw new HttpError(404, 'Este termo não possui arquivo PDF anexado.');

  const base64 = fileData.includes(',') ? fileData.slice(fileData.indexOf(',') + 1) : fileData;
  const buffer = Buffer.from(base64, 'base64');
  const safeName = fileName.replace(/["\r\n]/g, '');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}));

// 10. Trilha de Auditoria
app.get('/api/audit-logs', route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT id, action, entity_type as "entityType", entity_id as "entityId",
             entity_label as "entityLabel", details, user_name as "user",
             timestamp
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT 200
    `);
    return res.json({ success: true, data: result.rows });
  }
  res.json({ success: true, data: memoryStore.auditLogs });
}));

app.post('/api/audit-logs', route(async (req, res) => {
  const a = { ...(req.body || {}), id: req.body?.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` };

  if (pool && isDbConnected) {
    await insertAudit(pool, a);
    return res.status(201).json({ success: true });
  }

  // Fallback (somente com ALLOW_MEMORY_FALLBACK=true)
  memoryStore.auditLogs.unshift({
    id: a.id,
    action: a.action || 'OPERAÇÃO',
    entityType: a.entityType || 'Geral',
    entityId: a.entityId || '',
    entityLabel: a.entityLabel || '',
    details: a.details || '',
    user: a.user || 'Operador',
    timestamp: new Date().toISOString(),
  });
  res.status(201).json({ success: true });
}));

// 11. Sincronização em Lote (Upload Completo do LocalStorage para o PostgreSQL)
// Parâmetro opcional "mode": 'overwrite' (padrão) regrava registros existentes; 'insert-missing' só insere os que ainda não existem no banco.
// Cada registro é gravado em um SAVEPOINT próprio: um registro inválido NÃO derruba o lote inteiro; ele volta em "rejected" com o motivo.
app.post('/api/sync/batch-upload', route(async (req, res) => {
  const { devices, lines, collaborators, movements, terms, auditLogs, mode } = req.body || {};
  const overwrite = mode !== 'insert-missing';

  if (!pool || !isDbConnected) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new HttpError(503, 'Banco de dados PostgreSQL indisponível. Nada foi gravado.');
    }
    return res.json({ success: true, message: 'Dados salvos em modo contingência/memória.' });
  }

  const rejected: { entity: string; id: string; label: string; message: string }[] = [];
  const saved = { collaborators: 0, lines: 0, devices: 0, movements: 0, terms: 0, auditLogs: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const run = async (
      entity: keyof typeof saved,
      items: any,
      labelOf: (x: any) => string,
      fn: (x: any) => Promise<void>
    ) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!item?.id) {
          rejected.push({ entity, id: '', label: labelOf(item), message: 'Registro sem identificador (id).' });
          continue;
        }
        await client.query('SAVEPOINT sp_row');
        try {
          await fn(item);
          await client.query('RELEASE SAVEPOINT sp_row');
          saved[entity]++;
        } catch (e: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp_row');
          rejected.push({ entity, id: item.id, label: labelOf(item), message: toHttpError(e).message });
        }
      }
    };

    // Ordem respeita os vínculos: colaboradores → linhas → aparelhos → movimentações → termos → auditoria
    await run('collaborators', collaborators, c => c.fullName || c.name || c.id, c => upsertCollaborator(client, c, overwrite));
    await run('lines', lines, l => l.phoneNumber || l.id, l => upsertLine(client, l, overwrite));
    await run('devices', devices, d => d.assetTag || d.id, d => upsertDevice(client, d, overwrite));
    await run('movements', movements, m => m.code || m.id, m => upsertMovement(client, m, overwrite));
    await run('terms', terms, t => t.code || t.id, t => upsertTerm(client, t, overwrite));
    await run('auditLogs', auditLogs, a => a.id, a => insertAudit(client, a));

    await client.query('COMMIT');
    console.log(`✅ [PostgreSQL] Lote (${overwrite ? 'overwrite' : 'insert-missing'}): ${JSON.stringify(saved)}; rejeitados: ${rejected.length}`);
    return res.json({
      success: true,
      message: rejected.length
        ? `${rejected.length} registro(s) foram rejeitados pelo banco de dados.`
        : 'Dados sincronizados com o PostgreSQL com sucesso!',
      data: { saved, rejected },
    });
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch { /* ignora */ }
    throw err;
  } finally {
    client.release();
  }
}));

// 12. Limpeza / Reset Total do Banco de Dados
app.post('/api/database/reset', async (req, res) => {
  // Operação destrutiva (TRUNCATE): exige token JWT de administrador
  if ((req as any).user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Somente administradores autenticados podem zerar a base de dados.' });
  }
  if (pool && isDbConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE movements, terms_documents, audit_logs CASCADE;');
      await client.query('UPDATE devices SET current_collaborator_id = NULL, current_line_id = NULL;');
      await client.query('UPDATE phone_lines SET current_device_id = NULL, current_collaborator_id = NULL;');
      await client.query('TRUNCATE TABLE devices, phone_lines, collaborators CASCADE;');
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Base de dados PostgreSQL zerada com sucesso.' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      client.release();
    }
  }

  // Fallback
  memoryStore.devices = [];
  memoryStore.lines = [];
  memoryStore.collaborators = [];
  memoryStore.movements = [];
  memoryStore.terms = [];
  memoryStore.auditLogs = [];
  res.json({ success: true, message: 'Base de dados local zerada com sucesso.' });
});

// ----------------------------------------------------------------------------
// Integração Frontend: Vite Middleware (Dev) ou Arquivos Estáticos (Prod)
// ----------------------------------------------------------------------------
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ [Vite] Servidor de desenvolvimento montado via middleware.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log(`📦 [Produção] Servindo arquivos compilados da pasta: ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [IANE - Gestão de Dispositivos] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();

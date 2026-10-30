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
import { promises as fs } from 'fs';
import { canAccessRequests, canApproveRequests, canViewAllRequests } from './src/config/requestAccess';

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
// Validade do token de sessão (configurável). Padrão: 12h em vez dos 7 dias anteriores.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ----------------------------------------------------------------------------
// Configuração do Pool de Conexões PostgreSQL & Migrações Automáticas
// ----------------------------------------------------------------------------
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

// ----------------------------------------------------------------------------
// Rotina de backup do PostgreSQL (arquivos JSON no servidor)
// ----------------------------------------------------------------------------
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, 'backups');
const BACKUP_INTERVAL_HOURS = Math.max(
  1,
  Number.parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10) || 24
);
const BACKUP_RETENTION = Math.max(
  1,
  Number.parseInt(process.env.BACKUP_RETENTION || '14', 10) || 14
);
const BACKUP_TABLES = [
  'collaborators',
  'phone_lines',
  'devices',
  'movements',
  'movement_requests',
  'terms_documents',
  'system_users',
  'audit_logs',
] as const;

type BackupOrigin = 'manual' | 'scheduled';

interface BackupFileInfo {
  fileName: string;
  createdAt: string;
  size: number;
  origin: BackupOrigin | string;
}

let backupInProgress = false;
let backupSchedulerStarted = false;
let backupTimer: NodeJS.Timeout | null = null;

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
      permissions: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'solicitacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-iane-super-2',
      username: 'tecnologia',
      passwordHash: '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW', // Iane@2026
      fullName: 'TI IANE - Super Usuário',
      email: 'tecnologia@iane.ind.br',
      role: 'admin',
      permissions: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'solicitacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    }
  ],
  devices: [] as any[],
  lines: [] as any[],
  collaborators: [] as any[],
  movements: [] as any[],
  terms: [] as any[],
  auditLogs: [] as any[],
  requests: [] as any[],
  catalogs: null as Record<string, Array<{ id: string; name: string }>> | null,
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
        token_version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Compatibilidade com bancos criados antes da revogação de sessão
    await client.query(
      `ALTER TABLE system_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`
    );

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

    // 8. Solicitações: dados separados de movimentações para não executar fluxos patrimoniais.
    await client.query(`
      CREATE TABLE IF NOT EXISTS movement_requests (
        id VARCHAR(80) PRIMARY KEY,
        request_type VARCHAR(50) NOT NULL,
        created_by_id VARCHAR(50) NOT NULL,
        requester_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(50),
        decided_by_id VARCHAR(50),
        decided_by_name VARCHAR(150),
        decided_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        movement_ids TEXT[]
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_catalogs (
        id VARCHAR(30) PRIMARY KEY,
        catalogs JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const requestDecisionColumns = [
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50)`,
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS decided_by_id VARCHAR(50)`,
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS decided_by_name VARCHAR(150)`,
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
      `ALTER TABLE movement_requests ADD COLUMN IF NOT EXISTS movement_ids TEXT[]`,
    ];
    for (const stmt of requestDecisionColumns) await client.query(stmt);
    const legacyRequests = await client.query(
      `UPDATE movement_requests SET status = 'Pendente de aprovação'
       WHERE status IS NULL OR status = '' RETURNING id`
    );
    if (legacyRequests.rowCount) {
      console.log(`📋 [Solicitações] ${legacyRequests.rowCount} solicitação(ões) antiga(s) marcada(s) como pendente(s).`);
    }
    await client.query(`
      ALTER TABLE movement_requests ALTER COLUMN status SET DEFAULT 'Pendente de aprovação';
      ALTER TABLE movement_requests ALTER COLUMN status SET NOT NULL;
      CREATE INDEX IF NOT EXISTS movement_requests_owner_created_idx
        ON movement_requests (created_by_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS movement_requests_created_idx
        ON movement_requests (created_at DESC);
      CREATE INDEX IF NOT EXISTS movement_requests_status_created_idx
        ON movement_requests (status, created_at DESC);
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

    // Renomeia o status de linha legado para o novo estado de catálogo, sem remover registros.
    await client.query(`
      UPDATE phone_lines
         SET status = CASE WHEN status = 'Ativa' THEN 'Em Uso' ELSE status END,
             data = CASE WHEN data->>'status' = 'Ativa' THEN jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', '"Em Uso"'::jsonb, true) ELSE COALESCE(data, '{}'::jsonb) END
       WHERE status = 'Ativa' OR data->>'status' = 'Ativa';
      UPDATE movements
         SET data = jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{previousLineStatus}',
           CASE WHEN data->>'previousLineStatus' = 'Ativa' THEN '"Em Uso"'::jsonb ELSE COALESCE(data->'previousLineStatus', 'null'::jsonb) END, true),
           '{newLineStatus}', CASE WHEN data->>'newLineStatus' = 'Ativa' THEN '"Em Uso"'::jsonb ELSE COALESCE(data->'newLineStatus', 'null'::jsonb) END, true)
       WHERE data->>'previousLineStatus' = 'Ativa' OR data->>'newLineStatus' = 'Ativa';
    `);

    // 7.1 Migração do campo Setor (cadastro de colaboradores).
    //      Registros anteriores não possuem "sector" no JSONB: ficam Administrativo/TI,
    //      preservando todos os outros dados gravados.
    const sectorMigration = await client.query(`
      UPDATE collaborators
         SET department = 'Administrativo',
             data = COALESCE(data, '{}'::jsonb) || '{"sector":"TI"}'::jsonb
       WHERE data->>'sector' IS NULL OR BTRIM(data->>'sector') = ''
    `);
    if (sectorMigration.rowCount) {
      console.log(`✅ [PostgreSQL] Setor migrado em ${sectorMigration.rowCount} colaborador(es) legado(s).`);
    }

    // 8. Garante que os Super Usuários oficiais existam com senha bcrypt.
    //    ON CONFLICT DO NOTHING: NUNCA sobrescreve a senha/permissões já alteradas pelo administrador.
    const superAdminHash = '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW'; // Iane@2026
    const allPerms = ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'];

    await client.query(`
      INSERT INTO system_users (id, username, password_hash, full_name, email, role, permissions, active)
      VALUES 
        ('user-iane-super-1', 'tecnologia@iane.ind.br', $1, 'TI IANE - Super Usuário', 'tecnologia@iane.ind.br', 'admin', $2, true),
        ('user-iane-super-2', 'tecnologia', $1, 'TI IANE - Super Usuário', 'tecnologia@iane.ind.br', 'admin', $2, true)
      ON CONFLICT DO NOTHING;
    `, [superAdminHash, allPerms]);

    console.log('✅ [PostgreSQL] Todas as tabelas e migrações do sistema verificadas com sucesso!');
  } catch (err: any) {
    console.error('⚠️ [PostgreSQL] Erro na automigração:', err.message);
  }
}

async function listBackups(): Promise<BackupFileInfo[]> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const files = entries.filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith('iane-backup-') &&
        entry.name.endsWith('.json')
    );

    const infos = await Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(BACKUP_DIR, entry.name);
        const stat = await fs.stat(fullPath);
        const origin = entry.name.match(/^iane-backup-(manual|scheduled)-/)?.[1] || 'manual';
        return {
          fileName: entry.name,
          createdAt: stat.mtime.toISOString(),
          size: stat.size,
          origin,
        };
      })
    );

    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.warn('⚠️ [Backup] Não foi possível listar os backups:', err?.message || err);
    }
    return [];
  }
}

async function pruneOldBackups(): Promise<void> {
  const backups = await listBackups();
  const expired = backups.slice(BACKUP_RETENTION);
  await Promise.all(
    expired.map((backup) =>
      fs.unlink(path.join(BACKUP_DIR, backup.fileName)).catch(() => undefined)
    )
  );
  if (expired.length > 0) {
    console.log(`🧹 [Backup] ${expired.length} cópia(s) antiga(s) removida(s) pela retenção de ${BACKUP_RETENTION}.`);
  }
}

async function createDatabaseBackup(origin: BackupOrigin): Promise<BackupFileInfo> {
  if (!pool || !isDbConnected) {
    throw new Error('PostgreSQL indisponível. Conecte o banco para gerar o backup.');
  }
  if (backupInProgress) {
    throw Object.assign(new Error('Já existe um backup em andamento. Tente novamente em instantes.'), {
      status: 409,
    });
  }

  backupInProgress = true;
  try {
    const tables: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      tables[table] = result.rows;
    }

    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, '-');
    const fileName = `iane-backup-${origin}-${stamp}.json`;
    const payload = {
      format: 'iane-postgres-backup',
      version: 1,
      createdAt,
      origin,
      tables,
    };

    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const fullPath = path.join(BACKUP_DIR, fileName);
    const tempPath = `${fullPath}.tmp`;
    const serialized = JSON.stringify(payload);
    await fs.writeFile(tempPath, serialized, 'utf8');
    await fs.rename(tempPath, fullPath);

    await pruneOldBackups();
    console.log(`💾 [Backup] Cópia ${origin} criada: ${fileName} (${serialized.length} bytes)`);

    return {
      fileName,
      createdAt,
      size: Buffer.byteLength(serialized, 'utf8'),
      origin,
    };
  } finally {
    backupInProgress = false;
  }
}

async function runScheduledBackupIfDue(): Promise<void> {
  if (!pool || !isDbConnected) return;

  try {
    const backups = await listBackups();
    const newest = backups[0];
    const ageMs = newest ? Date.now() - new Date(newest.createdAt).getTime() : Infinity;
    const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;

    if (ageMs < intervalMs) return;
    await createDatabaseBackup('scheduled');
  } catch (err: any) {
    console.warn('⚠️ [Backup] Rotina automática falhou:', err?.message || err);
  }
}

function startBackupScheduler(): void {
  if (backupSchedulerStarted) return;
  backupSchedulerStarted = true;

  // Aguarda a estabilização da migração antes da primeira verificação
  setTimeout(() => {
    void runScheduledBackupIfDue();
  }, 30_000).unref?.();

  backupTimer = setInterval(() => {
    void runScheduledBackupIfDue();
  }, 60 * 60 * 1000);
  backupTimer.unref?.();

  console.log(
    `💾 [Backup] Rotina automática ativa: a cada ${BACKUP_INTERVAL_HOURS}h, retenção de ${BACKUP_RETENTION} arquivo(s) em ${BACKUP_DIR}`
  );
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
    startBackupScheduler();
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

  let decoded: any;
  try {
    decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch {
    (req as any).user = null;
    return next();
  }

  // Revogação de sessão: o token carrega a versão emitida no login (claim "tv").
  // Alterar senha/permissões, desativar a conta ou sair revoga imediatamente os tokens antigos.
  const tokenVersion = Number(decoded?.tv ?? 0);

  const applyToken = async () => {
    if (pool && isDbConnected) {
      try {
        const r = await pool.query(
          `SELECT full_name as "fullName", username, email, role, permissions, active, token_version
           FROM system_users WHERE id = $1`,
          [decoded.id]
        );
        const dbUser = r.rows[0];
        if (!dbUser || dbUser.active === false || Number(dbUser.token_version ?? 0) !== tokenVersion) {
          (req as any).user = null;
          return;
        }
        // Papel/permissões atuais do banco prevalecem sobre o que foi assinado no token.
        (req as any).user = {
          ...decoded,
          fullName: dbUser.fullName,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : [],
        };
      } catch {
        // Falha transitória do banco: mantém o token; as rotas de dados respondem 503.
        (req as any).user = decoded;
      }
      return;
    }

    const memUser = memoryStore.users.find((u) => u.id === decoded.id);
    if (!memUser) {
      // Sem banco, um usuário removido do store também tem a sessão invalidada.
      (req as any).user = null;
      return;
    }
    if (!memUser.active || (memUser.tokenVersion || 0) !== tokenVersion) {
      (req as any).user = null;
      return;
    }
    (req as any).user = {
      ...decoded,
      fullName: memUser.fullName,
      username: memUser.username,
      email: memUser.email,
      role: memUser.role,
      permissions: memUser.permissions,
    };
  };

  applyToken()
    .catch(() => {
      (req as any).user = decoded;
    })
    .finally(next);
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

/**
 * Permite a leitura quando o usuário possui QUALQUER um dos módulos informados.
 * A sincronização do front-end lê as seis bases de uma vez, por isso a leitura é
 * liberada para quem tem acesso a pelo menos um módulo (as escritas continuam restritas).
 */
function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
    }
    if (user.role === 'admin') return next();
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('all') || permissions.some((p) => perms.includes(p))) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Acesso negado. Permissão insuficiente.' });
  };
}

const READ_PERMISSIONS = [
  'dashboard',
  'dispositivos',
  'linhas',
  'colaboradores',
  'movimentacoes',
  'termos',
  'relatorios',
  'configuracoes',
];
const requireReadAccess = requireAnyPermission(READ_PERMISSIONS);

function requireRequestsAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
  }
  if (!canAccessRequests(user.role)) {
    return res.status(403).json({ success: false, message: 'Acesso negado ao módulo de solicitações.' });
  }
  next();
}

function requireRequestApprover(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
  }
  if (!canApproveRequests(user.role)) {
    return res.status(403).json({ success: false, message: 'Somente Super Admin ou Administrador pode decidir solicitações.' });
  }
  next();
}

// Operações que expõem a base inteira (backup/restauração) são exclusivas do super administrador.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Não autorizado. Faça login para continuar.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso restrito ao administrador do sistema.' });
  }
  next();
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
const DB_REQUIRED_PREFIXES = ['/api/devices', '/api/lines', '/api/collaborators', '/api/movements', '/api/requests', '/api/terms', '/api/catalogs', '/api/audit-logs', '/api/sync', '/api/database', '/api/backup'];
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
        'SELECT id, username, password_hash, full_name as "fullName", email, role, permissions, active, token_version FROM system_users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
        [trimmedUser]
      );

      if (userRes.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
      }

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

          const token = jwt.sign(
            { ...userPayload, tv: Number(dbUser.token_version ?? 0) },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
          );

          return res.json({
            success: true,
            user: userPayload,
            token,
          });
        } else {
          return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [Auth] Erro ao consultar banco:', e.message);
      return res.status(503).json({
        success: false,
        message: 'Não foi possível validar as credenciais agora. Tente novamente em instantes.',
      });
    }
  }

  // Fallback em memória: SOMENTE quando o banco está indisponível e o modo contingência foi autorizado.
  if (!ALLOW_MEMORY_FALLBACK) {
    return res.status(503).json({
      success: false,
      message: 'Banco de dados indisponível. Não é possível autenticar no momento.',
    });
  }

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
      const token = jwt.sign(
        { ...userPayload, tv: user.tokenVersion || 0 },
        EFFECTIVE_JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
      );
      return res.json({ success: true, user: userPayload, token });
    }
  }

  return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
});

// Encerra a sessão revogando os tokens já emitidos (inclusive em outros dispositivos).
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    if (pool && isDbConnected) {
      await pool.query(
        'UPDATE system_users SET token_version = token_version + 1 WHERE id = $1',
        [user.id]
      );
    } else {
      const memUser = memoryStore.users.find((u) => u.id === user.id);
      if (memUser) memUser.tokenVersion = (memUser.tokenVersion || 0) + 1;
    }
    return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: 'Não foi possível encerrar a sessão no servidor.' });
  }
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

  const trimmedUsername = username.trim();
  const passwordHash = await bcrypt.hash(password.trim(), 10);
  const id = `user-${Date.now()}`;
  const userRole = role || 'operador';
  const userPerms = Array.isArray(permissions) ? permissions : ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'solicitacoes'];
  const userActive = active !== undefined ? !!active : true;

  if (pool && isDbConnected) {
    try {
      // Verifica duplicação
      const existing = await pool.query('SELECT id FROM system_users WHERE LOWER(username) = LOWER($1)', [trimmedUsername]);
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
  if (memoryStore.users.some(u => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
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
    tokenVersion: 0,
    createdAt: new Date().toISOString(),
  };
  memoryStore.users.push(newUser);
  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, data: safeUser, message: 'Usuário criado com sucesso.' });
});

app.put('/api/users/:id', requirePermission('manage_users'), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const { fullName, email, password, role, permissions, active } = body;

  const usernameProvided = Object.prototype.hasOwnProperty.call(body, 'username');
  const newUsername = usernameProvided ? String(body.username ?? '').trim() : undefined;

  if (usernameProvided) {
    if (
      !newUsername ||
      newUsername.length < 3 ||
      newUsername.length > 100 ||
      !/^[A-Za-z0-9._@-]+$/.test(newUsername)
    ) {
      return res.status(400).json({
        success: false,
        message: 'O nome de usuário deve ter de 3 a 100 caracteres e usar apenas letras, números, ponto, hífen, underline ou @.',
      });
    }
  }

  if (pool && isDbConnected) {
    try {
      const currentRes = await pool.query(
        'SELECT username, role, permissions, active FROM system_users WHERE id = $1',
        [id]
      );
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      }
      const currentUser = currentRes.rows[0];

      // Somente o Super Admin pode alterar o nome de login de um usuário.
      if (
        newUsername !== undefined &&
        newUsername.toLowerCase() !== String(currentUser.username || '').toLowerCase() &&
        (req as any).user?.role !== 'admin'
      ) {
        return res.status(403).json({
          success: false,
          message: 'Apenas o Super Admin pode alterar o nome de login.',
        });
      }

      if (newUsername !== undefined) {
        const duplicate = await pool.query(
          'SELECT id FROM system_users WHERE LOWER(username) = LOWER($1) AND id <> $2',
          [newUsername, id]
        );
        if (duplicate.rows.length > 0) {
          return res.status(409).json({ success: false, message: 'Este nome de usuário já está em uso por outro operador.' });
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      const setField = (column: string, value: any) => {
        values.push(value);
        fields.push(`${column} = $${values.length}`);
      };

      const passwordChanged = Boolean(password && String(password).trim());
      const roleChanged = role !== undefined && role !== currentUser.role;
      const activeChanged = active !== undefined && Boolean(active) !== Boolean(currentUser.active);
      const currentPermissions = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
      const permissionsChanged =
        permissions !== undefined &&
        JSON.stringify([...permissions].sort()) !== JSON.stringify([...currentPermissions].sort());

      if (newUsername !== undefined) setField('username', newUsername);
      if (fullName !== undefined) setField('full_name', String(fullName).trim());
      if (email !== undefined) setField('email', String(email).trim() || null);
      if (role !== undefined) setField('role', role);
      if (permissions !== undefined) setField('permissions', permissions);
      if (active !== undefined) setField('active', active);
      if (passwordChanged) {
        setField('password_hash', await bcrypt.hash(String(password).trim(), 10));
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhuma alteração informada.' });
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE system_users
         SET ${fields.join(', ')}
         WHERE id = $${values.length}
         RETURNING id, username, full_name as "fullName", email, role, permissions, active, created_at as "createdAt"`,
        values
      );

      // Senha, papel, permissões ou status realmente alterados: revoga tokens emitidos antes da mudança.
      // Trocar apenas o nome de login (ou nome/e-mail) mantém a sessão, pois o vínculo do token é pelo ID.
      if (passwordChanged || roleChanged || permissionsChanged || activeChanged) {
        await pool.query(
          'UPDATE system_users SET token_version = token_version + 1 WHERE id = $1',
          [id]
        );
      }

      return res.json({ success: true, data: result.rows[0], message: 'Usuário atualizado com sucesso.' });
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({ success: false, message: 'Este nome de usuário já está em uso por outro operador.' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const user = memoryStore.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

  // Somente o Super Admin pode alterar o nome de login de um usuário.
  if (
    newUsername !== undefined &&
    newUsername.toLowerCase() !== user.username.toLowerCase() &&
    (req as any).user?.role !== 'admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Apenas o Super Admin pode alterar o nome de login.',
    });
  }

  if (newUsername !== undefined) {
    if (memoryStore.users.some(u => u.id !== id && u.username.toLowerCase() === newUsername.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'Este nome de usuário já está em uso por outro operador.' });
    }
    user.username = newUsername;
  }

  const passwordChanged = Boolean(password && String(password).trim());
  const roleChanged = role !== undefined && role !== user.role;
  const activeChanged = active !== undefined && Boolean(active) !== Boolean(user.active);
  const permissionsChanged =
    permissions !== undefined &&
    JSON.stringify([...permissions].sort()) !== JSON.stringify([...(user.permissions || [])].sort());

  if (fullName !== undefined) user.fullName = String(fullName).trim();
  if (email !== undefined) user.email = String(email).trim();
  if (role !== undefined) user.role = role;
  if (permissions !== undefined) user.permissions = permissions;
  if (active !== undefined) user.active = active;
  if (passwordChanged) user.passwordHash = await bcrypt.hash(String(password).trim(), 10);

  if (passwordChanged || roleChanged || permissionsChanged || activeChanged) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

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
const todayISO = (date: Date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
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

function mapRequestRow(row: any) {
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || '');
  const decidedAt = row.decidedAt instanceof Date ? row.decidedAt.toISOString() : row.decidedAt || undefined;
  return {
    id: String(row.id),
    type: row.type,
    requesterId: String(row.requesterId),
    requesterName: String(row.requesterName || ''),
    createdAt,
    status: row.status || 'Pendente de aprovação',
    decidedById: row.decidedById || undefined,
    decidedByName: row.decidedByName || undefined,
    decidedAt,
    rejectionReason: row.rejectionReason || undefined,
    movementIds: Array.isArray(row.movementIds) ? row.movementIds : [],
    data: row.data && typeof row.data === 'object' ? row.data : {},
  };
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
      str(l.planName),
      l.monthlyCost === undefined || l.monthlyCost === null || l.monthlyCost === '' ? null : num(l.monthlyCost),
      str(l.status) || (await getCatalogsFromDb(q)).lineStatuses.find((item) => item.id === 'line-status-available')?.name || 'Disponível',
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
      str(d.status) || (await getCatalogsFromDb(q)).deviceStatuses.find((item) => item.id === 'device-status-available')?.name || 'Disponível',
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

const CATALOG_TYPES = ['departments', 'sectors', 'models', 'brands', 'units', 'accessories', 'lineStatuses', 'deviceStatuses'] as const;
type CatalogType = typeof CATALOG_TYPES[number];
const REQUIRED_STATUS_IDS: Partial<Record<CatalogType, string[]>> = {
  lineStatuses: ['line-status-available', 'line-status-in-use'],
  deviceStatuses: ['device-status-available', 'device-status-in-use'],
};
type CatalogList = Array<{ id: string; name: string }>;
type CatalogRecord = Record<CatalogType, CatalogList>;

const initialCatalogValues: Record<'departments' | 'sectors', string[]> = {
  departments: ['Administrativo', 'Comercial', 'Diretoria', 'Financeiro', 'Industrial', 'Logística', 'Contábil'],
  sectors: ['Administrativo', 'Contabilidade', 'TI', 'Comercial', 'Trade', 'Vendas', 'Diretoria', 'Financeiro', 'Industrial', 'Manutenção', 'Produção', 'Qualidade', 'Suprimentos', 'Logística', 'Transportes', 'Expedição'],
};
const initialAccessories = [
  'Carregador Original', 'Cabo USB-C / Lightning', 'Capa Protetora Anti-Impacto',
  'Película de Vidro Aplicada', 'Chave Ejetora de Chip (SIM)', 'Embalagem / Caixa Original', 'Fone de Ouvido Corporativo',
];
const initialLineStatuses = [
  { id: 'line-status-available', name: 'Disponível' },
  { id: 'line-status-in-use', name: 'Em Uso' },
];
const initialDeviceStatuses = [
  { id: 'device-status-available', name: 'Disponível' },
  { id: 'device-status-in-use', name: 'Em uso' },
  { id: 'device-status-awaiting-evaluation', name: 'Aguardando avaliação' },
  { id: 'device-status-maintenance', name: 'Em manutenção' },
  { id: 'device-status-reserved', name: 'Reservado' },
  { id: 'device-status-awaiting-disposal', name: 'Aguardando baixa patrimonial' },
  { id: 'device-status-disposed', name: 'Baixado' },
  { id: 'device-status-missing', name: 'Extraviado' },
];

const uniqueCatalogItems = (type: CatalogType, names: string[]): CatalogList =>
  Array.from(new Set(names.map((name) => String(name || '').trim()).filter(Boolean)))
    .map((name, index) => ({ id: `catalog-${type}-${index + 1}`, name }));

async function getCatalogsFromDb(q: Queryable): Promise<CatalogRecord> {
  const existing = await q.query('SELECT catalogs FROM system_catalogs WHERE id = $1', ['global']);
  if (existing.rows[0]?.catalogs) {
    const saved = existing.rows[0].catalogs as Partial<CatalogRecord>;
    if (!Array.isArray(saved.accessories) || !Array.isArray(saved.lineStatuses) || !Array.isArray(saved.deviceStatuses)) {
      const migrated = {
        ...saved,
        accessories: saved.accessories || uniqueCatalogItems('accessories', initialAccessories),
        lineStatuses: saved.lineStatuses || initialLineStatuses,
        deviceStatuses: saved.deviceStatuses || initialDeviceStatuses,
      } as CatalogRecord;
      await q.query('UPDATE system_catalogs SET catalogs = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(migrated), 'global']);
      return migrated;
    }
    return saved as CatalogRecord;
  }

  const [brands, models] = await Promise.all([
    q.query('SELECT DISTINCT brand AS name FROM devices WHERE BTRIM(COALESCE(brand, \'\')) <> \'\' ORDER BY name'),
    q.query('SELECT DISTINCT model AS name FROM devices WHERE BTRIM(COALESCE(model, \'\')) <> \'\' ORDER BY name'),
  ]);
  const initial = {
    departments: uniqueCatalogItems('departments', initialCatalogValues.departments),
    sectors: uniqueCatalogItems('sectors', initialCatalogValues.sectors),
    brands: uniqueCatalogItems('brands', brands.rows.map((row: any) => row.name)),
    models: uniqueCatalogItems('models', models.rows.map((row: any) => row.name)),
    units: [],
    accessories: uniqueCatalogItems('accessories', initialAccessories),
    lineStatuses: initialLineStatuses,
    deviceStatuses: initialDeviceStatuses,
  } satisfies CatalogRecord;
  await q.query(
    `INSERT INTO system_catalogs (id, catalogs) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
    ['global', JSON.stringify(initial)]
  );
  const saved = await q.query('SELECT catalogs FROM system_catalogs WHERE id = $1', ['global']);
  return saved.rows[0].catalogs as CatalogRecord;
}

const catalogReferenceTables: Record<CatalogType, Array<{ table: string; condition: string }>> = {
  departments: [
    { table: 'collaborators', condition: `department = $1 OR data->>'department' = $1` },
    { table: 'devices', condition: `data->>'currentDepartment' = $1` },
    { table: 'phone_lines', condition: `data->>'department' = $1` },
  ],
  sectors: [
    { table: 'collaborators', condition: `data->>'sector' = $1` },
    { table: 'devices', condition: `data->>'sector' = $1` },
  ],
  models: [
    { table: 'devices', condition: `model = $1 OR data->>'model' = $1` },
    { table: 'phone_lines', condition: `data->>'associatedDeviceModel' = $1` },
  ],
  brands: [{ table: 'devices', condition: `brand = $1 OR data->>'brand' = $1` }],
  units: [
    { table: 'collaborators', condition: `data->>'unit' = $1` },
    { table: 'devices', condition: `data->>'unit' = $1` },
    { table: 'phone_lines', condition: `data->>'unit' = $1` },
  ],
    accessories: [
      { table: 'movements', condition: `$1 = ANY(COALESCE(accessories_returned, ARRAY[]::text[])) OR data->'accessoriesIncluded' @> jsonb_build_array($1::text)` },
      { table: 'terms_documents', condition: `data->'accessoriesList' @> jsonb_build_array($1::text)` },
    ],
  lineStatuses: [
    { table: 'phone_lines', condition: `status = $1 OR data->>'status' = $1` },
    { table: 'movements', condition: `data->>'previousLineStatus' = $1 OR data->>'newLineStatus' = $1` },
  ],
  deviceStatuses: [
    { table: 'devices', condition: `status = $1 OR data->>'status' = $1` },
    { table: 'movements', condition: `data->>'previousDeviceStatus' = $1 OR data->>'newDeviceStatus' = $1 OR data->'stockTransit'->>'stockStatusAfter' = $1` },
    { table: 'movement_requests', condition: `data->>'destinationStatusAfterReturn' = $1 OR data->>'oldDestinationStatus' = $1` },
  ],
};

async function countCatalogReferences(q: Queryable, type: CatalogType, name: string): Promise<number> {
  let count = 0;
  for (const reference of catalogReferenceTables[type]) {
    const result = await q.query(`SELECT COUNT(*)::int AS count FROM ${reference.table} WHERE ${reference.condition}`, [name]);
    count += Number(result.rows[0]?.count || 0);
  }
  return count;
}

async function renameCatalogReferences(q: Queryable, type: CatalogType, oldName: string, newName: string): Promise<void> {
  const statements: Record<CatalogType, string[]> = {
    departments: [
      `UPDATE collaborators SET department = CASE WHEN department = $1 THEN $2 ELSE department END,
       data = jsonb_set(COALESCE(data, '{}'::jsonb), '{department}', to_jsonb($2::text), true)
       WHERE department = $1 OR data->>'department' = $1`,
      `UPDATE devices SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{currentDepartment}', to_jsonb($2::text), true) WHERE data->>'currentDepartment' = $1`,
      `UPDATE phone_lines SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{department}', to_jsonb($2::text), true) WHERE data->>'department' = $1`,
    ],
    sectors: [
      `UPDATE collaborators SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{sector}', to_jsonb($2::text), true) WHERE data->>'sector' = $1`,
      `UPDATE devices SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{sector}', to_jsonb($2::text), true) WHERE data->>'sector' = $1`,
    ],
    models: [
      `UPDATE devices SET model = CASE WHEN model = $1 THEN $2 ELSE model END,
       data = jsonb_set(COALESCE(data, '{}'::jsonb), '{model}', to_jsonb($2::text), true) WHERE model = $1 OR data->>'model' = $1`,
      `UPDATE phone_lines SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{associatedDeviceModel}', to_jsonb($2::text), true) WHERE data->>'associatedDeviceModel' = $1`,
    ],
    brands: [`UPDATE devices SET brand = CASE WHEN brand = $1 THEN $2 ELSE brand END,
      data = jsonb_set(COALESCE(data, '{}'::jsonb), '{brand}', to_jsonb($2::text), true) WHERE brand = $1 OR data->>'brand' = $1`],
    units: [
      `UPDATE collaborators SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{unit}', to_jsonb($2::text), true) WHERE data->>'unit' = $1`,
      `UPDATE devices SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{unit}', to_jsonb($2::text), true) WHERE data->>'unit' = $1`,
      `UPDATE phone_lines SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{unit}', to_jsonb($2::text), true) WHERE data->>'unit' = $1`,
    ],
    accessories: [
      `UPDATE movements
       SET accessories_returned = array_replace(accessories_returned, $1, $2),
           data = jsonb_set(COALESCE(data, '{}'::jsonb), '{accessoriesIncluded}',
             (SELECT COALESCE(jsonb_agg(to_jsonb(CASE WHEN value = $1 THEN $2 ELSE value END)), '[]'::jsonb)
              FROM jsonb_array_elements_text(COALESCE(data->'accessoriesIncluded', '[]'::jsonb)) AS item(value)), true)
       WHERE $1 = ANY(COALESCE(accessories_returned, ARRAY[]::text[])) OR data->'accessoriesIncluded' @> jsonb_build_array($1::text)`,
      `UPDATE terms_documents
       SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{accessoriesList}',
         (SELECT COALESCE(jsonb_agg(to_jsonb(CASE WHEN value = $1 THEN $2 ELSE value END)), '[]'::jsonb)
          FROM jsonb_array_elements_text(COALESCE(data->'accessoriesList', '[]'::jsonb)) AS item(value)), true)
       WHERE data->'accessoriesList' @> jsonb_build_array($1::text)`,
    ],
    lineStatuses: [
      `UPDATE phone_lines SET status = CASE WHEN status = $1 THEN $2 ELSE status END,
       data = CASE WHEN data->>'status' = $1 THEN jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', to_jsonb($2::text), true) ELSE COALESCE(data, '{}'::jsonb) END
       WHERE status = $1 OR data->>'status' = $1`,
      `UPDATE movements SET data = jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{previousLineStatus}',
       CASE WHEN data->>'previousLineStatus' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'previousLineStatus', 'null'::jsonb) END, true),
       '{newLineStatus}', CASE WHEN data->>'newLineStatus' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'newLineStatus', 'null'::jsonb) END, true)
       WHERE data->>'previousLineStatus' = $1 OR data->>'newLineStatus' = $1`,
    ],
    deviceStatuses: [
      `UPDATE devices SET status = CASE WHEN status = $1 THEN $2 ELSE status END,
       data = CASE WHEN data->>'status' = $1 THEN jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', to_jsonb($2::text), true) ELSE COALESCE(data, '{}'::jsonb) END
       WHERE status = $1 OR data->>'status' = $1`,
      `UPDATE movements SET data = jsonb_set(jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{previousDeviceStatus}',
       CASE WHEN data->>'previousDeviceStatus' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'previousDeviceStatus', 'null'::jsonb) END, true),
       '{newDeviceStatus}', CASE WHEN data->>'newDeviceStatus' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'newDeviceStatus', 'null'::jsonb) END, true),
       '{stockTransit,stockStatusAfter}', CASE WHEN data->'stockTransit'->>'stockStatusAfter' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'stockTransit'->'stockStatusAfter', 'null'::jsonb) END, true)
       WHERE data->>'previousDeviceStatus' = $1 OR data->>'newDeviceStatus' = $1 OR data->'stockTransit'->>'stockStatusAfter' = $1`,
      `UPDATE movement_requests SET data = jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{destinationStatusAfterReturn}',
       CASE WHEN data->>'destinationStatusAfterReturn' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'destinationStatusAfterReturn', 'null'::jsonb) END, true),
       '{oldDestinationStatus}', CASE WHEN data->>'oldDestinationStatus' = $1 THEN to_jsonb($2::text) ELSE COALESCE(data->'oldDestinationStatus', 'null'::jsonb) END, true)
       WHERE data->>'destinationStatusAfterReturn' = $1 OR data->>'oldDestinationStatus' = $1`,
    ],
  };
  for (const statement of statements[type]) await q.query(statement, [oldName, newName]);
}

app.get('/api/catalogs', requireReadAccess, route(async (_req, res) => {
  if (pool && isDbConnected) {
    const catalogs = await getCatalogsFromDb(pool);
    return res.json({ success: true, data: catalogs });
  }
  if (!memoryStore.catalogs) {
    memoryStore.catalogs = {
      departments: uniqueCatalogItems('departments', initialCatalogValues.departments),
      sectors: uniqueCatalogItems('sectors', initialCatalogValues.sectors),
      brands: uniqueCatalogItems('brands', memoryStore.devices.map((device: any) => device.brand)),
      models: uniqueCatalogItems('models', memoryStore.devices.map((device: any) => device.model)),
      units: [],
      accessories: uniqueCatalogItems('accessories', initialAccessories),
      lineStatuses: initialLineStatuses,
      deviceStatuses: initialDeviceStatuses,
    };
  }
  return res.json({ success: true, data: memoryStore.catalogs });
}));

app.put('/api/catalogs/:type', requirePermission('configuracoes'), route(async (req, res) => {
  const type = req.params.type as CatalogType;
  if (!CATALOG_TYPES.includes(type)) throw new HttpError(404, 'Lista de cadastro não encontrada.');
  const rawItems = req.body?.items;
  if (!Array.isArray(rawItems)) throw new HttpError(400, 'Informe a lista de itens.');
  const items: CatalogList = rawItems.map((item: any) => ({ id: str(item?.id) || '', name: str(item?.name) || '' }));
  if (items.some((item) => !item.id || !item.name)) throw new HttpError(400, 'O nome de cada item é obrigatório.');
  const normalizedNames = items.map((item) => item.name.trim().toLocaleLowerCase('pt-BR'));
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new HttpError(409, 'Já existe um item com esse nome nesta lista.');

  if (pool && isDbConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await getCatalogsFromDb(client);
      const currentItems = current[type] || [];
      const nextIds = new Set(items.map((item) => item.id));
      for (const removed of currentItems.filter((item) => !nextIds.has(item.id))) {
        if (REQUIRED_STATUS_IDS[type]?.includes(removed.id)) throw new HttpError(409, `O status operacional "${removed.name}" é obrigatório e não pode ser excluído.`);
        const inUse = await countCatalogReferences(client, type, removed.name);
        if (inUse > 0) throw new HttpError(409, `Não é possível excluir "${removed.name}": está em uso por ${inUse} registro(s).`);
      }
      for (const item of items) {
        const previous = currentItems.find((existing) => existing.id === item.id);
        if (previous && previous.name !== item.name) {
          await renameCatalogReferences(client, type, previous.name, item.name);
        }
      }
      const updated = { ...current, [type]: items } as CatalogRecord;
      await client.query(`UPDATE system_catalogs SET catalogs = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [JSON.stringify(updated), 'global']);
      await client.query('COMMIT');
      return res.json({ success: true, data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const current = memoryStore.catalogs;
  if (!current) throw new HttpError(503, 'Cadastros ainda não foram inicializados.');
  const currentItems = current[type] || [];
  const nextIds = new Set(items.map((item) => item.id));
  for (const removed of currentItems.filter((item) => !nextIds.has(item.id))) {
    if (REQUIRED_STATUS_IDS[type]?.includes(removed.id)) throw new HttpError(409, `O status operacional "${removed.name}" é obrigatório e não pode ser excluído.`);
    const refs = type === 'departments'
      ? memoryStore.collaborators.filter((item: any) => item.department === removed.name).length + memoryStore.devices.filter((item: any) => item.currentDepartment === removed.name).length + memoryStore.lines.filter((item: any) => item.department === removed.name).length
      : type === 'sectors'
      ? memoryStore.collaborators.filter((item: any) => item.sector === removed.name).length + memoryStore.devices.filter((item: any) => item.sector === removed.name).length
      : type === 'models'
      ? memoryStore.devices.filter((item: any) => item.model === removed.name).length + memoryStore.lines.filter((item: any) => item.associatedDeviceModel === removed.name).length
      : type === 'brands'
      ? memoryStore.devices.filter((item: any) => item.brand === removed.name).length
      : type === 'units'
      ? memoryStore.collaborators.filter((item: any) => item.unit === removed.name).length + memoryStore.devices.filter((item: any) => item.unit === removed.name).length + memoryStore.lines.filter((item: any) => item.unit === removed.name).length
      : type === 'lineStatuses'
      ? memoryStore.lines.filter((item: any) => item.status === removed.name).length + memoryStore.movements.filter((item: any) => item.previousLineStatus === removed.name || item.newLineStatus === removed.name).length
      : type === 'deviceStatuses'
      ? memoryStore.devices.filter((item: any) => item.status === removed.name).length + memoryStore.movements.filter((item: any) => item.previousDeviceStatus === removed.name || item.newDeviceStatus === removed.name || item.stockTransit?.stockStatusAfter === removed.name).length + memoryStore.requests.filter((item: any) => item.data?.destinationStatusAfterReturn === removed.name || item.data?.oldDestinationStatus === removed.name).length
      : memoryStore.movements.filter((item: any) => item.accessoriesIncluded?.includes(removed.name)).length + memoryStore.terms.filter((item: any) => item.accessoriesList?.includes(removed.name)).length;
    if (refs > 0) throw new HttpError(409, `Não é possível excluir "${removed.name}": está em uso por ${refs} registro(s).`);
  }
  const renames = currentItems.flatMap((old) => {
    const next = items.find((item) => item.id === old.id);
    return next && next.name !== old.name ? [{ oldName: old.name, newName: next.name }] : [];
  });
  for (const { oldName, newName } of renames) {
    const replace = (records: any[], field: string) => records.forEach((record) => { if (record[field] === oldName) record[field] = newName; });
    if (type === 'departments') { replace(memoryStore.collaborators, 'department'); replace(memoryStore.devices, 'currentDepartment'); replace(memoryStore.lines, 'department'); }
    else if (type === 'sectors') { replace(memoryStore.collaborators, 'sector'); replace(memoryStore.devices, 'sector'); }
    else if (type === 'models') { replace(memoryStore.devices, 'model'); replace(memoryStore.lines, 'associatedDeviceModel'); }
    else if (type === 'brands') replace(memoryStore.devices, 'brand');
    else if (type === 'units') { replace(memoryStore.collaborators, 'unit'); replace(memoryStore.devices, 'unit'); replace(memoryStore.lines, 'unit'); }
    else if (type === 'lineStatuses') {
      replace(memoryStore.lines, 'status');
      for (const movement of memoryStore.movements) {
        if (movement.previousLineStatus === oldName) movement.previousLineStatus = newName;
        if (movement.newLineStatus === oldName) movement.newLineStatus = newName;
      }
    } else if (type === 'deviceStatuses') {
      replace(memoryStore.devices, 'status');
      for (const movement of memoryStore.movements) {
        if (movement.previousDeviceStatus === oldName) movement.previousDeviceStatus = newName;
        if (movement.newDeviceStatus === oldName) movement.newDeviceStatus = newName;
        if (movement.stockTransit?.stockStatusAfter === oldName) movement.stockTransit.stockStatusAfter = newName;
      }
      for (const request of memoryStore.requests) {
        if (request.data?.destinationStatusAfterReturn === oldName) request.data.destinationStatusAfterReturn = newName;
        if (request.data?.oldDestinationStatus === oldName) request.data.oldDestinationStatus = newName;
      }
    }
    else {
      for (const movement of memoryStore.movements) if (Array.isArray(movement.accessoriesIncluded)) movement.accessoriesIncluded = movement.accessoriesIncluded.map((value: string) => value === oldName ? newName : value);
      for (const term of memoryStore.terms) if (Array.isArray(term.accessoriesList)) term.accessoriesList = term.accessoriesList.map((value: string) => value === oldName ? newName : value);
    }
  }
  memoryStore.catalogs = { ...current, [type]: items };
  return res.json({ success: true, data: memoryStore.catalogs });
}));

app.get('/api/devices', requireReadAccess, route(async (_req, res) => {
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

app.post('/api/devices', requirePermission('dispositivos_edit'), route(async (req, res) => {
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

app.delete('/api/devices/:id', requirePermission('dispositivos_edit'), async (req, res) => {
  // Exclusão de aparelho é exclusiva do Super Admin (validado também na interface).
  if ((req as any).user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Apenas o Super Admin pode remover aparelhos.' });
  }
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
app.get('/api/lines', requireReadAccess, route(async (_req, res) => {
  if (pool && isDbConnected) {
    const result = await pool.query(`
      SELECT
        l.id, l.phone_number as "phoneNumber", l.operator as "carrier", l.account_number as "accountNumber",
        l.plan_name as "planName", l.monthly_cost as "monthlyCost", l.status,
        l.current_device_id as "associatedDeviceId",
        d.tag as "associatedDeviceTag",
        d.model as "associatedDeviceModel",
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

app.post('/api/lines', requirePermission('linhas_edit'), route(async (req, res) => {
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

app.delete('/api/lines/:id', requirePermission('linhas_edit'), async (req, res) => {
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
app.get('/api/collaborators', requireReadAccess, route(async (_req, res) => {
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

app.post('/api/collaborators', requirePermission('colaboradores_edit'), route(async (req, res) => {
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

app.delete('/api/collaborators/:id', requirePermission('colaboradores_edit'), async (req, res) => {
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

// Solicitações de movimentação são registros independentes; nenhuma rota executa alterações patrimoniais.
const REQUEST_TYPES = ['Entrega', 'Devolução', 'Transferência', 'Troca de Aparelho'] as const;

app.get('/api/requests', requireRequestsAccess, route(async (req, res) => {
  const user = (req as any).user;
  const seeAll = canViewAllRequests(user.role);
  if (pool && isDbConnected) {
    const result = seeAll
        ? await pool.query(`
          SELECT id, request_type as type, created_by_id as "requesterId",
                 requester_name as "requesterName", created_at as "createdAt", status,
                 decided_by_id as "decidedById", decided_by_name as "decidedByName",
                 decided_at as "decidedAt", rejection_reason as "rejectionReason",
                 movement_ids as "movementIds", data
          FROM movement_requests ORDER BY created_at DESC
        `)
      : await pool.query(`
          SELECT id, request_type as type, created_by_id as "requesterId",
                 requester_name as "requesterName", created_at as "createdAt", status,
                 decided_by_id as "decidedById", decided_by_name as "decidedByName",
                 decided_at as "decidedAt", rejection_reason as "rejectionReason",
                 movement_ids as "movementIds", data
          FROM movement_requests WHERE created_by_id = $1 ORDER BY created_at DESC
        `, [user.id]);
    return res.json({ success: true, data: result.rows.map(mapRequestRow) });
  }

  const rows = seeAll
    ? memoryStore.requests
    : memoryStore.requests.filter((request) => request.requesterId === user.id);
  return res.json({
    success: true,
    data: [...rows]
      .map((request) => ({ ...request, status: request.status || 'Pendente de aprovação', movementIds: request.movementIds || [] }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  });
}));

app.post('/api/requests', requireRequestsAccess, route(async (req, res) => {
  const user = (req as any).user;
  const requestType = req.body?.type;
  const submittedData = req.body?.data;
  if (!REQUEST_TYPES.includes(requestType)) throw new HttpError(400, 'Tipo de solicitação inválido.');
  if (!submittedData || typeof submittedData !== 'object' || Array.isArray(submittedData)) {
    throw new HttpError(400, 'Informe os dados da solicitação.');
  }

  const data: Record<string, any> = { ...submittedData };
  if (requestType === 'Entrega') {
    data.deliveryDate = str(data.deliveryDate);
    const cpfDigits = String(data.cpf || '').replace(/\D/g, '');
    if (!str(data.employeeName) || !str(data.position) || cpfDigits.length !== 11) {
      throw new HttpError(400, 'Informe nome, CPF com 11 dígitos e cargo do funcionário.');
    }
    if (!['Sim', 'Não'].includes(data.isNewLine)) throw new HttpError(400, 'Informe se a linha é nova.');
    data.cpf = cpfDigits;
    if (data.isNewLine === 'Não') {
      if (!str(data.lineId)) throw new HttpError(400, 'Selecione a linha cadastrada.');
      let line: any;
      if (pool && isDbConnected) {
        const lineResult = await pool.query(
          'SELECT id, phone_number as "phoneNumber", operator as carrier, data FROM phone_lines WHERE id = $1',
          [data.lineId]
        );
        line = lineResult.rows[0] ? mergeRow(lineResult.rows[0]) : undefined;
      } else {
        line = memoryStore.lines.find((item: any) => item.id === data.lineId);
      }
      if (!line) throw new HttpError(400, 'A linha selecionada não foi encontrada.');
      let digits = String(line.phoneNumber || '').replace(/\D/g, '');
      if (digits.startsWith('0055')) digits = digits.slice(4);
      else if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
      digits = digits.replace(/^0+/, '');
      data.lineNumber = line.phoneNumber;
      data.lineCarrier = line.carrier;
      data.lineDdd = digits.length >= 10 ? digits.slice(0, 2) : '';
    } else {
      delete data.lineId;
      delete data.lineNumber;
      delete data.lineCarrier;
      delete data.lineDdd;
    }
  } else if (requestType === 'Devolução') {
    if (!str(data.collaboratorId)) throw new HttpError(400, 'Selecione o colaborador cadastrado.');
    const collaboratorId = str(data.collaboratorId);
    let collaborator: any;
    let lines: any[];
    let devices: any[];
    if (pool && isDbConnected) {
      const [collabResult, linesResult, devicesResult] = await Promise.all([
        pool.query(
          'SELECT id, name as "fullName", department, role as position, data FROM collaborators WHERE id = $1',
          [collaboratorId]
        ),
        pool.query(
          'SELECT id, phone_number as "phoneNumber", operator as carrier, data FROM phone_lines WHERE current_collaborator_id = $1 ORDER BY phone_number',
          [collaboratorId]
        ),
        pool.query(
          'SELECT id, tag as "assetTag", brand, model, imei_1 as imei1, data FROM devices WHERE current_collaborator_id = $1 ORDER BY tag',
          [collaboratorId]
        ),
      ]);
      collaborator = collabResult.rows[0] ? mergeRow(collabResult.rows[0]) : undefined;
      lines = linesResult.rows.map(mergeRow);
      devices = devicesResult.rows.map(mergeRow);
    } else {
      collaborator = memoryStore.collaborators.find((item: any) => item.id === collaboratorId);
      lines = memoryStore.lines.filter((item: any) => item.currentCollaboratorId === collaboratorId);
      devices = memoryStore.devices.filter((item: any) => item.currentCollaboratorId === collaboratorId);
    }
    if (!collaborator) throw new HttpError(400, 'O colaborador selecionado não foi encontrado.');

    data.collaboratorId = collaborator.id;
    data.collaboratorName = collaborator.fullName ?? collaborator.name ?? '';
    data.department = collaborator.department || '';
    data.position = collaborator.position ?? collaborator.role ?? '';
    data.sector = collaborator.sector || '';
    data.lines = lines.map((line) => ({
      id: line.id,
      phoneNumber: line.phoneNumber || '',
      carrier: line.carrier || '',
    }));
    data.devices = devices.map((device) => ({
      id: device.id,
      assetTag: device.assetTag || '',
      brand: device.brand || '',
      model: device.model || '',
      imei1: device.imei1 || '',
    }));
    // Datas são editáveis e pertencem ao formulário; os dados cadastrais acima são reconstruídos no servidor.
    data.plannedReturnDate = str(submittedData.plannedReturnDate);
    delete data.estimatedDeliveryDate;
  } else if (requestType === 'Transferência') {
    if (!str(data.originCollaboratorId) || !str(data.deviceId) || !str(data.destinationCollaboratorId)) {
      throw new HttpError(400, 'Informe colaboradores de origem/destino e aparelho para a transferência.');
    }
    if (data.originCollaboratorId === data.destinationCollaboratorId) {
      throw new HttpError(400, 'Os colaboradores de origem e destino devem ser diferentes.');
    }
  } else if (requestType === 'Troca de Aparelho') {
    if (!str(data.collaboratorId) || !str(data.oldDeviceId) || !str(data.newDeviceId)) {
      throw new HttpError(400, 'Informe colaborador, aparelho antigo e aparelho novo para a troca.');
    }
    if (data.oldDeviceId === data.newDeviceId) throw new HttpError(400, 'Os aparelhos antigo e novo devem ser diferentes.');
  }

  const requestRecord = {
    id: `request-${Date.now()}-${randomBytes(4).toString('hex')}`,
    type: requestType,
    requesterId: String(user.id),
    requesterName: str(user.fullName) || str(user.username) || 'Usuário',
    createdAt: new Date().toISOString(),
    status: 'Pendente de aprovação',
    movementIds: [],
    data,
  };

  if (pool && isDbConnected) {
    const result = await pool.query(
      `INSERT INTO movement_requests (id, request_type, created_by_id, requester_name, created_at, data, status, movement_ids)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5::jsonb, 'Pendente de aprovação', ARRAY[]::TEXT[])
       RETURNING id, request_type as type, created_by_id as "requesterId",
                 requester_name as "requesterName", created_at as "createdAt", status,
                 decided_by_id as "decidedById", decided_by_name as "decidedByName",
                 decided_at as "decidedAt", rejection_reason as "rejectionReason",
                 movement_ids as "movementIds", data`,
      [requestRecord.id, requestRecord.type, requestRecord.requesterId, requestRecord.requesterName, JSON.stringify(data)]
    );
    return res.status(201).json({ success: true, data: mapRequestRow(result.rows[0]) });
  }

  memoryStore.requests.unshift(requestRecord);
  return res.status(201).json({ success: true, data: requestRecord });
}));

app.post('/api/requests/:id/reject', requireRequestApprover, route(async (req, res) => {
  const user = (req as any).user;
  const requestId = String(req.params.id || '');
  const reason = (str(req.body?.reason) || '').trim();

  if (pool && isDbConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id, request_type as type, created_by_id as "requesterId",
                requester_name as "requesterName", created_at as "createdAt", status,
                decided_by_id as "decidedById", decided_by_name as "decidedByName",
                decided_at as "decidedAt", rejection_reason as "rejectionReason",
                movement_ids as "movementIds", data
         FROM movement_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );
      if (!current.rows[0]) throw new HttpError(404, 'Solicitação não encontrada.');
      if (current.rows[0].status !== 'Pendente de aprovação') {
        throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser alterada novamente.');
      }
      const updated = await client.query(
        `UPDATE movement_requests
         SET status = 'Recusada', decided_by_id = $2, decided_by_name = $3,
             decided_at = CURRENT_TIMESTAMP, rejection_reason = NULLIF($4, '')
         WHERE id = $1 AND status = 'Pendente de aprovação'
         RETURNING id, request_type as type, created_by_id as "requesterId",
                   requester_name as "requesterName", created_at as "createdAt", status,
                   decided_by_id as "decidedById", decided_by_name as "decidedByName",
                   decided_at as "decidedAt", rejection_reason as "rejectionReason",
                   movement_ids as "movementIds", data`,
        [requestId, String(user.id), str(user.fullName) || str(user.username), reason]
      );
      if (!updated.rows[0]) throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser alterada novamente.');
      await client.query('COMMIT');
      return res.json({ success: true, data: mapRequestRow(updated.rows[0]) });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* já encerrada */ }
      throw error;
    } finally {
      client.release();
    }
  }

  const requestIndex = memoryStore.requests.findIndex((item: any) => item.id === requestId);
  if (requestIndex < 0) throw new HttpError(404, 'Solicitação não encontrada.');
  const request = memoryStore.requests[requestIndex];
  if ((request.status || 'Pendente de aprovação') !== 'Pendente de aprovação') {
    throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser alterada novamente.');
  }
  const decidedRequest = {
    ...request,
    status: 'Recusada',
    decidedById: String(user.id),
    decidedByName: str(user.fullName) || str(user.username),
    decidedAt: new Date().toISOString(),
    rejectionReason: reason || undefined,
  };
  memoryStore.requests[requestIndex] = decidedRequest;
  return res.json({ success: true, data: decidedRequest });
}));

app.post('/api/requests/:id/approve', requireRequestApprover, route(async (req, res) => {
  const user = (req as any).user;
  const requestId = String(req.params.id || '');
  const devices = Array.isArray(req.body?.devices) ? req.body.devices : [];
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  const movements = Array.isArray(req.body?.movements) ? req.body.movements : [];
  const auditLogs = Array.isArray(req.body?.auditLogs) ? req.body.auditLogs : [];
  const expected = req.body?.expected || {};
  if (movements.length === 0) throw new HttpError(400, 'A aprovação precisa registrar ao menos uma movimentação.');

  if (pool && isDbConnected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT id, request_type as type, created_by_id as "requesterId",
                requester_name as "requesterName", created_at as "createdAt", status,
                decided_by_id as "decidedById", decided_by_name as "decidedByName",
                decided_at as "decidedAt", rejection_reason as "rejectionReason",
                movement_ids as "movementIds", data
         FROM movement_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );
      if (!current.rows[0]) throw new HttpError(404, 'Solicitação não encontrada.');
      if (current.rows[0].status !== 'Pendente de aprovação') {
        throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser aprovada novamente.');
      }
      if (current.rows[0].type !== req.body?.type) throw new HttpError(400, 'O fluxo enviado não corresponde ao tipo da solicitação.');

      for (const expectedDevice of Array.isArray(expected.devices) ? expected.devices : []) {
        const fresh = await client.query(
          `SELECT status, current_collaborator_id as "currentCollaboratorId",
                  current_line_id as "associatedLineId" FROM devices WHERE id = $1 FOR UPDATE`,
          [expectedDevice.id]
        );
        const row = fresh.rows[0];
        if (!row || row.status !== expectedDevice.status ||
            String(row.currentCollaboratorId || '') !== String(expectedDevice.currentCollaboratorId || '') ||
            String(row.associatedLineId || '') !== String(expectedDevice.associatedLineId || '')) {
          throw new HttpError(409, 'Os dados do aparelho mudaram após a abertura do modal. Atualize a tela e tente novamente.');
        }
      }
      for (const expectedLine of Array.isArray(expected.lines) ? expected.lines : []) {
        const fresh = await client.query(
          `SELECT status, current_collaborator_id as "currentCollaboratorId",
                  current_device_id as "associatedDeviceId" FROM phone_lines WHERE id = $1 FOR UPDATE`,
          [expectedLine.id]
        );
        const row = fresh.rows[0];
        if (!row || row.status !== expectedLine.status ||
            String(row.currentCollaboratorId || '') !== String(expectedLine.currentCollaboratorId || '') ||
            String(row.associatedDeviceId || '') !== String(expectedLine.associatedDeviceId || '')) {
          throw new HttpError(409, 'Os dados da linha mudaram após a abertura do modal. Atualize a tela e tente novamente.');
        }
      }

      const movementIds = movements.map((movement: any) => String(movement.id));
      const approvedAt = new Date().toISOString();
      const approverName = str(user.fullName) || str(user.username);
      const requestApproval = {
        requestId,
        requestType: current.rows[0].type,
        requesterName: current.rows[0].requesterName,
        requestedAt: current.rows[0].createdAt instanceof Date
          ? current.rows[0].createdAt.toISOString()
          : String(current.rows[0].createdAt),
        approverName,
        approvedAt,
        primaryMovementId: movementIds[0],
      };
      const approvedMovements = movements.map((movement: any) => ({ ...movement, requestApproval }));

      for (const device of devices) await upsertDevice(client, device);
      for (const line of lines) await upsertLine(client, line);
      for (const movement of approvedMovements) await upsertMovement(client, movement);
      for (const audit of auditLogs) await insertAudit(client, { ...audit, user: str(user.fullName) || str(user.username) });

      const updated = await client.query(
        `UPDATE movement_requests
         SET status = 'Aprovada', decided_by_id = $2, decided_by_name = $3,
             decided_at = $5::TIMESTAMP WITH TIME ZONE, movement_ids = $4::TEXT[]
         WHERE id = $1 AND status = 'Pendente de aprovação'
         RETURNING id, request_type as type, created_by_id as "requesterId",
                   requester_name as "requesterName", created_at as "createdAt", status,
                   decided_by_id as "decidedById", decided_by_name as "decidedByName",
                   decided_at as "decidedAt", rejection_reason as "rejectionReason",
                   movement_ids as "movementIds", data`,
         [requestId, String(user.id), approverName, movementIds, approvedAt]
      );
      if (!updated.rows[0]) throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser aprovada novamente.');
      await client.query('COMMIT');
      return res.json({ success: true, data: {
        request: mapRequestRow(updated.rows[0]), devices, lines, movements: approvedMovements,
      } });
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* já encerrada */ }
      throw error;
    } finally {
      client.release();
    }
  }

  const request = memoryStore.requests.find((item: any) => item.id === requestId);
  if (!request) throw new HttpError(404, 'Solicitação não encontrada.');
  if ((request.status || 'Pendente de aprovação') !== 'Pendente de aprovação') {
    throw new HttpError(409, 'Esta solicitação já foi decidida e não pode ser aprovada novamente.');
  }
  if (request.type !== req.body?.type) throw new HttpError(400, 'O fluxo enviado não corresponde ao tipo da solicitação.');
  for (const expectedDevice of Array.isArray(expected.devices) ? expected.devices : []) {
    const row = memoryStore.devices.find((item: any) => item.id === expectedDevice.id);
    if (!row || row.status !== expectedDevice.status ||
        String(row.currentCollaboratorId || '') !== String(expectedDevice.currentCollaboratorId || '') ||
        String(row.associatedLineId || '') !== String(expectedDevice.associatedLineId || '')) {
      throw new HttpError(409, 'Os dados do aparelho mudaram após a abertura do modal. Atualize a tela e tente novamente.');
    }
  }
  for (const expectedLine of Array.isArray(expected.lines) ? expected.lines : []) {
    const row = memoryStore.lines.find((item: any) => item.id === expectedLine.id);
    if (!row || row.status !== expectedLine.status ||
        String(row.currentCollaboratorId || '') !== String(expectedLine.currentCollaboratorId || '') ||
        String(row.associatedDeviceId || '') !== String(expectedLine.associatedDeviceId || '')) {
      throw new HttpError(409, 'Os dados da linha mudaram após a abertura do modal. Atualize a tela e tente novamente.');
    }
  }
  const replaceById = (target: any[], incoming: any[]) => {
    for (const item of incoming) {
      const index = target.findIndex((existing) => existing.id === item.id);
      if (index < 0) target.unshift(item);
      else target[index] = { ...target[index], ...item };
    }
  };
  const approvedAt = new Date().toISOString();
  const approverName = str(user.fullName) || str(user.username);
  const movementIds = movements.map((movement: any) => String(movement.id));
  const requestApproval = {
    requestId,
    requestType: request.type,
    requesterName: request.requesterName,
    requestedAt: request.createdAt,
    approverName,
    approvedAt,
    primaryMovementId: movementIds[0],
  };
  const approvedMovements = movements.map((movement: any) => ({ ...movement, requestApproval }));

  replaceById(memoryStore.devices, devices);
  replaceById(memoryStore.lines, lines);
  replaceById(memoryStore.movements, approvedMovements);
  replaceById(memoryStore.auditLogs, auditLogs.map((audit: any) => ({ ...audit, user: str(user.fullName) || str(user.username) })));
  const decidedRequest = {
    ...request,
    status: 'Aprovada',
    decidedById: String(user.id),
    decidedByName: approverName,
    decidedAt: approvedAt,
    movementIds,
  };
  const index = memoryStore.requests.findIndex((item: any) => item.id === requestId);
  memoryStore.requests[index] = decidedRequest;
  return res.json({ success: true, data: { request: decidedRequest, devices, lines, movements: approvedMovements } });
}));

// 7. Movimentações Patrimoniais
app.get('/api/movements', requireReadAccess, route(async (_req, res) => {
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

app.post('/api/movements', requirePermission('movimentacoes'), route(async (req, res) => {
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
app.post('/api/movements/transfer', requirePermission('movimentacoes'), async (req, res) => {
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
    const STOCK_LABEL = 'Estoque';
    const catalogs = await getCatalogsFromDb(client);
    const availableDeviceStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-available')?.name || 'Disponível';
    const inUseDeviceStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-in-use')?.name || 'Em uso';

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
    if (stockDestinationStatus === availableDeviceStatus) {
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
        SET status = $4,
            current_collaborator_id = $1,
            condition = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [destinationCollaboratorId, conditionAtEvaluation, device.id, inUseDeviceStatus]);
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
      message: stockDestinationStatus === availableDeviceStatus
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
app.get('/api/terms', requireReadAccess, route(async (_req, res) => {
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

app.post('/api/terms', requirePermission('termos'), route(async (req, res) => {
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
app.get('/api/terms/:id/file', requireReadAccess, route(async (req, res) => {
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
app.get('/api/audit-logs', requireReadAccess, route(async (_req, res) => {
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

// 10. Trilha de Auditoria
app.post('/api/audit-logs', route(async (req, res) => {
  // O autor da ação vem do token autenticado — nunca do corpo enviado pelo cliente.
  const authenticatedUser = (req as any).user;
  const a = {
    ...(req.body || {}),
    id: req.body?.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user: authenticatedUser?.fullName || authenticatedUser?.username || 'Operador',
  };

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

  const rejected: { entity: string; id: string; label: string; message: string }[] = [];
  const saved = { collaborators: 0, lines: 0, devices: 0, movements: 0, terms: 0, auditLogs: 0 };

  // RBAC no lote: o login de qualquer usuário envia a base local inteira. Só são
  // gravadas as entidades para as quais o usuário tem permissão de escrita.
  const authenticatedUser = (req as any).user;
  const userPerms: string[] = Array.isArray(authenticatedUser?.permissions)
    ? authenticatedUser.permissions
    : [];
  const canWrite = (permission: string) =>
    authenticatedUser?.role === 'admin' ||
    userPerms.includes('all') ||
    userPerms.includes(permission);
  const allowed = {
    collaborators: canWrite('colaboradores_edit'),
    lines: canWrite('linhas_edit'),
    devices: canWrite('dispositivos_edit'),
    movements: canWrite('movimentacoes'),
    terms: canWrite('termos'),
    auditLogs: true,
  };
  const skipped: { entity: string; count: number; reason: string }[] = [];
  const auditUser =
    authenticatedUser?.fullName || authenticatedUser?.username || 'Operador';

  if (!pool || !isDbConnected) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new HttpError(503, 'Banco de dados PostgreSQL indisponível. Nada foi gravado.');
    }
    // Modo contingência: nada é persistido no servidor (os dados continuam no navegador),
    // mas a resposta mantém o mesmo formato do modo PostgreSQL para o front-end.
    const payloadByEntity: Record<string, any> = { collaborators, lines, devices, movements, terms };
    for (const [entity, items] of Object.entries(payloadByEntity)) {
      if (Array.isArray(items) && items.length > 0 && !allowed[entity as keyof typeof allowed]) {
        skipped.push({
          entity,
          count: items.length,
          reason: 'Usuário sem permissão de escrita neste módulo.',
        });
      }
    }
    const accepted = (entity: keyof typeof saved, items: any) =>
      allowed[entity] && Array.isArray(items) ? items.length : 0;
    return res.json({
      success: true,
      message: 'Dados mantidos em modo contingência/memória.',
      data: {
        saved: {
          collaborators: accepted('collaborators', collaborators),
          lines: accepted('lines', lines),
          devices: accepted('devices', devices),
          movements: accepted('movements', movements),
          terms: accepted('terms', terms),
          auditLogs: Array.isArray(auditLogs) ? auditLogs.length : 0,
        },
        rejected: [],
        skipped,
      },
    });
  }

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
      if (!allowed[entity]) {
        if (items.length > 0) {
          skipped.push({
            entity,
            count: items.length,
            reason: 'Usuário sem permissão de escrita neste módulo.',
          });
        }
        return;
      }
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
    await run('auditLogs', auditLogs, a => a.id, a => insertAudit(client, { ...a, user: auditUser }));

    await client.query('COMMIT');
    console.log(`✅ [PostgreSQL] Lote (${overwrite ? 'overwrite' : 'insert-missing'}): ${JSON.stringify(saved)}; rejeitados: ${rejected.length}; ignorados: ${skipped.length}`);
    return res.json({
      success: true,
      message: rejected.length
        ? `${rejected.length} registro(s) foram rejeitados pelo banco de dados.`
        : 'Dados sincronizados com o PostgreSQL com sucesso!',
      data: { saved, rejected, skipped },
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
      await client.query('TRUNCATE TABLE movements, movement_requests, terms_documents, audit_logs CASCADE;');
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
  memoryStore.requests = [];
  res.json({ success: true, message: 'Base de dados local zerada com sucesso.' });
});

// 13. Backup do PostgreSQL (cópias completas em arquivo JSON no servidor)
app.get('/api/backup', requireAdmin, async (_req, res) => {
  const backups = await listBackups();
  res.json({
    success: true,
    data: {
      backups,
      intervalHours: BACKUP_INTERVAL_HOURS,
      retention: BACKUP_RETENTION,
    },
  });
});

app.post('/api/backup', requireAdmin, async (_req, res) => {
  try {
    const info = await createDatabaseBackup('manual');
    return res.status(201).json({
      success: true,
      data: info,
      message: `Backup ${info.fileName} criado com sucesso.`,
    });
  } catch (err: any) {
    return res.status(err?.status || 503).json({
      success: false,
      message: err?.message || 'Não foi possível gerar o backup no servidor.',
    });
  }
});

app.get('/api/backup/:fileName', requireAdmin, async (req, res) => {
  const rawName = req.params.fileName || '';
  const fileName = path.basename(rawName);

  if (
    fileName !== rawName ||
    !/^iane-backup-(manual|scheduled)-[A-Za-z0-9._-]+\.json$/.test(fileName)
  ) {
    return res.status(400).json({ success: false, message: 'Nome de backup inválido.' });
  }

  const fullPath = path.join(BACKUP_DIR, fileName);
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
  } catch {
    return res.status(404).json({ success: false, message: 'Backup não encontrado.' });
  }

  return res.download(fullPath, fileName);
});

// ----------------------------------------------------------------------------
// Integração Frontend: Vite Middleware (Dev) ou Arquivos Estáticos (Prod)
// ----------------------------------------------------------------------------
async function startServer(): Promise<import('http').Server> {
  if (process.env.SKIP_VITE !== 'true') {
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
  } else {
    console.log('ℹ️ [Vite] Frontend ignorado (SKIP_VITE=true). API disponível.');
  }

  return new Promise((resolve) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [IANE - Gestão de Dispositivos] Servidor ativo em http://0.0.0.0:${PORT}`);
      resolve(server);
    });
  });
}

// Em testes (NODE_ENV=test) o servidor só é iniciado quando o teste chamar startServer(),
// permitindo usar porta efêmera e encerrar o processo sem travar a suíte.
if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app, startServer };

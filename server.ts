/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'iane_telecom_asset_secret_key_2026';

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

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
  });

  pool.connect()
    .then(async (client) => {
      isDbConnected = true;
      console.log('✅ [PostgreSQL] Conexão com o banco de dados corporativo estabelecida com sucesso!');
      await autoMigrateDatabase(client);
      client.release();
    })
    .catch((err) => {
      console.warn('⚠️ [PostgreSQL] Não foi possível conectar ao banco via DATABASE_URL:', err.message);
      console.warn('💡 O sistema permanecerá ativo respondendo via camada de persistência local/memória.');
    });
} else {
  console.log('ℹ️ [PostgreSQL] DATABASE_URL não definida. Modo local habilitado.');
}

// ----------------------------------------------------------------------------
// Middleware de Autenticação JWT
// ----------------------------------------------------------------------------
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continua sem user autenticado
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (!err && decoded) {
      (req as any).user = decoded;
    }
    next();
  });
}

app.use(authenticateToken);

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

          const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

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
      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, user: userPayload, token });
    }
  }

  return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
});

// 3. Gestão de Usuários (RBAC / CRUD de Operadores)
app.get('/api/users', async (_req, res) => {
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

app.post('/api/users', async (req, res) => {
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

app.put('/api/users/:id', async (req, res) => {
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

app.delete('/api/users/:id', async (req, res) => {
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
app.get('/api/devices', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
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
          d.created_at as "createdAt", d.updated_at as "updatedAt"
        FROM devices d
        LEFT JOIN collaborators c ON d.current_collaborator_id = c.id
        LEFT JOIN phone_lines l ON d.current_line_id = l.id
        ORDER BY d.tag ASC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.devices });
});

app.post('/api/devices', async (req, res) => {
  const d = req.body;
  const id = d.id || `dev-${Date.now()}`;

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO devices (id, tag, brand, model, imei_1, imei_2, serial_number, purchase_value, purchase_date, condition, status, current_collaborator_id, current_line_id, stock_custody_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          tag = EXCLUDED.tag,
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          imei_1 = EXCLUDED.imei_1,
          imei_2 = EXCLUDED.imei_2,
          serial_number = EXCLUDED.serial_number,
          purchase_value = EXCLUDED.purchase_value,
          purchase_date = EXCLUDED.purchase_date,
          condition = EXCLUDED.condition,
          status = EXCLUDED.status,
          current_collaborator_id = EXCLUDED.current_collaborator_id,
          current_line_id = EXCLUDED.current_line_id,
          stock_custody_notes = EXCLUDED.stock_custody_notes,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const values = [
        id,
        d.assetTag || d.tag,
        d.brand,
        d.model,
        d.imei1,
        d.imei2 || null,
        d.serialNumber,
        d.purchaseValue || 0,
        d.purchaseDate || null,
        d.condition || 'Novo',
        d.status || 'Disponível',
        d.currentCollaboratorId || null,
        d.associatedLineId || null,
        d.notes || d.stockCustodyNotes || null,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const existingIndex = memoryStore.devices.findIndex(x => x.id === id);
  if (existingIndex >= 0) {
    memoryStore.devices[existingIndex] = { ...memoryStore.devices[existingIndex], ...d, id };
  } else {
    memoryStore.devices.push({ ...d, id });
  }
  res.status(201).json({ success: true, data: d });
});

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
app.get('/api/lines', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
      const result = await pool.query(`
        SELECT 
          l.id, l.phone_number as "phoneNumber", l.operator as "carrier", l.account_number as "accountNumber",
          l.plan_name as "planName", l.monthly_cost as "monthlyCost", l.status,
          l.current_device_id as "associatedDeviceId",
          d.tag as "associatedDeviceTag",
          d.model as "associatedDeviceModel",
          l.current_collaborator_id as "currentCollaboratorId",
          c.name as "currentCollaboratorName",
          l.notes, l.updated_at as "updatedAt"
        FROM phone_lines l
        LEFT JOIN devices d ON l.current_device_id = d.id
        LEFT JOIN collaborators c ON l.current_collaborator_id = c.id
        ORDER BY l.phone_number ASC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.lines });
});

app.post('/api/lines', async (req, res) => {
  const l = req.body;
  const id = l.id || `line-${Date.now()}`;

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO phone_lines (id, phone_number, operator, account_number, plan_name, monthly_cost, status, current_device_id, current_collaborator_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          phone_number = EXCLUDED.phone_number,
          operator = EXCLUDED.operator,
          account_number = EXCLUDED.account_number,
          plan_name = EXCLUDED.plan_name,
          monthly_cost = EXCLUDED.monthly_cost,
          status = EXCLUDED.status,
          current_device_id = EXCLUDED.current_device_id,
          current_collaborator_id = EXCLUDED.current_collaborator_id,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const values = [
        id,
        l.phoneNumber,
        l.carrier || l.operator || 'Vivo',
        l.accountNumber || null,
        l.planName || 'Corporativo',
        l.monthlyCost || 0,
        l.status || 'Disponível',
        l.associatedDeviceId || null,
        l.currentCollaboratorId || null,
        l.notes || null,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const existingIdx = memoryStore.lines.findIndex(x => x.id === id);
  if (existingIdx >= 0) {
    memoryStore.lines[existingIdx] = { ...memoryStore.lines[existingIdx], ...l, id };
  } else {
    memoryStore.lines.push({ ...l, id });
  }
  res.status(201).json({ success: true, data: l });
});

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
app.get('/api/collaborators', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
      const result = await pool.query(`
        SELECT 
          id, name as "fullName", registration_id as "registrationNumber",
          department, role as "position", email as "corporateEmail",
          phone as "contactPhone", active, created_at as "createdAt"
        FROM collaborators
        ORDER BY name ASC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.collaborators });
});

app.post('/api/collaborators', async (req, res) => {
  const c = req.body;
  const id = c.id || `collab-${Date.now()}`;

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO collaborators (id, name, registration_id, department, role, email, phone, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          registration_id = EXCLUDED.registration_id,
          department = EXCLUDED.department,
          role = EXCLUDED.role,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          active = EXCLUDED.active
        RETURNING *;
      `;
      const values = [
        id,
        c.fullName || c.name,
        c.registrationNumber || c.registration_id,
        c.department || 'Geral',
        c.position || c.role || 'Colaborador',
        c.corporateEmail || c.email || null,
        c.contactPhone || c.phone || null,
        c.status === 'Ativo' || c.active !== false,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Fallback
  const existingIdx = memoryStore.collaborators.findIndex(x => x.id === id);
  if (existingIdx >= 0) {
    memoryStore.collaborators[existingIdx] = { ...memoryStore.collaborators[existingIdx], ...c, id };
  } else {
    memoryStore.collaborators.push({ ...c, id });
  }
  res.status(201).json({ success: true, data: c });
});

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
app.get('/api/movements', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
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
          document_term_id as "documentId", stock_transit as "stockTransit",
          created_at as "createdAt"
        FROM movements
        ORDER BY created_at DESC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.movements });
});

app.post('/api/movements', async (req, res) => {
  const m = req.body;
  const id = m.id || `mov-${Date.now()}`;

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO movements (
          id, batch_operation_id, flow_type, device_id, device_tag, device_model, device_imei,
          origin_collaborator_id, origin_collaborator_name, destination_collaborator_id, destination_collaborator_name,
          movement_type, movement_date, operator_name, condition_at_movement, accessories_returned, reason, document_term_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *;
      `;
      const values = [
        id,
        m.batchOperationId || null,
        m.flowType || 'entrega',
        m.deviceId,
        m.deviceTag || null,
        m.deviceName || m.deviceModel || null,
        m.imei || null,
        m.originCollaboratorId || null,
        m.originCollaboratorName || null,
        m.destinationCollaboratorId || null,
        m.destinationCollaboratorName || null,
        m.type || 'Entrega',
        m.date || new Date().toISOString().split('T')[0],
        m.registeredBy || 'Gestor de Telefonia',
        m.conditionAtMovement || 'Bom',
        m.accessoriesIncluded || [],
        m.reason || null,
        m.documentId || null,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Fallback
  memoryStore.movements.unshift({ ...m, id });
  res.status(201).json({ success: true, data: m });
});

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
app.get('/api/terms', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
      const result = await pool.query(`
        SELECT 
          id, term_number as "code", type, collaborator_id as "collaboratorId",
          collaborator_name as "collaboratorName", device_id as "deviceId",
          device_tag as "deviceTag", device_model as "deviceModel",
          phone_line_number as "phoneNumber", generation_date as "date",
          signed_status as "status", file_name as "fileName", notes
        FROM terms_documents
        ORDER BY generation_date DESC
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.terms });
});

app.post('/api/terms', async (req, res) => {
  const t = req.body;
  const id = t.id || `term-${Date.now()}`;

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO terms_documents (id, term_number, type, collaborator_id, collaborator_name, device_id, device_tag, device_model, phone_line_number, generation_date, signed_status, file_name, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          signed_status = EXCLUDED.signed_status,
          file_name = EXCLUDED.file_name,
          notes = EXCLUDED.notes
        RETURNING *;
      `;
      const values = [
        id,
        t.code || t.termNumber || `TERMO-${Date.now()}`,
        t.type || 'Termo de Entrega',
        t.collaboratorId || null,
        t.collaboratorName || null,
        t.deviceId || null,
        t.deviceTag || null,
        t.deviceModel || null,
        t.phoneNumber || null,
        t.date || new Date().toISOString().split('T')[0],
        t.status || 'Pendente',
        t.fileName || null,
        t.notes || null,
      ];
      const result = await pool.query(query, values);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Fallback
  memoryStore.terms.unshift({ ...t, id });
  res.status(201).json({ success: true, data: t });
});

// 10. Trilha de Auditoria
app.get('/api/audit-logs', async (_req, res) => {
  if (pool && isDbConnected) {
    try {
      const result = await pool.query(`
        SELECT id, action, entity_type as "entityType", entity_id as "entityId",
               entity_label as "entityLabel", details, user_name as "user",
               timestamp
        FROM audit_logs
        ORDER BY timestamp DESC
        LIMIT 200
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  res.json({ success: true, data: memoryStore.auditLogs });
});

app.post('/api/audit-logs', async (req, res) => {
  const { action, entityType, entityId, entityLabel, details, user } = req.body || {};
  const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  if (pool && isDbConnected) {
    try {
      await pool.query(`
        INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, details, user_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, action || 'OPERAÇÃO', entityType || 'Geral', entityId || null, entityLabel || null, details || null, user || 'Operador']);
      return res.status(201).json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  memoryStore.auditLogs.unshift({
    id,
    action: action || 'OPERAÇÃO',
    entityType: entityType || 'Geral',
    entityId: entityId || '',
    entityLabel: entityLabel || '',
    details: details || '',
    user: user || 'Operador',
    timestamp: new Date().toISOString(),
  });
  res.status(201).json({ success: true });
});

// 11. Sincronização em Lote (Upload Completo do LocalStorage para o PostgreSQL)
app.post('/api/sync/batch-upload', async (req, res) => {
  const { devices, lines, collaborators, movements, terms, auditLogs } = req.body || {};

  if (!pool || !isDbConnected) {
    return res.json({ success: true, message: 'Dados salvos em modo contingência/memória.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Colaboradores primeiro (para satisfazer relacionamentos)
    if (Array.isArray(collaborators) && collaborators.length > 0) {
      for (const c of collaborators) {
        await client.query(`
          INSERT INTO collaborators (id, name, registration_id, department, role, email, phone, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            registration_id = EXCLUDED.registration_id,
            department = EXCLUDED.department,
            role = EXCLUDED.role,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            active = EXCLUDED.active;
        `, [
          c.id,
          c.fullName || c.name || 'Sem Nome',
          c.registrationNumber || c.registration_id || `MAT-${c.id}`,
          c.department || 'Geral',
          c.position || c.role || 'Colaborador',
          c.corporateEmail || c.email || null,
          c.contactPhone || c.phone || null,
          c.status === 'Ativo' || c.active !== false
        ]);
      }
    }

    // 2. Linhas Telefônicas
    if (Array.isArray(lines) && lines.length > 0) {
      for (const l of lines) {
        await client.query(`
          INSERT INTO phone_lines (id, phone_number, operator, account_number, plan_name, monthly_cost, status, current_device_id, current_collaborator_id, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            phone_number = EXCLUDED.phone_number,
            operator = EXCLUDED.operator,
            account_number = EXCLUDED.account_number,
            plan_name = EXCLUDED.plan_name,
            monthly_cost = EXCLUDED.monthly_cost,
            status = EXCLUDED.status,
            current_device_id = EXCLUDED.current_device_id,
            current_collaborator_id = EXCLUDED.current_collaborator_id,
            notes = EXCLUDED.notes;
        `, [
          l.id,
          l.phoneNumber,
          l.carrier || l.operator || 'Vivo',
          l.accountNumber || null,
          l.planName || 'Corporativo',
          l.monthlyCost || 0,
          l.status || 'Disponível',
          l.associatedDeviceId || null,
          l.currentCollaboratorId || null,
          l.notes || null
        ]);
      }
    }

    // 3. Dispositivos Móveis
    if (Array.isArray(devices) && devices.length > 0) {
      for (const d of devices) {
        await client.query(`
          INSERT INTO devices (id, tag, brand, model, imei_1, imei_2, serial_number, purchase_value, purchase_date, condition, status, current_collaborator_id, current_line_id, stock_custody_notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            tag = EXCLUDED.tag,
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            imei_1 = EXCLUDED.imei_1,
            imei_2 = EXCLUDED.imei_2,
            serial_number = EXCLUDED.serial_number,
            purchase_value = EXCLUDED.purchase_value,
            purchase_date = EXCLUDED.purchase_date,
            condition = EXCLUDED.condition,
            status = EXCLUDED.status,
            current_collaborator_id = EXCLUDED.current_collaborator_id,
            current_line_id = EXCLUDED.current_line_id,
            stock_custody_notes = EXCLUDED.stock_custody_notes,
            updated_at = CURRENT_TIMESTAMP;
        `, [
          d.id,
          d.assetTag || d.tag,
          d.brand || 'Samsung',
          d.model || 'Aparelho',
          d.imei1 || d.imei_1 || `IMEI-${d.id}`,
          d.imei2 || d.imei_2 || null,
          d.serialNumber || d.serial_number || `SN-${d.id}`,
          d.purchaseValue || 0,
          d.purchaseDate || null,
          d.condition || 'Novo',
          d.status || 'Disponível',
          d.currentCollaboratorId || null,
          d.associatedLineId || d.current_line_id || null,
          d.notes || d.stockCustodyNotes || null
        ]);
      }
    }

    // 4. Movimentações Patrimoniais
    if (Array.isArray(movements) && movements.length > 0) {
      for (const m of movements) {
        await client.query(`
          INSERT INTO movements (
            id, batch_operation_id, flow_type, device_id, device_tag, device_model, device_imei,
            origin_collaborator_id, origin_collaborator_name, destination_collaborator_id, destination_collaborator_name,
            movement_type, movement_date, operator_name, condition_at_movement, accessories_returned, reason, document_term_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING;
        `, [
          m.id,
          m.batchOperationId || null,
          m.flowType || 'entrega',
          m.deviceId,
          m.deviceTag || null,
          m.deviceName || m.deviceModel || null,
          m.imei || null,
          m.originCollaboratorId || null,
          m.originCollaboratorName || null,
          m.destinationCollaboratorId || null,
          m.destinationCollaboratorName || null,
          m.type || 'Entrega',
          m.date || new Date().toISOString().split('T')[0],
          m.registeredBy || 'Gestor de Telefonia',
          m.conditionAtMovement || 'Bom',
          m.accessoriesIncluded || [],
          m.reason || null,
          m.documentId || null
        ]);
      }
    }

    // 5. Termos e Documentos
    if (Array.isArray(terms) && terms.length > 0) {
      for (const t of terms) {
        await client.query(`
          INSERT INTO terms_documents (id, term_number, type, collaborator_id, collaborator_name, device_id, device_tag, device_model, phone_line_number, generation_date, signed_status, file_name, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            signed_status = EXCLUDED.signed_status,
            file_name = EXCLUDED.file_name,
            notes = EXCLUDED.notes;
        `, [
          t.id,
          t.code || t.termNumber || `TERMO-${t.id}`,
          t.type || 'Termo de Entrega',
          t.collaboratorId || null,
          t.collaboratorName || null,
          t.deviceId || null,
          t.deviceTag || null,
          t.deviceModel || null,
          t.phoneNumber || null,
          t.date || new Date().toISOString().split('T')[0],
          t.status || 'Pendente',
          t.fileName || null,
          t.notes || null
        ]);
      }
    }

    // 6. Trilha de Auditoria
    if (Array.isArray(auditLogs) && auditLogs.length > 0) {
      for (const a of auditLogs) {
        await client.query(`
          INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, details, user_name, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING;
        `, [
          a.id,
          a.action || 'OPERAÇÃO',
          a.entityType || 'Geral',
          a.entityId || null,
          a.entityLabel || null,
          a.details || null,
          a.user || 'Operador',
          a.timestamp ? new Date(a.timestamp) : new Date()
        ]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ [PostgreSQL] Sincronização em lote concluída com sucesso: ${devices?.length || 0} dispositivos, ${lines?.length || 0} linhas, ${collaborators?.length || 0} colaboradores.`);
    return res.json({ success: true, message: 'Dados sincronizados com o PostgreSQL com sucesso!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('⚠️ [POST /api/sync/batch-upload] Erro:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 12. Limpeza / Reset Total do Banco de Dados
app.post('/api/database/reset', async (_req, res) => {
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

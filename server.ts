/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------------------------------
// Configuração do Pool de Conexões PostgreSQL
// ----------------------------------------------------------------------------
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
  });

  pool.connect()
    .then((client) => {
      client.release();
      isDbConnected = true;
      console.log('✅ [PostgreSQL] Conexão com o banco de dados corporativo estabelecida com sucesso!');
    })
    .catch((err) => {
      console.warn('⚠️ [PostgreSQL] Não foi possível conectar ao banco via DATABASE_URL:', err.message);
      console.warn('💡 O sistema permanecerá ativo respondendo via armazenamento local / fallback.');
    });
} else {
  console.log('ℹ️ [PostgreSQL] DATABASE_URL não definida. Executando em modo protótipo com fallback no cliente.');
}

// ----------------------------------------------------------------------------
// Rotas da API REST (/api/*)
// ----------------------------------------------------------------------------

// 1. Status e Health Check
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'local_storage_mode',
    environment: isProduction ? 'production' : 'development',
  });
});

// 2. Dispositivos (Smartphones)
app.get('/api/devices', async (_req, res) => {
  if (!pool || !isDbConnected) {
    return res.json({ success: true, source: 'local_storage', data: [] });
  }
  try {
    const result = await pool.query(`
      SELECT 
        d.id, d.tag, d.brand, d.model, d.imei_1 as "imei1", d.imei_2 as "imei2",
        d.serial_number as "serialNumber", d.purchase_value as "purchaseValue",
        d.purchase_date as "purchaseDate", d.condition, d.status,
        d.current_collaborator_id as "currentCollaboratorId",
        c.name as "currentCollaboratorName",
        d.current_line_id as "currentLineId",
        l.phone_number as "currentLineNumber",
        d.stock_custody_notes as "stockCustodyNotes",
        d.created_at as "createdAt", d.updated_at as "updatedAt"
      FROM devices d
      LEFT JOIN collaborators c ON d.current_collaborator_id = c.id
      LEFT JOIN phone_lines l ON d.current_line_id = l.id
      ORDER BY d.tag ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/devices', async (req, res) => {
  if (!pool || !isDbConnected) {
    return res.status(503).json({ success: false, error: 'Banco de dados não conectado' });
  }
  const { id, tag, brand, model, imei1, imei2, serialNumber, purchaseValue, purchaseDate, condition, status } = req.body;
  try {
    const query = `
      INSERT INTO devices (id, tag, brand, model, imei_1, imei_2, serial_number, purchase_value, purchase_date, condition, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [id, tag, brand, model, imei1, imei2 || null, serialNumber, purchaseValue || 0, purchaseDate || null, condition || 'Novo', status || 'Disponível'];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Linhas Telefônicas
app.get('/api/lines', async (_req, res) => {
  if (!pool || !isDbConnected) {
    return res.json({ success: true, source: 'local_storage', data: [] });
  }
  try {
    const result = await pool.query(`
      SELECT 
        l.id, l.phone_number as "phoneNumber", l.operator, l.account_number as "accountNumber",
        l.plan_name as "planName", l.monthly_cost as "monthlyCost", l.status,
        l.current_device_id as "currentDeviceId",
        d.tag as "currentDeviceTag",
        l.current_collaborator_id as "currentCollaboratorId",
        c.name as "currentCollaboratorName",
        l.notes, l.updated_at as "updatedAt"
      FROM phone_lines l
      LEFT JOIN devices d ON l.current_device_id = d.id
      LEFT JOIN collaborators c ON l.current_collaborator_id = c.id
      ORDER BY l.phone_number ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Colaboradores
app.get('/api/collaborators', async (_req, res) => {
  if (!pool || !isDbConnected) {
    return res.json({ success: true, source: 'local_storage', data: [] });
  }
  try {
    const result = await pool.query(`
      SELECT 
        id, name, registration_id as "registrationId", department, role, email, phone, active
      FROM collaborators
      ORDER BY name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Movimentações Patrimoniais
app.get('/api/movements', async (_req, res) => {
  if (!pool || !isDbConnected) {
    return res.json({ success: true, source: 'local_storage', data: [] });
  }
  try {
    const result = await pool.query(`
      SELECT 
        id, batch_operation_id as "batchOperationId", flow_type as "flowType",
        device_id as "deviceId", device_tag as "deviceTag", device_model as "deviceModel",
        device_imei as "deviceImei", origin_collaborator_id as "originCollaboratorId",
        origin_collaborator_name as "originCollaboratorName",
        destination_collaborator_id as "destinationCollaboratorId",
        destination_collaborator_name as "destinationCollaboratorName",
        movement_type as "movementType", movement_date as "movementDate",
        operator_name as "operatorName", condition_at_movement as "conditionAtMovement",
        accessories_returned as "accessoriesReturned", reason,
        document_term_id as "documentTermId", stock_transit as "stockTransit",
        created_at as "createdAt"
      FROM movements
      ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Transação Atômica Oficial: Transferência entre Colaboradores (2 Etapas)
app.post('/api/movements/transfer', async (req, res) => {
  if (!pool || !isDbConnected) {
    return res.status(503).json({ success: false, error: 'Banco de dados não conectado' });
  }

  const {
    deviceId,
    originCollaboratorId,
    destinationCollaboratorId,
    movementDate,
    operatorName,
    conditionAtEvaluation,
    stockDestinationStatus, // 'Disponível', 'Aguardando avaliação', 'Em manutenção'
    accessoriesReturned,
    reason,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchOperationId = `batch-transf-${Date.now()}`;
    const STOCK_LABEL = 'Estoque do Gestor de Telefonia';

    // 1. Busca dados do dispositivo e colaboradores
    const devRes = await client.query('SELECT * FROM devices WHERE id = $1 FOR UPDATE', [deviceId]);
    if (devRes.rows.length === 0) {
      throw new Error('Dispositivo não encontrado');
    }
    const device = devRes.rows[0];

    const origColRes = await client.query('SELECT name FROM collaborators WHERE id = $1', [originCollaboratorId]);
    const originName = origColRes.rows[0]?.name || 'Colaborador Anterior';

    const destColRes = await client.query('SELECT name FROM collaborators WHERE id = $1', [destinationCollaboratorId]);
    const destName = destColRes.rows[0]?.name || 'Novo Colaborador';

    // ETAPA 1: Retorno de Colaborador A para o Estoque do Gestor
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

    // Validação da Etapa 2: Apenas se o status de destino no estoque for 'Disponível'
    if (stockDestinationStatus === 'Disponível') {
      // ETAPA 2: Entrega do Estoque do Gestor para o Colaborador B
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

      // Atualiza o dispositivo para "Em uso" com o novo colaborador
      await client.query(`
        UPDATE devices
        SET status = 'Em uso',
            current_collaborator_id = $1,
            condition = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [destinationCollaboratorId, conditionAtEvaluation, device.id]);
    } else {
      // Dispositivo precisa de manutenção ou avaliação: fica no estoque
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
        ? 'Transferência atômica em 2 etapas concluída com sucesso!'
        : `Etapa 1 executada: Aparelho devolvido ao estoque com status '${stockDestinationStatus}'. Etapa 2 interrompida conforme avaliação patrimonial.`
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
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

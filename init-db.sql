-- ==============================================================================
-- TelecomAsset Pro — Script de Inicialização PostgreSQL (init-db.sql)
-- Criado para: IANE Indústria e Comércio
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE COLABORADORES
CREATE TABLE IF NOT EXISTS collaborators (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    registration_id VARCHAR(50) UNIQUE NOT NULL, -- Matrícula
    department VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE LINHAS TELEFÔNICAS
CREATE TABLE IF NOT EXISTS phone_lines (
    id VARCHAR(50) PRIMARY KEY,
    phone_number VARCHAR(30) UNIQUE NOT NULL,
    operator VARCHAR(50) NOT NULL, -- Vivo, Claro, TIM
    account_number VARCHAR(50),
    plan_name VARCHAR(100),
    monthly_cost NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Disponível', -- Disponível, Em uso, Suspensa, Cancelada
    current_device_id VARCHAR(50),
    current_collaborator_id VARCHAR(50) REFERENCES collaborators(id) ON DELETE SET NULL,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE DISPOSITIVOS MÓVEIS (SMARTPHONES)
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(50) PRIMARY KEY,
    tag VARCHAR(50) UNIQUE NOT NULL, -- Patrimônio / TAG
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    imei_1 VARCHAR(20) UNIQUE NOT NULL,
    imei_2 VARCHAR(20),
    serial_number VARCHAR(80) UNIQUE NOT NULL,
    purchase_value NUMERIC(10, 2) DEFAULT 0.00,
    purchase_date DATE,
    condition VARCHAR(50) NOT NULL DEFAULT 'Novo', -- Novo, Excelente, Bom, Regular, Danificado
    
    -- Status Operacional Estrito
    status VARCHAR(50) NOT NULL DEFAULT 'Disponível', 
    -- Valores: 'Disponível', 'Em uso', 'Aguardando avaliação', 'Em manutenção', 'Reservado', 'Aguardando baixa patrimonial', 'Baixado', 'Extraviado'
    
    current_collaborator_id VARCHAR(50) REFERENCES collaborators(id) ON DELETE SET NULL,
    current_line_id VARCHAR(50) REFERENCES phone_lines(id) ON DELETE SET NULL,
    stock_custody_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE MOVIMENTAÇÕES PATRIMONIAIS (AUDITORIA E CUSTÓDIA)
CREATE TABLE IF NOT EXISTS movements (
    id VARCHAR(50) PRIMARY KEY,
    batch_operation_id VARCHAR(50), -- Agrupador para Transferências em 2 etapas ou Trocas
    flow_type VARCHAR(50) NOT NULL, -- entrega, devolucao, transferencia, troca
    device_id VARCHAR(50) NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    device_tag VARCHAR(50),
    device_model VARCHAR(100),
    device_imei VARCHAR(20),
    
    -- Rastreabilidade de Custódia (Colaborador <-> Estoque do Gestor)
    origin_collaborator_id VARCHAR(50),
    origin_collaborator_name VARCHAR(150),
    destination_collaborator_id VARCHAR(50),
    destination_collaborator_name VARCHAR(150),
    
    movement_type VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    operator_name VARCHAR(100) NOT NULL, -- Gestor de Telefonia
    condition_at_movement VARCHAR(50),
    accessories_returned TEXT[],
    reason TEXT,
    document_term_id VARCHAR(50),
    stock_transit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE TERMOS E DOCUMENTOS
CREATE TABLE IF NOT EXISTS terms_documents (
    id VARCHAR(50) PRIMARY KEY,
    term_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- Entrega, Devolucao, Transferencia, Manutencao
    collaborator_id VARCHAR(50) REFERENCES collaborators(id),
    collaborator_name VARCHAR(150),
    device_id VARCHAR(50) REFERENCES devices(id),
    device_tag VARCHAR(50),
    device_model VARCHAR(100),
    phone_line_number VARCHAR(30),
    generation_date DATE NOT NULL,
    signed_status VARCHAR(50) DEFAULT 'Pendente', -- Assinado, Pendente, Não exigido
    file_name VARCHAR(255),
    file_data TEXT, -- conteúdo do PDF anexado (base64)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei_1);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_movements_batch ON movements(batch_operation_id);
CREATE INDEX IF NOT EXISTS idx_movements_device ON movements(device_id);
CREATE INDEX IF NOT EXISTS idx_lines_phone ON phone_lines(phone_number);

-- 6. TABELA DE USUÁRIOS DO SISTEMA (LOGIN & ACESSO RBAC)
CREATE TABLE IF NOT EXISTS system_users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    role VARCHAR(50) DEFAULT 'admin', -- admin, gestor, operador, visualizador
    permissions TEXT[] DEFAULT ARRAY['all']::TEXT[],
    active BOOLEAN DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE system_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_username ON system_users(username);

-- 7. TABELA DE AUDITORIA DE SISTEMA
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

-- Super Usuário Oficial da TI IANE com Senha Criptografada (bcrypt)
-- Senha padrão inicial: Iane@2026
-- ON CONFLICT DO NOTHING: jamais redefine a senha de um usuário já existente a cada inicialização.
INSERT INTO system_users (id, username, password_hash, full_name, email, role, permissions)
VALUES (
    'user-iane-super-1',
    'tecnologia@iane.ind.br',
    '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW',
    'TI IANE - Super Usuário',
    'tecnologia@iane.ind.br',
    'admin',
    ARRAY['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users']::TEXT[]
)
ON CONFLICT DO NOTHING;

INSERT INTO system_users (id, username, password_hash, full_name, email, role, permissions)
VALUES (
    'user-iane-super-2',
    'tecnologia',
    '$2b$10$fngkbVvcbicIlBm.BPw7TOEYDiwJEb7qyC.qFTgTxLDKMGEDm8bIW',
    'TI IANE - Super Usuário',
    'tecnologia@iane.ind.br',
    'admin',
    ARRAY['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users']::TEXT[]
)
ON CONFLICT DO NOTHING;



-- ==============================================================================
-- 8. COMPATIBILIDADE COM O APLICATIVO (idempotente; o server.ts aplica o mesmo ajuste ao iniciar)
--    - "data" (JSONB) guarda o registro completo enviado pelo app (cláusulas dos termos, acessórios, stockTransit...)
--    - IMEI/serial deixam de ser obrigatórios/únicos globalmente (o app permite cadastrar sem eles);
--      o IMEI continua único quando preenchido
--    - Movimentações e termos são histórico: não podem impedir a exclusão de um aparelho/colaborador
-- ==============================================================================
ALTER TABLE collaborators   ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE phone_lines     ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE devices         ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE movements       ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE terms_documents ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE terms_documents ADD COLUMN IF NOT EXISTS file_data TEXT;

ALTER TABLE devices ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_serial_number_key;
ALTER TABLE devices ALTER COLUMN imei_1 DROP NOT NULL;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_imei_1_key;
ALTER TABLE devices ALTER COLUMN imei_1 TYPE VARCHAR(30);
ALTER TABLE devices ALTER COLUMN imei_2 TYPE VARCHAR(30);
ALTER TABLE movements ALTER COLUMN device_imei TYPE VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_imei_1 ON devices(imei_1) WHERE imei_1 IS NOT NULL AND imei_1 <> '';

ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_device_id_fkey;
ALTER TABLE terms_documents DROP CONSTRAINT IF EXISTS terms_documents_device_id_fkey;
ALTER TABLE terms_documents DROP CONSTRAINT IF EXISTS terms_documents_collaborator_id_fkey;

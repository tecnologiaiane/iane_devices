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
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei_1);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_movements_batch ON movements(batch_operation_id);
CREATE INDEX IF NOT EXISTS idx_movements_device ON movements(device_id);
CREATE INDEX IF NOT EXISTS idx_lines_phone ON phone_lines(phone_number);

-- ==============================================================================
-- CARGA INICIAL DE DEMONSTRAÇÃO (SEEDS INICIAIS)
-- ==============================================================================

-- Colaboradores
INSERT INTO collaborators (id, name, registration_id, department, role, email, phone, active)
VALUES
('col-01', 'Carlos Mendes', 'MAT-1042', 'Comercial', 'Gerente de Vendas', 'carlos.mendes@iane.ind.br', '(11) 98765-4321', true),
('col-02', 'Mariana Souza', 'MAT-1088', 'Operações', 'Coordenadora de Campo', 'mariana.souza@iane.ind.br', '(11) 97654-3210', true),
('col-03', 'Roberto Rocha', 'MAT-1102', 'Logística', 'Supervisor de Frotas', 'roberto.rocha@iane.ind.br', '(11) 96543-2109', true),
('col-04', 'Fernanda Lima', 'MAT-1145', 'Diretoria', 'Diretora Administrativa', 'fernanda.lima@iane.ind.br', '(11) 95432-1098', true),
('col-05', 'Lucas Andrade', 'MAT-1201', 'TI & Telecom', 'Analista de Infraestrutura', 'lucas.andrade@iane.ind.br', '(11) 94321-0987', true)
ON CONFLICT (registration_id) DO NOTHING;

-- Linhas Telefônicas
INSERT INTO phone_lines (id, phone_number, operator, account_number, plan_name, monthly_cost, status, current_collaborator_id)
VALUES
('lin-01', '(11) 98765-4321', 'Vivo', 'CTA-88201', 'Empresarial Voz + 30GB', 79.90, 'Em uso', 'col-01'),
('lin-02', '(11) 97654-3210', 'Claro', 'CTA-88202', 'Corporativo Total 50GB', 89.90, 'Em uso', 'col-02'),
('lin-03', '(11) 96543-2109', 'TIM', 'CTA-88203', 'Black Empresas 20GB', 65.00, 'Em uso', 'col-03'),
('lin-04', '(11) 95432-1098', 'Vivo', 'CTA-88201', 'Executivo Ilimitado + 100GB', 149.90, 'Em uso', 'col-04'),
('lin-05', '(11) 94321-0987', 'Vivo', 'CTA-88201', 'Empresarial Voz + 30GB', 79.90, 'Em uso', 'col-05'),
('lin-06', '(11) 93210-9876', 'Vivo', 'CTA-88201', 'Empresarial Voz + 20GB', 69.90, 'Disponível', NULL),
('lin-07', '(11) 92109-8765', 'Claro', 'CTA-88202', 'Corporativo 30GB', 75.00, 'Disponível', NULL),
('lin-08', '(11) 91098-7654', 'TIM', 'CTA-88203', 'Black Empresas 15GB', 55.00, 'Suspensa', NULL)
ON CONFLICT (phone_number) DO NOTHING;

-- Dispositivos Móveis
INSERT INTO devices (id, tag, brand, model, imei_1, imei_2, serial_number, purchase_value, purchase_date, condition, status, current_collaborator_id, current_line_id)
VALUES
('dev-01', 'CEL-001', 'Apple', 'iPhone 13 128GB', '356789102345671', '356789102345672', 'DNPZ8901L9RM', 4299.00, '2023-03-15', 'Excelente', 'Em uso', 'col-04', 'lin-04'),
('dev-02', 'CEL-002', 'Samsung', 'Galaxy S23 256GB', '358901234567892', '358901234567893', 'RZ8T3049ZPM', 3899.00, '2023-05-10', 'Excelente', 'Em uso', 'col-01', 'lin-01'),
('dev-03', 'CEL-003', 'Motorola', 'Moto G84 5G 256GB', '351234567890123', '351234567890124', 'ZY224K98LL', 1399.00, '2023-11-20', 'Bom', 'Em uso', 'col-02', 'lin-02'),
('dev-04', 'CEL-004', 'Samsung', 'Galaxy A54 5G 128GB', '352345678901234', '352345678901235', 'RZ8T7721LKM', 1799.00, '2024-01-12', 'Excelente', 'Em uso', 'col-03', 'lin-03'),
('dev-05', 'CEL-005', 'Samsung', 'Galaxy A34 5G 128GB', '353456789012345', '353456789012346', 'RZ8T5510XQM', 1499.00, '2024-02-05', 'Excelente', 'Em uso', 'col-05', 'lin-05'),
('dev-06', 'CEL-006', 'Samsung', 'Galaxy A54 5G 128GB', '354567890123456', '354567890123457', 'RZ8T8812OPM', 1799.00, '2024-03-01', 'Novo', 'Disponível', NULL, NULL),
('dev-07', 'CEL-007', 'Motorola', 'Moto G84 5G 256GB', '355678901234567', '355678901234568', 'ZY224M88KK', 1399.00, '2024-03-01', 'Novo', 'Disponível', NULL, NULL),
('dev-08', 'CEL-008', 'Apple', 'iPhone 12 64GB', '357890123456789', '357890123456790', 'FFXZ2109LK9', 2999.00, '2022-08-10', 'Regular', 'Aguardando avaliação', NULL, NULL),
('dev-09', 'CEL-009', 'Samsung', 'Galaxy A32 128GB', '359012345678901', '359012345678902', 'RZ8R9012JKM', 1199.00, '2022-04-14', 'Danificado', 'Em manutenção', NULL, NULL)
ON CONFLICT (tag) DO NOTHING;

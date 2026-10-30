export type DeviceStatus = 
  | 'Disponível' // Em estoque, pronto para entrega
  | 'Em uso' // Vinculado a um colaborador
  | 'Aguardando avaliação' // No estoque do Gestor, sob vistoria técnica/higienização
  | 'Em manutenção' // Em assistência técnica
  | 'Reservado' // No estoque do Gestor, reservado para admissão/projeto
  | 'Aguardando baixa patrimonial' // No estoque do Gestor, aguardando descarte contábil
  | 'Baixado' // Baixado definitivamente do patrimônio
  | 'Extraviado'; // Roubo/furto/perda

export type DeviceCondition = 
  | 'Novo' 
  | 'Excelente' 
  | 'Bom' 
  | 'Regular' 
  | 'Danificado';

export interface Device {
  id: string;
  assetTag: string; // Ex: CEL-001, AST-2024-089
  imei1: string;
  imei2?: string;
  brand: string; // Samsung, Apple, Motorola, Xiaomi, etc.
  model: string; // Galaxy S23, iPhone 14, etc.
  serialNumber: string;
  purchaseDate?: string; // YYYY-MM-DD
  purchaseValue?: number; // R$
  condition: DeviceCondition;
  status: DeviceStatus;
  sector?: string;
  unit?: string;
  currentDepartment?: string;
  currentCollaboratorId?: string;
  currentCollaboratorName?: string;
  associatedLineId?: string;
  associatedPhoneNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LineStatus = 
  | 'Disponível' 
  | 'Ativa' 
  | 'Suspensa' 
  | 'Em processo de cancelamento' 
  | 'Cancelada';

export type Carrier = 'Vivo' | 'Claro' | 'TIM' | 'Outra';

export interface PhoneLine {
  id: string;
  phoneNumber: string; // Formato (11) 98765-4321
  carrier: Carrier;
  planName?: string; // Ex: Corporativo Smart 50GB
  monthlyCost?: number; // R$
  status: LineStatus;
  associatedDeviceId?: string;
  associatedDeviceTag?: string;
  associatedDeviceModel?: string;
  currentCollaboratorId?: string;
  currentCollaboratorName?: string;
  department?: string;
  unit?: string;
  activationDate?: string;
  iccid?: string; // Número do chip SIM
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CollaboratorStatus = 'Ativo' | 'Férias' | 'Afastado' | 'Desligado';

export interface Collaborator {
  id: string;
  fullName: string;
  registrationNumber: string; // Matrícula
  department: string;
  sector?: string; // Setor
  unit?: string;
  position: string; // Cargo
  corporateEmail: string;
  contactPhone?: string;
  status: CollaboratorStatus;
  cpf?: string;
  notes?: string;
  createdAt: string;
}

export type MovementType = 
  | 'Entrega' 
  | 'Devolução' 
  | 'Transferência'
  | 'Transferência (Devolução ao Estoque)'
  | 'Transferência (Entrega do Estoque)'
  | 'Troca de Aparelho'
  | 'Troca (Devolução ao Estoque)'
  | 'Troca (Entrega do Estoque)'
  | 'Liberação de Estoque'
  | 'Envio para Manutenção' 
  | 'Retorno da Manutenção' 
  | 'Associação de Linha' 
  | 'Desassociação de Linha' 
  | 'Baixa de Aparelho' 
  | 'Ajuste Administrativo';

export interface Movement {
  id: string;
  code: string; // MOV-2024-001
  batchOperationId?: string; // Código comum que relaciona as 2 etapas de uma Transferência ou Troca
  type: MovementType;
  date: string; // YYYY-MM-DD
  
  // Aparelho envolvido
  deviceId?: string;
  deviceTag?: string;
  deviceName?: string;
  imei?: string;
  
  // Linha envolvida
  phoneLineId?: string;
  phoneNumber?: string;
  carrier?: string;
  
  // Colaboradores envolvidos
  originCollaboratorId?: string;
  originCollaboratorName?: string; // Pode ser "Estoque do Gestor de Telefonia"
  destinationCollaboratorId?: string;
  destinationCollaboratorName?: string; // Pode ser "Estoque do Gestor de Telefonia"
  
  // Flag explícita de passagem por estoque
  stockTransit?: {
    involved: boolean;
    stage: 'Entrada no Estoque' | 'Saída do Estoque' | 'Conferência em Estoque';
    stockStatusAfter?: DeviceStatus;
  };

  // Status de transição
  previousDeviceStatus?: DeviceStatus;
  newDeviceStatus?: DeviceStatus;
  previousLineStatus?: LineStatus;
  newLineStatus?: LineStatus;
  
  conditionAtMovement?: DeviceCondition;
  accessoriesIncluded: string[];
  
  registeredBy: string; // Gestor de Telefonia
  reason?: string;
  observations?: string;
  
  // Termo vinculado
  documentId?: string;
  documentCode?: string;
  documentType?: TermType;
  linkedTerms?: Array<{ id: string; code: string; type: TermType }>;
  
  maintenanceProvider?: string;
  maintenanceCost?: number;
  returnForecastDate?: string;
  requestApproval?: {
    requestId: string;
    requestType: RequestType;
    requesterName: string;
    requestedAt: string;
    approverName: string;
    approvedAt: string;
    primaryMovementId: string;
  };
}

export type CatalogType = 'departments' | 'sectors' | 'models' | 'brands' | 'units' | 'accessories';

export interface CatalogItem {
  id: string;
  name: string;
}

export type Catalogs = Record<CatalogType, CatalogItem[]>;

export type RequestType = 'Entrega' | 'Devolução' | 'Transferência' | 'Troca de Aparelho';
export type RequestStatus = 'Pendente de aprovação' | 'Aprovada' | 'Recusada';

export interface RequestRecord {
  id: string;
  type: RequestType;
  requesterId: string;
  requesterName: string;
  createdAt: string;
  status: RequestStatus;
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: string;
  rejectionReason?: string;
  movementIds?: string[];
  data: Record<string, any>;
}

export type TermType = 
  | 'Termo de Entrega' 
  | 'Termo de Devolução' 
  | 'Termo de Transferência' 
  | 'Termo de Manutenção' 
  | 'Laudo de Baixa' 
  | 'Outro';

export type TermStatus = 'Assinado' | 'Pendente de Assinatura' | 'Arquivado';

export interface DocumentTerm {
  id: string;
  code: string; // TERMO-ENT-2024-001
  type: TermType;
  title: string;
  date: string; // YYYY-MM-DD
  movementId?: string;
  batchOperationId?: string;
  deviceId?: string;
  deviceTag?: string;
  deviceModel?: string;
  deviceImei?: string;
  phoneLineId?: string;
  phoneNumber?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  collaboratorRegistration?: string;
  collaboratorCpf?: string;
  collaboratorDepartment?: string;
  status: TermStatus;
  accessoriesList: string[];
  clauses: string[];
  signedAt?: string;
  notes?: string;
  fileName?: string;
  /** O termo possui um PDF anexado, armazenado no servidor. */
  hasFile?: boolean;
  /**
   * Conteúdo do PDF em base64. Usado apenas no envio ao servidor
   * (nunca é mantido no cache local nem devolvido nas listagens).
   */
  fileData?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: 'Dispositivo' | 'Linha' | 'Colaborador' | 'Movimentação' | 'Termo';
  entityId: string;
  entityLabel: string;
  details: string;
  user: string;
}

export interface DashboardMetrics {
  totalDevices: number;
  inUseDevices: number;
  
  // Estoque do Gestor de Telefonia
  stockTotal: number;
  stockAvailable: number; // Disponíveis para entrega imediata
  stockAwaitingEvaluation: number; // Aguardando avaliação do gestor
  stockMaintenance: number; // Em manutenção
  stockReserved: number; // Reservados
  stockAwaitingDisposal: number; // Aguardando baixa patrimonial
  stockDisposed: number; // Baixados
  lostDevices: number; // Extraviados
  
  // Linhas
  totalLines: number;
  activeLines: number;
  availableLines: number;
  suspendedLines: number;
  cancelledLines: number;
  
  devicesWithoutCollaborator: number;
  linesWithoutDevice: number;
  linesWithoutCollaborator: number;
  
  recentMovementsCount: number;
  pendingTermsCount: number;
  inconsistenciesCount: number;
}

export type UserRole = 'admin' | 'gestor' | 'operador' | 'visualizador';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  role: UserRole;
  permissions: string[];
  active?: boolean;
  createdAt?: string;
}

export interface SystemUserFormData {
  id?: string;
  username: string;
  fullName: string;
  email?: string;
  password?: string;
  role: UserRole;
  permissions: string[];
  active: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}


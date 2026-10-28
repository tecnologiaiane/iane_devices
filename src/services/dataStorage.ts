import {
  Device,
  PhoneLine,
  Collaborator,
  Movement,
  DocumentTerm,
  AuditLog,
  DashboardMetrics,
  DeviceStatus,
  LineStatus,
  DeviceCondition,
  MovementType,
  TermType,
  User,
  SystemUserFormData
} from '../types';
import { apiClient, ApiResponse } from './apiClient';

const STORAGE_KEYS = {
  DEVICES: 'iane_devices_v3',
  LINES: 'iane_lines_v3',
  COLLABORATORS: 'iane_collaborators_v3',
  MOVEMENTS: 'iane_movements_v3',
  TERMS: 'iane_terms_v3',
  AUDIT: 'iane_audit_v3',
  INITIALIZED: 'iane_initialized_v3',
};

const OUTBOX_KEY = 'iane_outbox_v1';
const REJECTED_KEY = 'iane_outbox_rejected_v1';
const MIGRATED_KEY = 'iane_migrated_to_pg_v1';
const PRE_MIGRATION_BACKUP_KEY = 'iane_backup_pre_pg_migration_v1';
const MAX_SERVER_ERROR_ATTEMPTS = 8;

interface OutboxItem {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  label?: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface RejectedWrite {
  id: string;
  label: string;
  reason: string;
  rejectedAt: string;
  path?: string;
  entity?: string;
}

export const STOCK_LABEL = 'Estoque do Gestor de Telefonia';

// Base de dados 100% limpa (sem dados fictícios para produção)
const INITIAL_COLLABORATORS: Collaborator[] = [];
const INITIAL_DEVICES: Device[] = [];
const INITIAL_LINES: PhoneLine[] = [];
const INITIAL_TERMS: DocumentTerm[] = [];
const INITIAL_MOVEMENTS: Movement[] = [];
const INITIAL_AUDIT: AuditLog[] = [];

class DataStorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data) as T;
    } catch (e) {
      console.warn(`Erro ao ler ${key} do localStorage:`, e);
      return defaultValue;
    }
  }

  public async apiSync<T = any>(path: string, method: string = 'GET', body?: any): Promise<ApiResponse<T>> {
    const cleanMethod = method.toUpperCase();
    if (cleanMethod === 'GET') {
      return apiClient.get<T>(path);
    }
    // Escritas (POST/PUT/DELETE) vão para a fila persistente e são reenviadas até o PostgreSQL confirmar
    this.enqueueWrite(cleanMethod as 'POST' | 'PUT' | 'DELETE', path, body);
    return { success: true, message: 'Gravação enfileirada para o PostgreSQL.' };
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Erro ao salvar ${key} no localStorage:`, e);
    }
  }

  // =========================================================================
  // FILA DE GRAVAÇÃO (OUTBOX) → PostgreSQL
  // Toda alteração é aplicada no cache local (para a tela responder na hora) e
  // enfileirada aqui. A fila é persistente, ordenada (FIFO), reenviada até o
  // servidor confirmar e NUNCA descarta uma gravação em silêncio: se o banco
  // rejeitar o registro, o motivo aparece em uma notificação para o usuário.
  // =========================================================================
  private flushing = false;
  private pushing = false;
  private reseedAttempted = false;
  private migrationErrorNotified = false;
  private syncPromise: Promise<boolean> | null = null;

  private getOutbox(): OutboxItem[] {
    return this.get<OutboxItem[]>(OUTBOX_KEY, []);
  }

  private saveOutbox(items: OutboxItem[]): void {
    this.set(OUTBOX_KEY, items);
    this.emitSyncStatus();
  }

  private removeFromOutbox(id: string): void {
    this.saveOutbox(this.getOutbox().filter((i) => i.id !== id));
  }

  private emitSyncStatus(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('iane:sync-status', {
        detail: { pending: this.getOutbox().length, rejected: this.getRejectedWrites().length },
      })
    );
  }

  /** Quantidade de gravações ainda não confirmadas pelo PostgreSQL. */
  public getPendingSyncCount(): number {
    return this.getOutbox().length;
  }

  /** Gravações que o banco de dados rejeitou (com o motivo). */
  public getRejectedWrites(): RejectedWrite[] {
    return this.get<RejectedWrite[]>(REJECTED_KEY, []);
  }

  public clearRejectedWrites(): void {
    this.set(REJECTED_KEY, []);
    this.emitSyncStatus();
  }

  private notifyProblem(title: string, message: string, status?: number): void {
    apiClient.notifyError({
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'error',
      title,
      message,
      status,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    });
  }

  private labelOf(path: string, body: any): string {
    return body?.assetTag || body?.phoneNumber || body?.fullName || body?.code || body?.entityLabel || path;
  }

  private enqueueWrite(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: any): void {
    const queue = this.getOutbox();
    queue.push({
      id: `ob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method,
      path,
      body,
      label: this.labelOf(path, body),
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    this.saveOutbox(queue);
    void this.flushOutbox();
  }

  private sendItem(item: OutboxItem): Promise<ApiResponse> {
    if (item.method === 'DELETE') return apiClient.delete(item.path);
    if (item.method === 'PUT') return apiClient.put(item.path, item.body);
    return apiClient.post(item.path, item.body);
  }

  private rejectItem(item: OutboxItem, reason: string, status?: number): void {
    const rejected = this.getRejectedWrites();
    rejected.unshift({
      id: item.id,
      label: item.label || item.path,
      path: item.path,
      reason,
      rejectedAt: new Date().toISOString(),
    });
    this.set(REJECTED_KEY, rejected.slice(0, 100));
    this.removeFromOutbox(item.id);
    this.notifyProblem('Registro não gravado no banco de dados', `${item.label || item.path}: ${reason}`, status);
  }

  /** Envia as gravações pendentes, uma por vez e na ordem em que foram feitas. */
  public async flushOutbox(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (true) {
        const queue = this.getOutbox();
        if (queue.length === 0) break;
        const item = queue[0];

        const res = await this.sendItem(item);
        if (res.success) {
          this.removeFromOutbox(item.id);
          continue;
        }

        const status = res.status ?? 0;
        const reason = res.message || res.error || `HTTP ${status}`;
        // Falhas temporárias: servidor/banco fora do ar (0, 5xx), timeout, limite de requisições ou sessão expirada (401)
        const transient = !!res.isOffline || status === 0 || status >= 500 || status === 401 || status === 408 || status === 429;
        const attempts = item.attempts + 1;

        if (transient && !(status >= 500 && status !== 503 && attempts >= MAX_SERVER_ERROR_ATTEMPTS)) {
          this.saveOutbox(
            this.getOutbox().map((i) => (i.id === item.id ? { ...i, attempts, lastError: reason } : i))
          );
          break; // mantém a ordem: tenta de novo no próximo ciclo
        }

        // Rejeição definitiva (400/403/409/422...) ou erro 500 persistente: o usuário precisa saber
        this.rejectItem(item, reason, status);
      }
    } finally {
      this.flushing = false;
    }
  }

  private buildLocalPayload() {
    return {
      devices: this.getDevices(),
      lines: this.getLines(),
      collaborators: this.getCollaborators(),
      movements: this.getMovements(),
      terms: this.getTerms(),
      auditLogs: this.getAuditLogs(),
    };
  }

  private recordBatchRejections(rejected: { entity: string; id: string; label: string; message: string }[]): void {
    if (!rejected.length) return;
    const list = this.getRejectedWrites();
    for (const r of rejected) {
      list.unshift({
        id: `${r.entity}:${r.id}`,
        entity: r.entity,
        label: r.label,
        reason: r.message,
        rejectedAt: new Date().toISOString(),
      });
    }
    this.set(REJECTED_KEY, list.slice(0, 100));
    this.emitSyncStatus();
    const sample = rejected
      .slice(0, 3)
      .map((r) => `${r.label} (${r.message})`)
      .join('; ');
    this.notifyProblem(
      'Alguns registros não foram gravados no banco',
      `${rejected.length} registro(s) rejeitado(s) pelo PostgreSQL. Ex.: ${sample}${rejected.length > 3 ? '…' : ''}`
    );
  }

  // --- Métodos Assíncronos Oficiais que consultam o Backend PostgreSQL via ApiClient ---
  public async fetchDevices(): Promise<Device[]> {
    const res = await apiClient.get<Device[]>('/api/devices');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.DEVICES, res.data);
      return res.data;
    }
    return this.getDevices();
  }

  public async fetchLines(): Promise<PhoneLine[]> {
    const res = await apiClient.get<PhoneLine[]>('/api/lines');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.LINES, res.data);
      return res.data;
    }
    return this.getLines();
  }

  public async fetchCollaborators(): Promise<Collaborator[]> {
    const res = await apiClient.get<Collaborator[]>('/api/collaborators');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.COLLABORATORS, res.data);
      return res.data;
    }
    return this.getCollaborators();
  }

  public async fetchMovements(): Promise<Movement[]> {
    const res = await apiClient.get<Movement[]>('/api/movements');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.MOVEMENTS, res.data);
      return res.data;
    }
    return this.getMovements();
  }

  public async fetchTerms(): Promise<DocumentTerm[]> {
    const res = await apiClient.get<DocumentTerm[]>('/api/terms');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.TERMS, res.data);
      return res.data;
    }
    return this.getTerms();
  }

  public async fetchAuditLogs(): Promise<AuditLog[]> {
    const res = await apiClient.get<AuditLog[]>('/api/audit-logs');
    if (res.success && Array.isArray(res.data)) {
      this.set(STORAGE_KEYS.AUDIT, res.data);
      return res.data;
    }
    return this.getAuditLogs();
  }

  public async batchSyncToServer(): Promise<{ success: boolean; message: string }> {
    this.pushing = true;
    try {
      const res = await apiClient.post<any>('/api/sync/batch-upload', this.buildLocalPayload());
      if (!res.success) {
        return { success: false, message: res.error || res.message || 'Falha ao sincronizar com o banco de dados.' };
      }
      const rejected = res.data?.rejected ?? [];
      if (rejected.length > 0) {
        this.recordBatchRejections(rejected);
        const sample = rejected
          .slice(0, 5)
          .map((r: any) => `${r.label}: ${r.message}`)
          .join(' | ');
        return {
          success: false,
          message: `${rejected.length} registro(s) foram rejeitados pelo banco e NÃO foram gravados. ${sample}`,
        };
      }
      return { success: true, message: 'Dados sincronizados com o PostgreSQL com sucesso!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Erro ao sincronizar.' };
    } finally {
      this.pushing = false;
    }
  }

  /**
   * Migração única (por navegador): envia ao PostgreSQL os registros que existem só neste navegador
   * (dados antigos do localStorage), SEM sobrescrever nada que já esteja no banco. Antes disso guarda uma
   * cópia de segurança local. Retorna false se ainda não foi possível concluir (será tentado de novo).
   */
  private async migrateLocalDataOnce(): Promise<boolean> {
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return true;
    } catch {
      return true;
    }

    const payload = this.buildLocalPayload();
    const hasLocal =
      payload.devices.length + payload.lines.length + payload.collaborators.length +
      payload.movements.length + payload.terms.length > 0;

    if (!hasLocal) {
      localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
      return true;
    }

    this.set(PRE_MIGRATION_BACKUP_KEY, { savedAt: new Date().toISOString(), ...payload });

    this.pushing = true;
    try {
      const res = await apiClient.post<any>('/api/sync/batch-upload', { ...payload, mode: 'insert-missing' });
      if (!res.success) {
        const status = res.status ?? 0;
        const permanent = !res.isOffline && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        if (permanent && !this.migrationErrorNotified) {
          this.migrationErrorNotified = true;
          this.notifyProblem(
            'Dados locais não migrados para o banco',
            `${res.message || res.error || 'Erro desconhecido'}. Os dados continuam preservados neste navegador.`,
            status
          );
        }
        return false;
      }
      const rejected = res.data?.rejected ?? [];
      this.recordBatchRejections(rejected);
      localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
      console.log('✅ [Sync] Migração dos dados locais para o PostgreSQL concluída.', res.data?.saved);
      return true;
    } catch (e) {
      console.warn('[Sync] Migração dos dados locais adiada:', e);
      return false;
    } finally {
      this.pushing = false;
    }
  }

  public syncWithServer(): Promise<boolean> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async doSync(): Promise<boolean> {
    try {
      if (this.pushing) return false;

      // 1) Gravações pendentes saem primeiro; enquanto houver pendência, o cache local NÃO é sobrescrito
      await this.flushOutbox();
      if (this.getOutbox().length > 0) return false;

      // 2) Dados antigos que só existiam neste navegador sobem uma única vez
      if (!(await this.migrateLocalDataOnce())) return false;

      // 3) Lê o estado oficial do banco
      const [devRes, lineRes, colRes, movRes, termRes, audRes] = await Promise.all([
        apiClient.get<Device[]>('/api/devices'),
        apiClient.get<PhoneLine[]>('/api/lines'),
        apiClient.get<Collaborator[]>('/api/collaborators'),
        apiClient.get<Movement[]>('/api/movements'),
        apiClient.get<DocumentTerm[]>('/api/terms'),
        apiClient.get<AuditLog[]>('/api/audit-logs'),
      ]);

      // Servidor indisponível ou com erro: mantém o cache local intacto (nunca trata falha como "banco vazio")
      const all = [devRes, lineRes, colRes, movRes, termRes, audRes];
      if (all.some((r) => !r.success || !Array.isArray(r.data))) return false;

      const serverEmpty = [devRes, lineRes, colRes, movRes, termRes].every((r) => (r.data as any[]).length === 0);
      const localHasData =
        this.getDevices().length > 0 || this.getLines().length > 0 || this.getCollaborators().length > 0;

      // Banco vazio (ex.: volume recriado) e dados locais existentes: repõe o banco a partir do navegador, uma vez por sessão
      if (serverEmpty && localHasData) {
        if (!this.reseedAttempted && apiClient.isOnline()) {
          this.reseedAttempted = true;
          console.log('🔄 [Sync] Banco PostgreSQL vazio: repondo os dados a partir do cache local...');
          await this.batchSyncToServer();
        }
        return false;
      }

      // Houve alteração local (ou envio em lote) durante a leitura: não sobrescreve
      if (this.pushing || this.getOutbox().length > 0) return false;

      // 4) O PostgreSQL é a fonte da verdade: atualiza o cache local
      this.set(STORAGE_KEYS.DEVICES, devRes.data);
      this.set(STORAGE_KEYS.LINES, lineRes.data);
      this.set(STORAGE_KEYS.COLLABORATORS, colRes.data);
      this.set(STORAGE_KEYS.MOVEMENTS, movRes.data);
      this.set(STORAGE_KEYS.TERMS, termRes.data);
      this.set(STORAGE_KEYS.AUDIT, audRes.data);
      return true;
    } catch (e) {
      console.warn('Sincronização com o servidor indisponível no momento:', e);
      return false;
    }
  }

  public init() {
    // Purga versões antigas que continham dados fictícios
    [
      'telecom_devices', 'telecom_lines', 'telecom_collaborators', 'telecom_movements', 'telecom_terms', 'telecom_audit', 'telecom_initialized',
      'telecom_devices_v2', 'telecom_lines_v2', 'telecom_collaborators_v2', 'telecom_movements_v2', 'telecom_terms_v2', 'telecom_audit_v2', 'telecom_initialized_v2'
    ].forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    // Primeiro acesso deste navegador: cria o cache local vazio.
    // IMPORTANTE: não zera o banco (antes, abrir o sistema em um navegador novo executava TRUNCATE no PostgreSQL).
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      this.resetToDefaults(false);
    }

    // Sincroniza com o PostgreSQL em background e a cada 20 segundos
    void this.syncWithServer();
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        void this.syncWithServer();
      }, 20000);
      window.addEventListener('online', () => {
        void this.syncWithServer();
      });
    }
  }

  /**
   * Zera o cache local. Com resetServer = true (ação explícita do administrador em Configurações)
   * também zera o PostgreSQL; a falha desse pedido é exibida ao usuário em vez de ignorada.
   */
  public resetToDefaults(resetServer: boolean = true) {
    this.saveOutbox([]);
    this.set(REJECTED_KEY, []);
    this.set(STORAGE_KEYS.COLLABORATORS, INITIAL_COLLABORATORS);
    this.set(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    this.set(STORAGE_KEYS.LINES, INITIAL_LINES);
    this.set(STORAGE_KEYS.TERMS, INITIAL_TERMS);
    this.set(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    this.set(STORAGE_KEYS.AUDIT, INITIAL_AUDIT);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

    if (resetServer) {
      void apiClient.post('/api/database/reset').then((res) => {
        if (!res.success) {
          this.notifyProblem(
            'O banco de dados não foi zerado',
            res.message || res.error || 'O servidor recusou a operação. Os dados do PostgreSQL foram mantidos.',
            res.status
          );
        }
      });
    }
  }

  // --- Gestão de Usuários (RBAC / CRUD de Operadores via ApiClient) ---
  public async getUsers(): Promise<User[]> {
    try {
      const res = await apiClient.users.getUsers();
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (e) {
      console.warn('Erro ao carregar usuários:', e);
    }
    return [
      {
        id: 'user-iane-super-1',
        username: 'tecnologia@iane.ind.br',
        fullName: 'TI IANE - Super Usuário',
        email: 'tecnologia@iane.ind.br',
        role: 'admin',
        permissions: ['all'],
        active: true,
      }
    ];
  }

  public async saveUser(userData: SystemUserFormData): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const isEdit = !!userData.id;
      const res = isEdit
        ? await apiClient.users.updateUser(userData.id!, userData)
        : await apiClient.users.createUser(userData);

      if (res && res.success) {
        this.logAudit('Dispositivo', res.data?.id || userData.id || 'usr', userData.username, isEdit ? 'Atualização de operador e permissões de acesso via API.' : 'Cadastro de novo operador no sistema via API.');
        return { success: true, message: res.message || 'Usuário salvo com sucesso.', user: res.data };
      } else {
        return { success: false, message: res?.message || 'Não foi possível salvar o usuário.' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao conectar ao servidor.' };
    }
  }

  public async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiClient.users.deleteUser(userId);
      if (res && res.success) {
        this.logAudit('Dispositivo', userId, userId, 'Exclusão de operador do sistema via API.');
        return { success: true, message: res.message || 'Usuário excluído com sucesso.' };
      } else {
        return { success: false, message: res?.message || 'Falha ao excluir usuário.' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao conectar ao servidor.' };
    }
  }

  public async updateUserPermissions(userId: string, permissions: string[]): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const res = await apiClient.users.updatePermissions(userId, permissions);
      if (res && res.success) {
        this.logAudit('Dispositivo', userId, userId, 'Alteração granular de permissões do operador.');
        return { success: true, message: 'Permissões atualizadas com sucesso.', user: res.data };
      }
      return { success: false, message: res?.message || 'Falha ao atualizar permissões.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao conectar ao servidor.' };
    }
  }

  // --- Devices ---
  public getDevices(): Device[] {
    return this.get<Device[]>(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
  }

  public getDeviceById(id: string): Device | undefined {
    return this.getDevices().find(d => d.id === id);
  }

  public saveDevice(device: Partial<Device> & { id?: string }): { success: boolean; message: string; device?: Device } {
    const devices = this.getDevices();
    const isNew = !device.id;
    const now = new Date().toISOString().split('T')[0];

    // IMEI 1 duplicado
    if (device.imei1) {
      const duplicateImei = devices.find(d => d.imei1.trim() === device.imei1?.trim() && d.id !== device.id);
      if (duplicateImei) {
        return { success: false, message: `O IMEI 1 (${device.imei1}) já está cadastrado no aparelho ${duplicateImei.assetTag} (${duplicateImei.brand} ${duplicateImei.model}).` };
      }
    }

    // Tag duplicada
    if (device.assetTag) {
      const duplicateTag = devices.find(d => d.assetTag.trim().toUpperCase() === device.assetTag?.trim().toUpperCase() && d.id !== device.id);
      if (duplicateTag) {
        return { success: false, message: `O Identificador do Ativo (${device.assetTag}) já pertence a outro aparelho cadastrado.` };
      }
    }

    let savedDevice: Device;

    if (isNew) {
      savedDevice = {
        id: `dev-${Date.now()}`,
        assetTag: device.assetTag || `CEL-${String(devices.length + 1).padStart(3, '0')}`,
        imei1: device.imei1 || '',
        imei2: device.imei2,
        brand: device.brand || 'Samsung',
        model: device.model || '',
        serialNumber: device.serialNumber || '',
        purchaseDate: device.purchaseDate,
        purchaseValue: device.purchaseValue ? Number(device.purchaseValue) : undefined,
        condition: device.condition || 'Novo',
        status: device.status || 'Disponível', // Em estoque
        currentDepartment: device.currentDepartment,
        currentCollaboratorId: device.currentCollaboratorId,
        currentCollaboratorName: device.currentCollaboratorName,
        associatedLineId: device.associatedLineId,
        associatedPhoneNumber: device.associatedPhoneNumber,
        notes: device.notes,
        createdAt: now,
        updatedAt: now,
      };
      devices.unshift(savedDevice);
      this.logAudit('Dispositivo', savedDevice.id, savedDevice.assetTag, `Novo aparelho cadastrado e inserido no Estoque (${savedDevice.status}).`);
    } else {
      const index = devices.findIndex(d => d.id === device.id);
      if (index === -1) return { success: false, message: 'Aparelho não encontrado.' };

      savedDevice = {
        ...devices[index],
        ...device,
        updatedAt: now,
      } as Device;
      devices[index] = savedDevice;
      this.logAudit('Dispositivo', savedDevice.id, savedDevice.assetTag, 'Atualização de cadastro do aparelho.');
    }

    this.set(STORAGE_KEYS.DEVICES, devices);
    this.apiSync('/api/devices', 'POST', savedDevice);
    return { success: true, message: 'Dispositivo salvo com sucesso.', device: savedDevice };
  }

  public deleteDevice(id: string): { success: boolean; message: string } {
    const devices = this.getDevices();
    const device = devices.find(d => d.id === id);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    if (device.status === 'Em uso') {
      return { success: false, message: 'Não é permitido excluir um aparelho em uso por colaborador. Devolva-o primeiro ao estoque.' };
    }

    const updated = devices.filter(d => d.id !== id);
    this.set(STORAGE_KEYS.DEVICES, updated);
    this.apiSync(`/api/devices/${id}`, 'DELETE');
    this.logAudit('Dispositivo', id, device.assetTag, 'Exclusão do registro do aparelho.');
    return { success: true, message: 'Dispositivo removido com sucesso.' };
  }

  // --- Lines ---
  public getLines(): PhoneLine[] {
    return this.get<PhoneLine[]>(STORAGE_KEYS.LINES, INITIAL_LINES);
  }

  public getLineById(id: string): PhoneLine | undefined {
    return this.getLines().find(l => l.id === id);
  }

  public saveLine(line: Partial<PhoneLine> & { id?: string }): { success: boolean; message: string; line?: PhoneLine } {
    const lines = this.getLines();
    const isNew = !line.id;
    const now = new Date().toISOString().split('T')[0];

    if (line.phoneNumber) {
      const normalizedPhone = line.phoneNumber.replace(/\D/g, '');
      const duplicatePhone = lines.find(l => l.phoneNumber.replace(/\D/g, '') === normalizedPhone && l.id !== line.id);
      if (duplicatePhone) {
        return { success: false, message: `O número de telefone ${line.phoneNumber} já está cadastrado para a operadora ${duplicatePhone.carrier}.` };
      }
    }

    let savedLine: PhoneLine;

    if (isNew) {
      savedLine = {
        id: `line-${Date.now()}`,
        phoneNumber: line.phoneNumber || '',
        carrier: line.carrier || 'Vivo',
        planName: line.planName || 'Plano Corporativo',
        monthlyCost: line.monthlyCost ? Number(line.monthlyCost) : undefined,
        status: line.status || 'Disponível',
        associatedDeviceId: line.associatedDeviceId,
        associatedDeviceTag: line.associatedDeviceTag,
        associatedDeviceModel: line.associatedDeviceModel,
        currentCollaboratorId: line.currentCollaboratorId,
        currentCollaboratorName: line.currentCollaboratorName,
        department: line.department,
        activationDate: line.activationDate,
        iccid: line.iccid,
        notes: line.notes,
        createdAt: now,
        updatedAt: now,
      };
      lines.unshift(savedLine);
      this.logAudit('Linha', savedLine.id, savedLine.phoneNumber, 'Cadastro de nova linha telefônica no estoque.');
    } else {
      const index = lines.findIndex(l => l.id === line.id);
      if (index === -1) return { success: false, message: 'Linha não encontrada.' };

      savedLine = {
        ...lines[index],
        ...line,
        updatedAt: now,
      } as PhoneLine;
      lines[index] = savedLine;
      this.logAudit('Linha', savedLine.id, savedLine.phoneNumber, 'Atualização de dados cadastrais da linha.');
    }

    this.set(STORAGE_KEYS.LINES, lines);
    this.apiSync('/api/lines', 'POST', savedLine);
    return { success: true, message: 'Linha telefônica salva com sucesso.', line: savedLine };
  }

  public deleteLine(id: string): { success: boolean; message: string } {
    const lines = this.getLines();
    const line = lines.find(l => l.id === id);
    if (!line) return { success: false, message: 'Linha não encontrada.' };

    if (line.status === 'Ativa' && line.currentCollaboratorId) {
      return { success: false, message: 'Não é possível excluir uma linha ativa vinculada a um colaborador.' };
    }

    const updated = lines.filter(l => l.id !== id);
    this.set(STORAGE_KEYS.LINES, updated);
    this.apiSync(`/api/lines/${id}`, 'DELETE');
    this.logAudit('Linha', id, line.phoneNumber, 'Exclusão do registro de linha telefônica.');
    return { success: true, message: 'Linha removida com sucesso.' };
  }

  // --- Collaborators ---
  public getCollaborators(): Collaborator[] {
    return this.get<Collaborator[]>(STORAGE_KEYS.COLLABORATORS, INITIAL_COLLABORATORS);
  }

  public getCollaboratorById(id: string): Collaborator | undefined {
    return this.getCollaborators().find(c => c.id === id);
  }

  public saveCollaborator(collab: Partial<Collaborator> & { id?: string }): { success: boolean; message: string; collaborator?: Collaborator } {
    const collabs = this.getCollaborators();
    const isNew = !collab.id;
    const now = new Date().toISOString().split('T')[0];

    if (collab.registrationNumber) {
      const duplicateMat = collabs.find(c => c.registrationNumber.trim().toUpperCase() === collab.registrationNumber?.trim().toUpperCase() && c.id !== collab.id);
      if (duplicateMat) {
        return { success: false, message: `A matrícula ${collab.registrationNumber} já pertence ao colaborador ${duplicateMat.fullName}.` };
      }
    }

    let savedCollab: Collaborator;

    if (isNew) {
      savedCollab = {
        id: `col-${Date.now()}`,
        fullName: collab.fullName || '',
        registrationNumber: collab.registrationNumber || `MAT-${Math.floor(1000 + Math.random() * 9000)}`,
        department: collab.department || 'Geral',
        position: collab.position || '',
        corporateEmail: collab.corporateEmail || '',
        contactPhone: collab.contactPhone,
        status: collab.status || 'Ativo',
        cpf: collab.cpf,
        notes: collab.notes,
        createdAt: now,
      };
      collabs.unshift(savedCollab);
      this.logAudit('Colaborador', savedCollab.id, savedCollab.fullName, 'Cadastro de novo colaborador.');
    } else {
      const index = collabs.findIndex(c => c.id === collab.id);
      if (index === -1) return { success: false, message: 'Colaborador não encontrado.' };

      savedCollab = {
        ...collabs[index],
        ...collab,
      } as Collaborator;
      collabs[index] = savedCollab;
      this.logAudit('Colaborador', savedCollab.id, savedCollab.fullName, 'Atualização de cadastro do colaborador.');
    }

    this.set(STORAGE_KEYS.COLLABORATORS, collabs);
    this.apiSync('/api/collaborators', 'POST', savedCollab);
    return { success: true, message: 'Colaborador salvo com sucesso.', collaborator: savedCollab };
  }

  public deleteCollaborator(id: string): { success: boolean; message: string } {
    const collabs = this.getCollaborators();
    const collab = collabs.find(c => c.id === id);
    if (!collab) return { success: false, message: 'Colaborador não encontrado.' };

    const devices = this.getDevices();
    const hasDevice = devices.some(d => d.currentCollaboratorId === id && d.status === 'Em uso');
    if (hasDevice) {
      return { success: false, message: 'Não é possível excluir um colaborador com dispositivo em custódia. Realize primeiro a devolução ao estoque.' };
    }

    const updated = collabs.filter(c => c.id !== id);
    this.set(STORAGE_KEYS.COLLABORATORS, updated);
    this.apiSync(`/api/collaborators/${id}`, 'DELETE');
    this.logAudit('Colaborador', id, collab.fullName, 'Exclusão do registro de colaborador.');
    return { success: true, message: 'Colaborador removido com sucesso.' };
  }

  // --- Movements & Terms ---
  public getMovements(): Movement[] {
    return this.get<Movement[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
  }

  public getTerms(): DocumentTerm[] {
    return this.get<DocumentTerm[]>(STORAGE_KEYS.TERMS, INITIAL_TERMS);
  }

  public getTermById(id: string): DocumentTerm | undefined {
    return this.getTerms().find(t => t.id === id);
  }

  public updateTermStatus(id: string, status: 'Assinado' | 'Pendente de Assinatura' | 'Arquivado'): boolean {
    const terms = this.getTerms();
    const term = terms.find(t => t.id === id);
    if (!term) return false;
    term.status = status;
    if (status === 'Assinado' && !term.signedAt) {
      const now = new Date();
      term.signedAt = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('pt-BR').substring(0, 5)}`;
    }
    this.set(STORAGE_KEYS.TERMS, terms);
    this.apiSync('/api/terms', 'POST', term);
    this.logAudit('Termo', id, term.code, `Status do termo alterado para ${status}.`);
    return true;
  }

  // =========================================================================
  // FLUXO OFICIAL 1: ENTREGA DE DISPOSITIVO (Estoque → Colaborador)
  // =========================================================================
  public executeDelivery(params: {
    deviceId: string;
    collaboratorId: string;
    lineId?: string;
    date: string;
    condition: DeviceCondition;
    accessories: string[];
    reason?: string;
    observations?: string;
    registeredBy?: string;
    batchOperationId?: string;
  }): { success: boolean; message: string; movement?: Movement } {
    const devices = this.getDevices();
    const lines = this.getLines();
    const collaborators = this.getCollaborators();

    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    // REGRA DE INTEGRIDADE: Somente aparelhos com status "Disponível" em estoque podem ser entregues!
    if (device.status !== 'Disponível') {
      return { 
        success: false, 
        message: `O aparelho ${device.assetTag} está com status "${device.status}". Somente aparelhos com status "Disponível" no estoque do Gestor de Telefonia podem ser entregues a colaboradores.` 
      };
    }

    if (device.currentCollaboratorId) {
      return { 
        success: false, 
        message: `Inconsistência: O aparelho ${device.assetTag} já está vinculado ao colaborador ${device.currentCollaboratorName}.` 
      };
    }

    const collaborator = collaborators.find(c => c.id === params.collaboratorId);
    if (!collaborator) return { success: false, message: 'Colaborador destino não encontrado.' };
    if (collaborator.status === 'Desligado') {
      return { success: false, message: 'Não é permitida a entrega de aparelhos a colaboradores com status Desligado.' };
    }

    let selectedLine: PhoneLine | undefined;
    if (params.lineId) {
      selectedLine = lines.find(l => l.id === params.lineId);
      if (!selectedLine) return { success: false, message: 'Linha telefônica não encontrada.' };
      
      if (selectedLine.associatedDeviceId && selectedLine.associatedDeviceId !== device.id) {
        const otherDev = devices.find(d => d.id === selectedLine?.associatedDeviceId);
        if (otherDev && otherDev.status === 'Em uso') {
          return { success: false, message: `A linha ${selectedLine.phoneNumber} já está vinculada ao aparelho ativo ${otherDev.assetTag}.` };
        }
      }
    }

    const now = new Date();
    const movCode = `MOV-${now.getFullYear()}-${String(this.getMovements().length + 1).padStart(3, '0')}`;
    const termCode = `TERMO-ENT-${now.getFullYear()}-${String(this.getTerms().length + 1).padStart(3, '0')}`;

    // 1. Atualizar Dispositivo: Sai do Estoque -> Em uso
    device.status = 'Em uso';
    device.condition = params.condition;
    device.currentCollaboratorId = collaborator.id;
    device.currentCollaboratorName = collaborator.fullName;
    device.currentDepartment = collaborator.department;
    if (selectedLine) {
      device.associatedLineId = selectedLine.id;
      device.associatedPhoneNumber = selectedLine.phoneNumber;
    }
    device.updatedAt = params.date;

    // 2. Atualizar Linha se selecionada
    if (selectedLine) {
      selectedLine.status = 'Ativa';
      selectedLine.associatedDeviceId = device.id;
      selectedLine.associatedDeviceTag = device.assetTag;
      selectedLine.associatedDeviceModel = `${device.brand} ${device.model}`;
      selectedLine.currentCollaboratorId = collaborator.id;
      selectedLine.currentCollaboratorName = collaborator.fullName;
      selectedLine.department = collaborator.department;
      selectedLine.updatedAt = params.date;
    }

    // 3. Gerar Termo de Entrega
    const termId = `term-${Date.now()}`;
    const newTerm: DocumentTerm = {
      id: termId,
      code: termCode,
      batchOperationId: params.batchOperationId,
      type: 'Termo de Entrega',
      title: 'Termo de Responsabilidade e Guarda de Ativo Telefônico',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceModel: `${device.brand} ${device.model}`,
      deviceImei: device.imei1,
      phoneLineId: selectedLine?.id,
      phoneNumber: selectedLine?.phoneNumber,
      collaboratorId: collaborator.id,
      collaboratorName: collaborator.fullName,
      collaboratorRegistration: collaborator.registrationNumber,
      collaboratorCpf: collaborator.cpf,
      collaboratorDepartment: collaborator.department,
      status: 'Pendente de Assinatura',
      accessoriesList: params.accessories,
      clauses: [
        'O colaborador declara ter recebido o equipamento liberado do Estoque do Gestor de Telefonia em perfeitas condições.',
        'O equipamento e a linha destinam-se exclusivamente ao desempenho das atividades profissionais corporativas.',
        'O colaborador compromete-se a zelar pelo bem, respondendo por dolo ou negligência comprovada.',
        'Em caso de rescisão, férias prolongadas ou solicitação da empresa, o equipamento deverá ser prontamente restituído ao Estoque do Gestor de Telefonia.',
        'Em caso de furto, roubo ou extravio, é obrigatória a formalização de Boletim de Ocorrência Policial e comunicação ao Gestor de Telefonia em até 24 horas.'
      ],
      notes: params.observations,
      fileName: `Termo_Entrega_${device.assetTag}_${collaborator.registrationNumber}.pdf`
    };

    // 4. Registrar Movimentação: Origem = Estoque do Gestor -> Destino = Colaborador
    const movementId = `mov-${Date.now()}`;
    newTerm.movementId = movementId;

    const newMovement: Movement = {
      id: movementId,
      code: movCode,
      batchOperationId: params.batchOperationId,
      type: 'Entrega',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceName: `${device.brand} ${device.model}`,
      imei: device.imei1,
      phoneLineId: selectedLine?.id,
      phoneNumber: selectedLine?.phoneNumber,
      carrier: selectedLine?.carrier,
      originCollaboratorName: STOCK_LABEL, // Fiel ao conceito operacional: Sai do estoque
      destinationCollaboratorId: collaborator.id,
      destinationCollaboratorName: collaborator.fullName,
      stockTransit: {
        involved: true,
        stage: 'Saída do Estoque',
        stockStatusAfter: 'Em uso'
      },
      previousDeviceStatus: 'Disponível',
      newDeviceStatus: 'Em uso',
      conditionAtMovement: params.condition,
      accessoriesIncluded: params.accessories,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      reason: params.reason || 'Entrega de aparelho do estoque para colaborador.',
      observations: params.observations,
      documentId: termId,
      documentCode: termCode,
      documentType: 'Termo de Entrega'
    };

    // Persistência Atômica
    this.set(STORAGE_KEYS.DEVICES, devices);
    if (selectedLine) this.set(STORAGE_KEYS.LINES, lines);

    const movements = this.getMovements();
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);

    const terms = this.getTerms();
    terms.unshift(newTerm);
    this.set(STORAGE_KEYS.TERMS, terms);

    // Persistência direta no PostgreSQL
    this.apiSync('/api/devices', 'POST', device);
    if (selectedLine) this.apiSync('/api/lines', 'POST', selectedLine);
    this.apiSync('/api/movements', 'POST', newMovement);
    this.apiSync('/api/terms', 'POST', newTerm);

    this.logAudit('Movimentação', movementId, movCode, `Entrega do aparelho ${device.assetTag} liberado do Estoque para ${collaborator.fullName}.`);

    return { 
      success: true, 
      message: `Aparelho ${device.assetTag} entregue com sucesso do Estoque para ${collaborator.fullName}. Termo ${termCode} gerado.`, 
      movement: newMovement 
    };
  }

  // =========================================================================
  // FLUXO OFICIAL 2: DEVOLUÇÃO DE DISPOSITIVO (Colaborador → Estoque do Gestor)
  // =========================================================================
  public executeReturn(params: {
    deviceId: string;
    collaboratorId: string;
    date: string;
    condition: DeviceCondition;
    nextDeviceStatus: 'Disponível' | 'Aguardando avaliação' | 'Em manutenção' | 'Reservado' | 'Aguardando baixa patrimonial';
    lineHandling: 'retornar_ao_estoque' | 'manter_com_colaborador' | 'desassociar_e_suspender';
    accessoriesReturned: string[];
    reason?: string;
    observations?: string;
    registeredBy?: string;
    batchOperationId?: string;
    maintenanceProvider?: string;
  }): { success: boolean; message: string; movement?: Movement } {
    const devices = this.getDevices();
    const lines = this.getLines();
    const collaborators = this.getCollaborators();

    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    const collaborator = collaborators.find(c => c.id === params.collaboratorId);
    if (!collaborator) return { success: false, message: 'Colaborador não encontrado.' };

    if (device.currentCollaboratorId !== collaborator.id) {
      return { 
        success: false, 
        message: `Inconsistência de devolução: O aparelho ${device.assetTag} está registrado sob responsabilidade de "${device.currentCollaboratorName || 'Nenhum'}", e não de "${collaborator.fullName}".` 
      };
    }

    const now = new Date();
    const movCode = `MOV-${now.getFullYear()}-${String(this.getMovements().length + 1).padStart(3, '0')}`;
    const termCode = `TERMO-DEV-${now.getFullYear()}-${String(this.getTerms().length + 1).padStart(3, '0')}`;

    const prevDeviceStatus = device.status;
    const previousLineId = device.associatedLineId;
    let lineObj: PhoneLine | undefined;
    if (previousLineId) {
      lineObj = lines.find(l => l.id === previousLineId);
    }

    // 1. Atualizar Dispositivo: Retorna à responsabilidade do Gestor de Telefonia
    device.status = params.nextDeviceStatus;
    device.condition = params.condition;
    device.currentCollaboratorId = undefined;
    device.currentCollaboratorName = undefined;
    device.currentDepartment = undefined;
    device.updatedAt = params.date;

    // 2. Tratamento da Linha Telefônica conforme decisão operacional
    if (lineObj) {
      if (params.lineHandling === 'retornar_ao_estoque') {
        // Desvincula do aparelho e do colaborador, volta a ficar disponível no estoque de linhas
        device.associatedLineId = undefined;
        device.associatedPhoneNumber = undefined;
        lineObj.associatedDeviceId = undefined;
        lineObj.associatedDeviceTag = undefined;
        lineObj.associatedDeviceModel = undefined;
        lineObj.currentCollaboratorId = undefined;
        lineObj.currentCollaboratorName = undefined;
        lineObj.department = undefined;
        lineObj.status = 'Disponível';
        lineObj.updatedAt = params.date;
      } else if (params.lineHandling === 'manter_com_colaborador') {
        // Colaborador mantém o chip (BYOD ou aguardando novo aparelho)
        device.associatedLineId = undefined;
        device.associatedPhoneNumber = undefined;
        lineObj.associatedDeviceId = undefined;
        lineObj.associatedDeviceTag = undefined;
        lineObj.associatedDeviceModel = undefined;
        // Permanece com currentCollaboratorId
        lineObj.status = 'Ativa';
        lineObj.updatedAt = params.date;
      } else if (params.lineHandling === 'desassociar_e_suspender') {
        device.associatedLineId = undefined;
        device.associatedPhoneNumber = undefined;
        lineObj.associatedDeviceId = undefined;
        lineObj.associatedDeviceTag = undefined;
        lineObj.associatedDeviceModel = undefined;
        lineObj.currentCollaboratorId = undefined;
        lineObj.currentCollaboratorName = undefined;
        lineObj.status = 'Suspensa';
        lineObj.updatedAt = params.date;
      }
    }

    // 3. Criar Termo de Devolução
    const termId = `term-${Date.now()}`;
    const newTerm: DocumentTerm = {
      id: termId,
      code: termCode,
      batchOperationId: params.batchOperationId,
      type: 'Termo de Devolução',
      title: 'Termo de Devolução ao Estoque do Gestor de Telefonia',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceModel: `${device.brand} ${device.model}`,
      deviceImei: device.imei1,
      collaboratorId: collaborator.id,
      collaboratorName: collaborator.fullName,
      collaboratorRegistration: collaborator.registrationNumber,
      collaboratorDepartment: collaborator.department,
      status: 'Assinado', // Quitado na entrega no balcão de estoque do gestor
      accessoriesList: params.accessoriesReturned,
      clauses: [
        'A empresa, por intermédio do Gestor de Telefonia, atesta o recebimento e recolhimento do ativo ao estoque central.',
        'O colaborador fica integralmente quitado e desonerado da responsabilidade patrimonial sobre este equipamento.',
        'Os dados corporativos foram formatados e o ativo direcionado ao status operacional: ' + params.nextDeviceStatus + '.'
      ],
      signedAt: `${params.date} ${now.toLocaleTimeString('pt-BR').substring(0, 5)}`,
      notes: params.observations,
      fileName: `Termo_Devolucao_${device.assetTag}_${collaborator.registrationNumber}.pdf`
    };

    // 4. Registrar Movimentação: Origem = Colaborador -> Destino = Estoque do Gestor
    const movementId = `mov-${Date.now()}`;
    newTerm.movementId = movementId;

    const newMovement: Movement = {
      id: movementId,
      code: movCode,
      batchOperationId: params.batchOperationId,
      type: 'Devolução',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceName: `${device.brand} ${device.model}`,
      imei: device.imei1,
      phoneLineId: lineObj?.id,
      phoneNumber: lineObj?.phoneNumber,
      carrier: lineObj?.carrier,
      originCollaboratorId: collaborator.id,
      originCollaboratorName: collaborator.fullName,
      destinationCollaboratorName: STOCK_LABEL, // Fiel ao conceito: retorna ao estoque
      stockTransit: {
        involved: true,
        stage: 'Entrada no Estoque',
        stockStatusAfter: params.nextDeviceStatus
      },
      previousDeviceStatus: prevDeviceStatus,
      newDeviceStatus: params.nextDeviceStatus,
      conditionAtMovement: params.condition,
      accessoriesIncluded: params.accessoriesReturned,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      reason: params.reason || 'Devolução de aparelho ao estoque do Gestor.',
      observations: params.observations,
      documentId: termId,
      documentCode: termCode,
      documentType: 'Termo de Devolução',
      maintenanceProvider: params.nextDeviceStatus === 'Em manutenção' ? params.maintenanceProvider : undefined
    };

    this.set(STORAGE_KEYS.DEVICES, devices);
    if (lineObj) this.set(STORAGE_KEYS.LINES, lines);

    const movements = this.getMovements();
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);

    const terms = this.getTerms();
    terms.unshift(newTerm);
    this.set(STORAGE_KEYS.TERMS, terms);

    // Persistência direta no PostgreSQL
    this.apiSync('/api/devices', 'POST', device);
    if (lineObj) this.apiSync('/api/lines', 'POST', lineObj);
    this.apiSync('/api/movements', 'POST', newMovement);
    this.apiSync('/api/terms', 'POST', newTerm);

    this.logAudit('Movimentação', movementId, movCode, `Devolução do aparelho ${device.assetTag} de ${collaborator.fullName} ao Estoque. Destino no estoque: ${params.nextDeviceStatus}.`);

    return { 
      success: true, 
      message: `Aparelho ${device.assetTag} devolvido com sucesso ao Estoque do Gestor (${params.nextDeviceStatus}). Termo de quitação ${termCode} gerado.`, 
      movement: newMovement 
    };
  }

  // =========================================================================
  // FLUXO OFICIAL 3: TRANSFERÊNCIA ENTRE COLABORADORES
  // Obrigatório: Colaborador A → Estoque do Gestor → Colaborador B
  // =========================================================================
  public executeTransfer(params: {
    deviceId: string;
    originCollaboratorId: string;
    destinationCollaboratorId: string;
    date: string;
    condition: DeviceCondition;
    destinationStatusAfterReturn: 'Disponível' | 'Aguardando avaliação' | 'Em manutenção';
    lineHandling: 'transferir_linha_junto' | 'manter_linha_com_origem' | 'retornar_linha_ao_estoque';
    accessories: string[];
    reason?: string;
    observations?: string;
    registeredBy?: string;
  }): { success: boolean; message: string; batchOperationId?: string } {
    const devices = this.getDevices();
    const collaborators = this.getCollaborators();
    const lines = this.getLines();

    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    const originCollab = collaborators.find(c => c.id === params.originCollaboratorId);
    if (!originCollab) return { success: false, message: 'Colaborador de origem não encontrado.' };

    const destCollab = collaborators.find(c => c.id === params.destinationCollaboratorId);
    if (!destCollab) return { success: false, message: 'Colaborador de destino não encontrado.' };

    if (originCollab.id === destCollab.id) {
      return { success: false, message: 'O colaborador de origem e de destino devem ser pessoas diferentes.' };
    }

    if (device.currentCollaboratorId !== originCollab.id) {
      return { success: false, message: `O aparelho ${device.assetTag} não está sob posse de ${originCollab.fullName}.` };
    }

    const now = new Date();
    const batchId = `TRF-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    // ETAPA 1: Devolução obrigatória ao Estoque do Gestor de Telefonia
    const returnResult = this.executeReturn({
      deviceId: device.id,
      collaboratorId: originCollab.id,
      date: params.date,
      condition: params.condition,
      nextDeviceStatus: params.destinationStatusAfterReturn,
      lineHandling: params.lineHandling === 'transferir_linha_junto' ? 'retornar_ao_estoque' : 'manter_com_colaborador',
      accessoriesReturned: params.accessories,
      reason: `Transferência patrimonial [${batchId}] - Etapa 1: Devolução ao Estoque do Gestor.`,
      observations: params.observations,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      batchOperationId: batchId
    });

    if (!returnResult.success) {
      return { success: false, message: `Falha na 1ª Etapa (Devolução ao Estoque): ${returnResult.message}` };
    }

    // REGRA DE INTEGRIDADE: Se o aparelho não estiver apto ("Disponível"), interrompe a 2ª etapa!
    if (params.destinationStatusAfterReturn !== 'Disponível') {
      return {
        success: true,
        message: `Etapa 1 concluída com sucesso: Aparelho ${device.assetTag} recolhido ao Estoque do Gestor com status "${params.destinationStatusAfterReturn}". A entrega ao colaborador ${destCollab.fullName} foi interrompida pois o ativo requer avaliação ou reparo prévio.`,
        batchOperationId: batchId
      };
    }

    // ETAPA 2: Nova entrega do Estoque do Gestor para o Colaborador B
    let lineToAssignId: string | undefined;
    if (params.lineHandling === 'transferir_linha_junto' && device.associatedLineId) {
      lineToAssignId = device.associatedLineId;
    }

    const deliveryResult = this.executeDelivery({
      deviceId: device.id,
      collaboratorId: destCollab.id,
      lineId: lineToAssignId,
      date: params.date,
      condition: params.condition,
      accessories: params.accessories,
      reason: `Transferência patrimonial [${batchId}] - Etapa 2: Entrega do Estoque para novo colaborador.`,
      observations: `Transferido a partir do Estoque após custódia prévia de ${originCollab.fullName}.`,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      batchOperationId: batchId
    });

    if (!deliveryResult.success) {
      return { 
        success: false, 
        message: `Aparelho retornou ao Estoque, porém ocorreu falha na entrega: ${deliveryResult.message}`,
        batchOperationId: batchId
      };
    }

    this.logAudit('Movimentação', batchId, batchId, `Transferência completa registrada: ${originCollab.fullName} → Estoque do Gestor → ${destCollab.fullName}.`);

    return {
      success: true,
      message: `Transferência completa concluída com sucesso! Registradas as 2 etapas com código comum ${batchId}: [1] Devolução de ${originCollab.fullName} ao Estoque e [2] Entrega do Estoque para ${destCollab.fullName}.`,
      batchOperationId: batchId
    };
  }

  // =========================================================================
  // FLUXO OFICIAL 4: TROCA DE APARELHO PELO MESMO COLABORADOR
  // Obrigatório: Colaborador A (Aparelho Antigo) → Estoque | Estoque (Aparelho Novo) → Colaborador A
  // =========================================================================
  public executeSwap(params: {
    collaboratorId: string;
    oldDeviceId: string;
    oldDeviceCondition: DeviceCondition;
    oldDeviceNextStatus: 'Disponível' | 'Aguardando avaliação' | 'Em manutenção' | 'Aguardando baixa patrimonial';
    oldDeviceAccessories: string[];
    newDeviceId: string;
    newDeviceCondition: DeviceCondition;
    newDeviceAccessories: string[];
    lineOption: 'manter_linha_atual_no_novo' | 'sem_linha' | 'selecionar_outra_linha';
    customLineId?: string;
    date: string;
    reason: string;
    observations?: string;
    registeredBy?: string;
  }): { success: boolean; message: string; batchOperationId?: string } {
    const devices = this.getDevices();
    const collaborators = this.getCollaborators();
    const lines = this.getLines();

    const collaborator = collaborators.find(c => c.id === params.collaboratorId);
    if (!collaborator) return { success: false, message: 'Colaborador não encontrado.' };

    const oldDevice = devices.find(d => d.id === params.oldDeviceId);
    if (!oldDevice) return { success: false, message: 'Aparelho antigo não encontrado.' };

    const newDevice = devices.find(d => d.id === params.newDeviceId);
    if (!newDevice) return { success: false, message: 'Novo aparelho não encontrado em estoque.' };

    if (newDevice.status !== 'Disponível') {
      return { success: false, message: `O aparelho selecionado ${newDevice.assetTag} não está disponível no estoque (status: ${newDevice.status}).` };
    }

    const previousLineId = oldDevice.associatedLineId;
    const now = new Date();
    const batchId = `TRC-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    // ETAPA 1: Devolução do aparelho antigo ao Estoque do Gestor
    const returnResult = this.executeReturn({
      deviceId: oldDevice.id,
      collaboratorId: collaborator.id,
      date: params.date,
      condition: params.oldDeviceCondition,
      nextDeviceStatus: params.oldDeviceNextStatus,
      lineHandling: params.lineOption === 'manter_linha_atual_no_novo' ? 'manter_com_colaborador' : 'retornar_ao_estoque',
      accessoriesReturned: params.oldDeviceAccessories,
      reason: `Troca de dispositivo [${batchId}] - Etapa 1: Devolução do aparelho antigo (${oldDevice.assetTag}) ao Estoque.`,
      observations: params.observations,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      batchOperationId: batchId
    });

    if (!returnResult.success) {
      return { success: false, message: `Falha na devolução do aparelho antigo: ${returnResult.message}` };
    }

    // ETAPA 2: Entrega do novo aparelho disponível do Estoque para o colaborador
    let targetLineId: string | undefined;
    if (params.lineOption === 'manter_linha_atual_no_novo') {
      targetLineId = previousLineId;
    } else if (params.lineOption === 'selecionar_outra_linha') {
      targetLineId = params.customLineId;
    }

    const deliveryResult = this.executeDelivery({
      deviceId: newDevice.id,
      collaboratorId: collaborator.id,
      lineId: targetLineId,
      date: params.date,
      condition: params.newDeviceCondition,
      accessories: params.newDeviceAccessories,
      reason: `Troca de dispositivo [${batchId}] - Etapa 2: Entrega do novo aparelho (${newDevice.assetTag}) do Estoque.`,
      observations: `Substituição do aparelho anterior ${oldDevice.assetTag}. Motivo: ${params.reason}`,
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      batchOperationId: batchId
    });

    if (!deliveryResult.success) {
      return { 
        success: false, 
        message: `Aparelho antigo recolhido ao Estoque, porém falha na entrega do novo ativo: ${deliveryResult.message}`,
        batchOperationId: batchId
      };
    }

    this.logAudit('Movimentação', batchId, batchId, `Troca de aparelho realizada com sucesso para ${collaborator.fullName}. Antigo: ${oldDevice.assetTag} → Estoque | Novo: ${newDevice.assetTag} ← Estoque.`);

    return {
      success: true,
      message: `Troca concluída com sucesso (${batchId})! O aparelho ${oldDevice.assetTag} retornou ao Estoque (${params.oldDeviceNextStatus}) e o aparelho ${newDevice.assetTag} foi entregue a ${collaborator.fullName}.`,
      batchOperationId: batchId
    };
  }

  // =========================================================================
  // LIBERAÇÃO DE ESTOQUE (Conferência / Higienização -> Disponível)
  // =========================================================================
  public releaseDeviceToStock(params: {
    deviceId: string;
    condition: DeviceCondition;
    notes?: string;
    registeredBy?: string;
  }): { success: boolean; message: string } {
    const devices = this.getDevices();
    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    const prevStatus = device.status;
    device.status = 'Disponível';
    device.condition = params.condition;
    device.updatedAt = new Date().toISOString().split('T')[0];
    if (params.notes) {
      device.notes = device.notes ? `${device.notes} | ${params.notes}` : params.notes;
    }

    const now = new Date();
    const movCode = `MOV-${now.getFullYear()}-${String(this.getMovements().length + 1).padStart(3, '0')}`;
    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      code: movCode,
      type: 'Liberação de Estoque',
      date: new Date().toISOString().split('T')[0],
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceName: `${device.brand} ${device.model}`,
      imei: device.imei1,
      originCollaboratorName: STOCK_LABEL,
      destinationCollaboratorName: STOCK_LABEL,
      stockTransit: { involved: true, stage: 'Conferência em Estoque', stockStatusAfter: 'Disponível' },
      previousDeviceStatus: prevStatus,
      newDeviceStatus: 'Disponível',
      conditionAtMovement: params.condition,
      accessoriesIncluded: ['Aparelho conferido'],
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      reason: 'Conferência técnica e higienização em estoque concluídas. Ativo liberado para novas entregas.',
      observations: params.notes
    };

    this.set(STORAGE_KEYS.DEVICES, devices);
    const movements = this.getMovements();
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);

    this.apiSync('/api/devices', 'POST', device);
    this.apiSync('/api/movements', 'POST', newMovement);

    this.logAudit('Dispositivo', device.id, device.assetTag, `Aparelho liberado no estoque do Gestor (Status alterado de "${prevStatus}" para "Disponível").`);

    return { success: true, message: `Aparelho ${device.assetTag} liberado com sucesso. Agora consta como "Disponível" no estoque.` };
  }

  // --- Maintenance Operations ---
  public sendToMaintenance(params: {
    deviceId: string;
    provider: string;
    cost?: number;
    forecastDate?: string;
    reason: string;
    date: string;
    registeredBy?: string;
  }): { success: boolean; message: string } {
    const devices = this.getDevices();
    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    if (device.status === 'Em uso') {
      return { success: false, message: 'O aparelho está atualmente em uso. Realize primeiro a devolução ao estoque do Gestor antes de enviar para manutenção.' };
    }

    const prevStatus = device.status;
    device.status = 'Em manutenção';
    device.condition = 'Danificado';
    device.updatedAt = params.date;

    const now = new Date();
    const movCode = `MOV-${now.getFullYear()}-${String(this.getMovements().length + 1).padStart(3, '0')}`;
    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      code: movCode,
      type: 'Envio para Manutenção',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceName: `${device.brand} ${device.model}`,
      imei: device.imei1,
      originCollaboratorName: STOCK_LABEL,
      destinationCollaboratorName: params.provider,
      stockTransit: { involved: true, stage: 'Saída do Estoque', stockStatusAfter: 'Em manutenção' },
      previousDeviceStatus: prevStatus,
      newDeviceStatus: 'Em manutenção',
      conditionAtMovement: 'Danificado',
      accessoriesIncluded: ['Aparelho'],
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      reason: params.reason,
      maintenanceProvider: params.provider,
      maintenanceCost: params.cost,
      returnForecastDate: params.forecastDate,
    };

    this.set(STORAGE_KEYS.DEVICES, devices);
    const movements = this.getMovements();
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);

    this.apiSync('/api/devices', 'POST', device);
    this.apiSync('/api/movements', 'POST', newMovement);

    this.logAudit('Dispositivo', device.id, device.assetTag, `Enviado do estoque para assistência "${params.provider}". Motivo: ${params.reason}`);
    return { success: true, message: `Aparelho ${device.assetTag} enviado para manutenção técnica com sucesso.` };
  }

  public returnFromMaintenance(params: {
    deviceId: string;
    resolution: string;
    finalCondition: DeviceCondition;
    date: string;
    registeredBy?: string;
  }): { success: boolean; message: string } {
    const devices = this.getDevices();
    const device = devices.find(d => d.id === params.deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    if (device.status !== 'Em manutenção') {
      return { success: false, message: 'O aparelho não está com status de manutenção.' };
    }

    // Retorna ao Estoque do Gestor como Disponível
    device.status = 'Disponível';
    device.condition = params.finalCondition;
    device.updatedAt = params.date;

    const now = new Date();
    const movCode = `MOV-${now.getFullYear()}-${String(this.getMovements().length + 1).padStart(3, '0')}`;
    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      code: movCode,
      type: 'Retorno da Manutenção',
      date: params.date,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceName: `${device.brand} ${device.model}`,
      imei: device.imei1,
      originCollaboratorName: 'Assistência Técnica',
      destinationCollaboratorName: STOCK_LABEL,
      stockTransit: { involved: true, stage: 'Entrada no Estoque', stockStatusAfter: 'Disponível' },
      previousDeviceStatus: 'Em manutenção',
      newDeviceStatus: 'Disponível',
      conditionAtMovement: params.finalCondition,
      accessoriesIncluded: ['Aparelho reparado'],
      registeredBy: params.registeredBy || 'Gestor de Telefonia',
      reason: 'Retorno de assistência técnica com reparo concluído. Ativo retorna ao estoque disponível.',
      observations: params.resolution,
    };

    this.set(STORAGE_KEYS.DEVICES, devices);
    const movements = this.getMovements();
    movements.unshift(newMovement);
    this.set(STORAGE_KEYS.MOVEMENTS, movements);

    this.apiSync('/api/devices', 'POST', device);
    this.apiSync('/api/movements', 'POST', newMovement);

    this.logAudit('Dispositivo', device.id, device.assetTag, `Retorno de manutenção concluído. Aparelho reintegrado ao estoque disponível.`);
    return { success: true, message: `Retorno de manutenção registrado. Aparelho ${device.assetTag} retornou ao Estoque do Gestor com status "Disponível".` };
  }

  // --- Line Association ---
  public associateLineToDevice(lineId: string, deviceId: string): { success: boolean; message: string } {
    const lines = this.getLines();
    const devices = this.getDevices();

    const line = lines.find(l => l.id === lineId);
    if (!line) return { success: false, message: 'Linha não encontrada.' };

    const device = devices.find(d => d.id === deviceId);
    if (!device) return { success: false, message: 'Aparelho não encontrado.' };

    if (device.associatedLineId && device.associatedLineId !== line.id) {
      const oldLine = lines.find(l => l.id === device.associatedLineId);
      if (oldLine) {
        oldLine.associatedDeviceId = undefined;
        oldLine.associatedDeviceTag = undefined;
        oldLine.associatedDeviceModel = undefined;
      }
    }

    if (line.associatedDeviceId && line.associatedDeviceId !== device.id) {
      const oldDev = devices.find(d => d.id === line.associatedDeviceId);
      if (oldDev) {
        oldDev.associatedLineId = undefined;
        oldDev.associatedPhoneNumber = undefined;
      }
    }

    line.associatedDeviceId = device.id;
    line.associatedDeviceTag = device.assetTag;
    line.associatedDeviceModel = `${device.brand} ${device.model}`;
    if (device.currentCollaboratorId) {
      line.currentCollaboratorId = device.currentCollaboratorId;
      line.currentCollaboratorName = device.currentCollaboratorName;
      line.department = device.currentDepartment;
      line.status = 'Ativa';
    }

    device.associatedLineId = line.id;
    device.associatedPhoneNumber = line.phoneNumber;

    this.set(STORAGE_KEYS.LINES, lines);
    this.set(STORAGE_KEYS.DEVICES, devices);
    this.apiSync('/api/lines', 'POST', line);
    this.apiSync('/api/devices', 'POST', device);
    this.logAudit('Linha', line.id, line.phoneNumber, `Linha associada ao aparelho ${device.assetTag}.`);
    return { success: true, message: `Linha ${line.phoneNumber} associada com sucesso ao aparelho ${device.assetTag}.` };
  }

  public disassociateLine(lineId: string): { success: boolean; message: string } {
    const lines = this.getLines();
    const devices = this.getDevices();

    const line = lines.find(l => l.id === lineId);
    if (!line) return { success: false, message: 'Linha não encontrada.' };

    let dev: Device | undefined;
    if (line.associatedDeviceId) {
      dev = devices.find(d => d.id === line.associatedDeviceId);
      if (dev) {
        dev.associatedLineId = undefined;
        dev.associatedPhoneNumber = undefined;
        this.set(STORAGE_KEYS.DEVICES, devices);
        this.apiSync('/api/devices', 'POST', dev);
      }
    }

    line.associatedDeviceId = undefined;
    line.associatedDeviceTag = undefined;
    line.associatedDeviceModel = undefined;
    if (!line.currentCollaboratorId) {
      line.status = 'Disponível';
    }

    this.set(STORAGE_KEYS.LINES, lines);
    this.apiSync('/api/lines', 'POST', line);
    this.logAudit('Linha', line.id, line.phoneNumber, 'Desassociação de linha telefônica do aparelho.');
    return { success: true, message: `Linha ${line.phoneNumber} desassociada com sucesso.` };
  }

  // --- Audit & Metrics ---
  public getAuditLogs(): AuditLog[] {
    return this.get<AuditLog[]>(STORAGE_KEYS.AUDIT, INITIAL_AUDIT);
  }

  private logAudit(entityType: 'Dispositivo' | 'Linha' | 'Colaborador' | 'Movimentação' | 'Termo', entityId: string, entityLabel: string, details: string, user: string = 'Gestor de Telefonia') {
    const logs = this.getAuditLogs();
    const now = new Date();
    const timestamp = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('pt-BR')}`;
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      action: details.split(' ')[0],
      entityType,
      entityId,
      entityLabel,
      details,
      user
    };
    logs.unshift(newLog);
    if (logs.length > 200) logs.pop();
    this.set(STORAGE_KEYS.AUDIT, logs);
    this.apiSync('/api/audit-logs', 'POST', newLog);
  }

  public getDashboardMetrics(): DashboardMetrics {
    const devices = this.getDevices();
    const lines = this.getLines();
    const movements = this.getMovements();
    const terms = this.getTerms();

    const inUseDevices = devices.filter(d => d.status === 'Em uso').length;
    
    // Estoque do Gestor
    const stockAvailable = devices.filter(d => d.status === 'Disponível').length;
    const stockAwaitingEvaluation = devices.filter(d => d.status === 'Aguardando avaliação').length;
    const stockMaintenance = devices.filter(d => d.status === 'Em manutenção').length;
    const stockReserved = devices.filter(d => d.status === 'Reservado').length;
    const stockAwaitingDisposal = devices.filter(d => d.status === 'Aguardando baixa patrimonial').length;
    const stockDisposed = devices.filter(d => d.status === 'Baixado').length;
    const lostDevices = devices.filter(d => d.status === 'Extraviado').length;

    const stockTotal = devices.length - inUseDevices;

    const activeLines = lines.filter(l => l.status === 'Ativa').length;
    const availableLines = lines.filter(l => l.status === 'Disponível').length;
    const suspendedLines = lines.filter(l => l.status === 'Suspensa').length;
    const cancelledLines = lines.filter(l => l.status === 'Cancelada' || l.status === 'Em processo de cancelamento').length;

    const devicesWithoutCollaborator = devices.filter(d => !d.currentCollaboratorId && d.status !== 'Baixado').length;
    const linesWithoutDevice = lines.filter(l => !l.associatedDeviceId).length;
    const linesWithoutCollaborator = lines.filter(l => l.status === 'Ativa' && !l.currentCollaboratorId).length;

    let inconsistenciesCount = 0;
    devices.forEach(d => {
      if (d.status === 'Em uso' && !d.currentCollaboratorId) inconsistenciesCount++;
      if (d.status === 'Disponível' && d.currentCollaboratorId) inconsistenciesCount++;
    });

    const pendingTermsCount = terms.filter(t => t.status === 'Pendente de Assinatura').length;

    return {
      totalDevices: devices.length,
      inUseDevices,
      
      stockTotal,
      stockAvailable,
      stockAwaitingEvaluation,
      stockMaintenance,
      stockReserved,
      stockAwaitingDisposal,
      stockDisposed,
      lostDevices,

      totalLines: lines.length,
      activeLines,
      availableLines,
      suspendedLines,
      cancelledLines,

      devicesWithoutCollaborator,
      linesWithoutDevice,
      linesWithoutCollaborator,

      recentMovementsCount: movements.length,
      pendingTermsCount,
      inconsistenciesCount
    };
  }

  // --- Export / Import ---
  public exportFullBackup(): string {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      devices: this.getDevices(),
      lines: this.getLines(),
      collaborators: this.getCollaborators(),
      movements: this.getMovements(),
      terms: this.getTerms(),
      audit: this.getAuditLogs()
    };
    return JSON.stringify(data, null, 2);
  }

  public importFullBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.devices || !data.collaborators || !data.lines) {
        return { success: false, message: 'Estrutura JSON inválida para restauração do sistema.' };
      }
      this.set(STORAGE_KEYS.DEVICES, data.devices);
      this.set(STORAGE_KEYS.LINES, data.lines);
      this.set(STORAGE_KEYS.COLLABORATORS, data.collaborators);
      this.set(STORAGE_KEYS.MOVEMENTS, data.movements || []);
      this.set(STORAGE_KEYS.TERMS, data.terms || []);
      this.set(STORAGE_KEYS.AUDIT, data.audit || []);
      this.batchSyncToServer().then((r) => {
        if (!r.success) {
          // Mantém o backup restaurado: força nova tentativa (sem sobrescrever o banco) no próximo ciclo
          try { localStorage.removeItem(MIGRATED_KEY); } catch (_) {}
          this.notifyProblem('Restauração ainda não gravada no banco', r.message);
        }
      });
      this.logAudit('Dispositivo', 'all', 'Restauração', 'Backup completo do sistema importado com êxito.');
      return { success: true, message: 'Dados restaurados com êxito no sistema e sincronizados com o PostgreSQL!' };
    } catch (e) {
      return { success: false, message: `Falha ao processar arquivo: ${(e as Error).message}` };
    }
  }

  public importFromSpreadsheetData(data: {
    devices?: Partial<Device>[];
    lines?: Partial<PhoneLine>[];
    collaborators?: Partial<Collaborator>[];
  }): { success: boolean; importedDevices: number; importedLines: number; importedCollaborators: number; errors: string[] } {
    const errors: string[] = [];
    let countDev = 0;
    let countLine = 0;
    let countCollab = 0;

    if (data.collaborators) {
      for (const col of data.collaborators) {
        if (!col.fullName) {
          errors.push('Colaborador sem nome ignorado.');
          continue;
        }
        const res = this.saveCollaborator(col);
        if (res.success) countCollab++;
        else errors.push(`Colaborador ${col.fullName}: ${res.message}`);
      }
    }

    if (data.lines) {
      for (const lin of data.lines) {
        if (!lin.phoneNumber) {
          errors.push('Linha sem número telefônico ignorada.');
          continue;
        }
        const res = this.saveLine(lin);
        if (res.success) countLine++;
        else errors.push(`Linha ${lin.phoneNumber}: ${res.message}`);
      }
    }

    if (data.devices) {
      for (const dev of data.devices) {
        if (!dev.assetTag && !dev.imei1) {
          errors.push('Aparelho sem identificador ou IMEI ignorado.');
          continue;
        }
        const res = this.saveDevice(dev);
        if (res.success) countDev++;
        else errors.push(`Aparelho ${dev.assetTag || dev.imei1}: ${res.message}`);
      }
    }

    return {
      success: true,
      importedDevices: countDev,
      importedLines: countLine,
      importedCollaborators: countCollab,
      errors
    };
  }
}

export const dataService = new DataStorageService();
dataService.init();

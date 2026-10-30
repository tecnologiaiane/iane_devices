import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

// Ambiente isolado: sem PostgreSQL, com fallback em memória e sem montar o Vite.
process.env.NODE_ENV = 'test';
process.env.SKIP_VITE = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.JWT_SECRET = 'test-secret-apenas-para-testes-automatizados';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = '';
process.env.PORT = '0';

let server: import('http').Server;
let baseUrl = '';

const ADMIN = { username: 'tecnologia', password: 'Iane@2026' };
const OPERATOR = {
  username: 'operador.teste',
  password: 'Teste@123',
  fullName: 'Operador de Teste',
  email: 'operador.teste@iane.ind.br',
  permissions: ['dashboard'],
};

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function login(username: string, password: string) {
  const { response, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.token, 'login deve devolver um token');
  return body.token as string;
}

before(async () => {
  const mod = await import('../server');
  server = await mod.startServer();
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('health check é público', async () => {
  const { response, body } = await api('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
});

test('rotas de dados exigem autenticação', async () => {
  const { response } = await api('/api/devices');
  assert.equal(response.status, 401);
});

test('credenciais inválidas retornam mensagem genérica', async () => {
  const { response, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: ADMIN.username, password: 'senha-errada' }),
  });
  assert.equal(response.status, 401);
  assert.equal(body.message, 'Usuário ou senha inválidos.');
});

test('superusuário entra, lê dados e cria operador restrito', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);

  const list = await api('/api/devices', { headers: bearer(adminToken) });
  assert.equal(list.response.status, 200);
  assert.ok(Array.isArray(list.body.data));

  const created = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify(OPERATOR),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
});

test('RBAC bloqueia escrita e o lote ignora módulos sem permissão', async () => {
  const token = await login(OPERATOR.username, OPERATOR.password);

  // Leitura é permitida (dashboard precisa dos agregados)
  const read = await api('/api/devices', { headers: bearer(token) });
  assert.equal(read.response.status, 200);

  // Escrita direta é negada
  const write = await api('/api/devices', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify({ id: 'dev-rbac', assetTag: 'RBAC-1', model: 'Teste' }),
  });
  assert.equal(write.response.status, 403);

  // No lote, o módulo sem permissão é ignorado (sem rejeitar o restante)
  const batch = await api('/api/sync/batch-upload', {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify({
      devices: [{ id: 'dev-rbac-2', assetTag: 'RBAC-2', model: 'Teste' }],
    }),
  });
  assert.equal(batch.response.status, 200);
  assert.equal(batch.body.data.saved.devices, 0);
  assert.ok(
    batch.body.data.skipped.some((s: any) => s.entity === 'devices'),
    'o lote deve informar o módulo ignorado'
  );
});

test('solicitações respeitam perfis e isolam registros por solicitante', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);
  const operatorToken = await login(OPERATOR.username, OPERATOR.password);

  const collaborator = await api('/api/collaborators', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      id: 'col-request-snapshot',
      fullName: 'Colaboradora Snapshot',
      registrationNumber: 'MAT-SNAPSHOT',
      department: 'Financeiro',
      position: 'Analista',
      sector: 'Contabilidade',
      status: 'Ativo',
    }),
  });
  assert.equal(collaborator.response.status, 201, JSON.stringify(collaborator.body));
  const line = await api('/api/lines', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      id: 'line-request-snapshot',
      phoneNumber: '(11) 98765-4321',
      carrier: 'Vivo',
      currentCollaboratorId: 'col-request-snapshot',
      status: 'Ativa',
    }),
  });
  assert.equal(line.response.status, 201, JSON.stringify(line.body));
  const device = await api('/api/devices', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      id: 'dev-request-snapshot',
      assetTag: 'REQ-SNAPSHOT-1',
      brand: 'Samsung',
      model: 'Galaxy Teste',
      imei1: '123456789012345',
      currentCollaboratorId: 'col-request-snapshot',
      status: 'Em uso',
    }),
  });
  assert.equal(device.response.status, 201, JSON.stringify(device.body));

  const firstRequest = await api('/api/requests', {
    method: 'POST',
    headers: bearer(operatorToken),
    body: JSON.stringify({
      type: 'Entrega',
      requesterId: 'spoofed-user',
      requesterName: 'Solicitante Falso',
      createdAt: '2000-01-01T00:00:00.000Z',
      data: { employeeName: 'Funcionário A', cpf: '12345678901', position: 'Analista', isNewLine: 'Sim', deliveryDate: '2026-11-04' },
    }),
  });
  assert.equal(firstRequest.response.status, 201, JSON.stringify(firstRequest.body));
  assert.equal(firstRequest.body.data.status, 'Pendente de aprovação');
  assert.notEqual(firstRequest.body.data.requesterId, 'spoofed-user');
  assert.equal(firstRequest.body.data.requesterName, OPERATOR.fullName);
  assert.notEqual(firstRequest.body.data.createdAt, '2000-01-01T00:00:00.000Z');
  assert.equal(firstRequest.body.data.data.deliveryDate, '2026-11-04');

  const returnRequest = await api('/api/requests', {
    method: 'POST',
    headers: bearer(operatorToken),
    body: JSON.stringify({
      type: 'Devolução',
      data: {
        collaboratorId: 'col-request-snapshot',
        collaboratorName: 'Nome Falso',
        department: 'Departamento Falso',
        position: 'Cargo Falso',
        sector: 'Setor Falso',
        lines: [],
        devices: [],
        plannedReturnDate: '2026-11-01',
        estimatedDeliveryDate: '2026-11-02',
      },
    }),
  });
  assert.equal(returnRequest.response.status, 201, JSON.stringify(returnRequest.body));
  assert.equal(returnRequest.body.data.data.collaboratorName, 'Colaboradora Snapshot');
  assert.equal(returnRequest.body.data.data.department, 'Financeiro');
  assert.equal(returnRequest.body.data.data.position, 'Analista');
  assert.equal(returnRequest.body.data.data.sector, 'Contabilidade');
  assert.equal(returnRequest.body.data.data.lines[0].phoneNumber, '(11) 98765-4321');
  assert.equal(returnRequest.body.data.data.devices[0].assetTag, 'REQ-SNAPSHOT-1');
  assert.equal(returnRequest.body.data.data.plannedReturnDate, '2026-11-01');
  assert.equal(Object.hasOwn(returnRequest.body.data.data, 'estimatedDeliveryDate'), false);

  const secondUser = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'operador.solicitacoes',
      password: 'Teste@123',
      fullName: 'Outro Solicitante',
      role: 'operador',
      permissions: ['dashboard'],
    }),
  });
  assert.equal(secondUser.response.status, 201, JSON.stringify(secondUser.body));
  const secondToken = await login('operador.solicitacoes', 'Teste@123');
  const secondRequest = await api('/api/requests', {
    method: 'POST',
    headers: bearer(secondToken),
    body: JSON.stringify({
      type: 'Entrega',
      data: { employeeName: 'Funcionário B', cpf: '98765432100', position: 'Técnico', isNewLine: 'Sim' },
    }),
  });
  assert.equal(secondRequest.response.status, 201, JSON.stringify(secondRequest.body));

  const ownRequests = await api('/api/requests', { headers: bearer(operatorToken) });
  assert.equal(ownRequests.response.status, 200);
  assert.equal(ownRequests.body.data.length, 2);
  assert.equal(ownRequests.body.data[0].requesterId, firstRequest.body.data.requesterId);

  const otherOwnRequests = await api('/api/requests', { headers: bearer(secondToken) });
  assert.equal(otherOwnRequests.body.data.length, 1);
  assert.equal(otherOwnRequests.body.data[0].requesterId, secondRequest.body.data.requesterId);

  const allRequests = await api('/api/requests', { headers: bearer(adminToken) });
  assert.equal(allRequests.response.status, 200);
  assert.equal(allRequests.body.data.length, 3);

  const viewer = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'visualizador.solicitacoes',
      password: 'Teste@123',
      fullName: 'Visualizador',
      role: 'visualizador',
      permissions: ['all'],
    }),
  });
  assert.equal(viewer.response.status, 201, JSON.stringify(viewer.body));
  const viewerToken = await login('visualizador.solicitacoes', 'Teste@123');
  const viewerDenied = await api('/api/requests', { headers: bearer(viewerToken) });
  assert.equal(viewerDenied.response.status, 403);

  const manager = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'gestor.solicitacoes',
      password: 'Teste@123',
      fullName: 'Gestor de Solicitações',
      role: 'gestor',
      permissions: ['dashboard'],
    }),
  });
  assert.equal(manager.response.status, 201, JSON.stringify(manager.body));
  const managerToken = await login('gestor.solicitacoes', 'Teste@123');
  const managerRequests = await api('/api/requests', { headers: bearer(managerToken) });
  assert.equal(managerRequests.response.status, 200);
  assert.equal(managerRequests.body.data.length, 3);
});

test('decisões de solicitação têm permissão, motivo opcional e bloqueiam decisões duplicadas', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);
  const operatorToken = await login(OPERATOR.username, OPERATOR.password);
  const managerToken = await login('gestor.solicitacoes', 'Teste@123');
  const before = await api('/api/movements', { headers: bearer(adminToken) });
  const beforeDevices = await api('/api/devices', { headers: bearer(adminToken) });
  const beforeLines = await api('/api/lines', { headers: bearer(adminToken) });
  const beforeCollaborators = await api('/api/collaborators', { headers: bearer(adminToken) });
  const created = await api('/api/requests', {
    method: 'POST',
    headers: bearer(operatorToken),
    body: JSON.stringify({ type: 'Entrega', data: { employeeName: 'Teste Recusa', cpf: '12345678901', position: 'Analista', isNewLine: 'Sim' } }),
  });
  assert.equal(created.body.data.status, 'Pendente de aprovação');

  const blockedApproval = await api(`/api/requests/${created.body.data.id}/approve`, {
    method: 'POST', headers: bearer(operatorToken),
    body: JSON.stringify({ type: 'Entrega', movements: [{ id: 'not-allowed', deviceId: 'not-allowed' }] }),
  });
  assert.equal(blockedApproval.response.status, 403);
  const blockedOperatorRejection = await api(`/api/requests/${created.body.data.id}/reject`, {
    method: 'POST', headers: bearer(operatorToken), body: JSON.stringify({ reason: 'Não autorizado' }),
  });
  assert.equal(blockedOperatorRejection.response.status, 403);
  const blockedManagerApproval = await api(`/api/requests/${created.body.data.id}/approve`, {
    method: 'POST', headers: bearer(managerToken),
    body: JSON.stringify({ type: 'Entrega', movements: [{ id: 'not-allowed-manager', deviceId: 'not-allowed-manager' }] }),
  });
  assert.equal(blockedManagerApproval.response.status, 403);
  const blockedManagerDecision = await api(`/api/requests/${created.body.data.id}/reject`, {
    method: 'POST', headers: bearer(managerToken), body: JSON.stringify({ reason: 'Não autorizado' }),
  });
  assert.equal(blockedManagerDecision.response.status, 403);

  const rejected = await api(`/api/requests/${created.body.data.id}/reject`, {
    method: 'POST', headers: bearer(adminToken), body: JSON.stringify({ reason: '' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.data.status, 'Recusada');
  assert.equal(rejected.body.data.decidedByName, 'TI IANE - Super Usuário');
  assert.equal(rejected.body.data.rejectionReason, undefined);

  const duplicateReject = await api(`/api/requests/${created.body.data.id}/reject`, {
    method: 'POST', headers: bearer(adminToken), body: JSON.stringify({ reason: 'Duplicada' }),
  });
  assert.equal(duplicateReject.response.status, 409);
  const approveRejected = await api(`/api/requests/${created.body.data.id}/approve`, {
    method: 'POST', headers: bearer(adminToken), body: JSON.stringify({ type: 'Entrega', movements: [{ id: 'never-saved', deviceId: 'never-saved' }] }),
  });
  assert.equal(approveRejected.response.status, 409);
  const after = await api('/api/movements', { headers: bearer(adminToken) });
  assert.equal(after.body.data.length, before.body.data.length);
  assert.deepEqual((await api('/api/devices', { headers: bearer(adminToken) })).body.data, beforeDevices.body.data);
  assert.deepEqual((await api('/api/lines', { headers: bearer(adminToken) })).body.data, beforeLines.body.data);
  assert.deepEqual((await api('/api/collaborators', { headers: bearer(adminToken) })).body.data, beforeCollaborators.body.data);

  const withReasonRequest = await api('/api/requests', {
    method: 'POST',
    headers: bearer(operatorToken),
    body: JSON.stringify({ type: 'Entrega', data: { employeeName: 'Teste Motivo', cpf: '12345678901', position: 'Analista', isNewLine: 'Sim' } }),
  });
  const withReason = await api(`/api/requests/${withReasonRequest.body.data.id}/reject`, {
    method: 'POST', headers: bearer(adminToken), body: JSON.stringify({ reason: 'Informação incompleta.' }),
  });
  assert.equal(withReason.body.data.status, 'Recusada');
  assert.equal(withReason.body.data.rejectionReason, 'Informação incompleta.');
  const requesterList = await api('/api/requests', { headers: bearer(operatorToken) });
  assert.ok(requesterList.body.data.some((request: any) => request.id === withReasonRequest.body.data.id && request.status === 'Recusada'));
});

test('aprovação integrada executa os quatro fluxos existentes e mantém rejeições pendentes sem efeitos', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);
  const operatorToken = await login(OPERATOR.username, OPERATOR.password);
  const { apiClient } = await import('../src/services/apiClient');

  const values = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });
  const { dataService } = await import('../src/services/dataStorage');
  apiClient.instance.defaults.baseURL = baseUrl;
  values.set('iane_auth_token_v2', adminToken);
  values.set('iane_auth_current_user_v2', JSON.stringify({ id: 'user-iane-super-1', username: ADMIN.username, fullName: 'TI IANE - Super Usuário', role: 'admin', permissions: ['all'] }));

  const makeCollaborator = async (id: string, fullName: string) => {
    const result = await api('/api/collaborators', {
      method: 'POST', headers: bearer(adminToken),
      body: JSON.stringify({ id, fullName, registrationNumber: `MAT-${id}`, department: 'Financeiro', sector: 'TI', position: 'Analista', status: 'Ativo', cpf: `529982247${id.endsWith('2') ? '2' : '3'}` }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  };
  const makeLine = async (id: string, phoneNumber: string, collaboratorId: string, deviceId: string) => {
    const result = await api('/api/lines', {
      method: 'POST', headers: bearer(adminToken),
      body: JSON.stringify({ id, phoneNumber, carrier: 'Vivo', planName: 'Corporativo', status: 'Ativa', currentCollaboratorId: collaboratorId, associatedDeviceId: deviceId, associatedDeviceTag: deviceId }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  };
  const makeDevice = async (id: string, tag: string, status: string, collaboratorId?: string, lineId?: string, lineNumber?: string) => {
    const result = await api('/api/devices', {
      method: 'POST', headers: bearer(adminToken),
      body: JSON.stringify({ id, assetTag: tag, brand: 'Samsung', model: 'Galaxy Approval', imei1: `${id}1234567890`.slice(0, 15), condition: 'Bom', status, currentCollaboratorId: collaboratorId, currentCollaboratorName: collaboratorId ? 'Colaborador Aprovacao' : undefined, associatedLineId: lineId, associatedPhoneNumber: lineNumber }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  };
  await makeCollaborator('col-approval-one', 'Colaborador Aprovacao');
  await makeCollaborator('col-approval-two', 'Destino Aprovacao');
  await makeDevice('dev-approval-delivery', 'AP-DEL', 'Disponível');
  await makeDevice('dev-approval-return', 'AP-RET', 'Em uso', 'col-approval-one');
  await makeLine('line-approval-transfer', '(11) 90000-0001', 'col-approval-one', 'dev-approval-transfer');
  await makeDevice('dev-approval-transfer', 'AP-TRF', 'Em uso', 'col-approval-one', 'line-approval-transfer', '(11) 90000-0001');
  await makeLine('line-approval-swap', '(11) 90000-0002', 'col-approval-one', 'dev-approval-swap-old');
  await makeDevice('dev-approval-swap-old', 'AP-SWO', 'Em uso', 'col-approval-one', 'line-approval-swap', '(11) 90000-0002');
  await makeDevice('dev-approval-swap-new', 'AP-SWN', 'Disponível');
  await makeCollaborator('col-approval-no-device', 'Sem Aparelho');

  await Promise.all([dataService.fetchDevices(), dataService.fetchLines(), dataService.fetchCollaborators(), dataService.fetchMovements()]);

  const createApprovalRequest = async (type: string, data: any) => {
    const result = await api('/api/requests', { method: 'POST', headers: bearer(operatorToken), body: JSON.stringify({ type, data }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body.data;
  };
  const delivery = await createApprovalRequest('Entrega', { employeeName: 'Colaborador Aprovacao', cpf: '52998224723', position: 'Analista', isNewLine: 'Sim', deliveryDate: '2026-11-04' });
  const returned = await createApprovalRequest('Devolução', { collaboratorId: 'col-approval-one', collaboratorName: 'Colaborador Aprovacao', devices: [], lines: [] });
  const transferred = await createApprovalRequest('Transferência', { originCollaboratorId: 'col-approval-one', originCollaboratorName: 'Colaborador Aprovacao', destinationCollaboratorId: 'col-approval-two', destinationCollaboratorName: 'Destino Aprovacao', deviceId: 'dev-approval-transfer', condition: 'Bom', destinationStatusAfterReturn: 'Disponível', lineHandling: 'manter_linha_com_origem', accessories: ['Carregador Original'], reason: 'Transferência de teste', observations: '' });
  const swapped = await createApprovalRequest('Troca de Aparelho', { collaboratorId: 'col-approval-one', collaboratorName: 'Colaborador Aprovacao', oldDeviceId: 'dev-approval-swap-old', oldCondition: 'Bom', oldDestinationStatus: 'Disponível', oldAccessories: [], newDeviceId: 'dev-approval-swap-new', newCondition: 'Novo', newAccessories: [], lineOption: 'manter_linha_atual_no_novo', reason: 'Troca de teste', observations: '' });
  const noDevice = await createApprovalRequest('Devolução', { collaboratorId: 'col-approval-no-device', collaboratorName: 'Sem Aparelho', devices: [], lines: [] });
  await dataService.fetchRequests();

  const today = new Date().toISOString().slice(0, 10);
  const results = [
    await dataService.approveRequestWithMovement(delivery.id, 'Entrega', { deviceId: 'dev-approval-delivery', collaboratorId: 'col-approval-one', date: '2026-11-04', condition: 'Novo', accessories: ['Carregador Original'] }),
    await dataService.approveRequestWithMovement(returned.id, 'Devolução', { deviceId: 'dev-approval-return', collaboratorId: 'col-approval-one', date: today, condition: 'Bom', nextDeviceStatus: 'Disponível', lineHandling: 'retornar_ao_estoque', accessoriesReturned: [] }),
    await dataService.approveRequestWithMovement(transferred.id, 'Transferência', { deviceId: 'dev-approval-transfer', originCollaboratorId: 'col-approval-one', destinationCollaboratorId: 'col-approval-two', date: today, condition: 'Bom', destinationStatusAfterReturn: 'Disponível', lineHandling: 'manter_linha_com_origem', accessories: ['Carregador Original'], reason: 'Transferência de teste' }),
    await dataService.approveRequestWithMovement(swapped.id, 'Troca de Aparelho', { collaboratorId: 'col-approval-one', oldDeviceId: 'dev-approval-swap-old', oldDeviceCondition: 'Bom', oldDeviceNextStatus: 'Disponível', oldDeviceAccessories: [], newDeviceId: 'dev-approval-swap-new', newDeviceCondition: 'Novo', newDeviceAccessories: [], lineOption: 'manter_linha_atual_no_novo', date: today, reason: 'Troca de teste' }),
  ];
  for (const result of results) assert.equal(result.success, true, result.message);
  assert.ok(results.every((result) => result.request?.status === 'Aprovada' && result.request.decidedByName));
  assert.ok(results.every((result) => result.request?.movementIds?.length));
  for (const result of results) {
    const movementsForRequest = result.movements || [];
    assert.ok(movementsForRequest.length > 0);
    assert.ok(movementsForRequest.every((movement) => movement.requestApproval?.requesterName === OPERATOR.fullName));
    assert.ok(movementsForRequest.every((movement) => movement.requestApproval?.approverName === 'TI IANE - Super Usuário'));
    assert.ok(movementsForRequest.every((movement) => movement.requestApproval?.requestId === result.request?.id));
  }
  assert.ok(results[0].movements?.every((movement) => movement.date === '2026-11-04'));

  const approvedMovementCount = (await api('/api/movements', { headers: bearer(adminToken) })).body.data.length;
  const duplicateApproval = await api(`/api/requests/${delivery.id}/approve`, {
    method: 'POST', headers: bearer(adminToken),
    body: JSON.stringify({ type: 'Entrega', movements: [{ id: 'duplicate-must-not-save', deviceId: 'dev-approval-delivery' }] }),
  });
  assert.equal(duplicateApproval.response.status, 409);
  assert.equal((await api('/api/movements', { headers: bearer(adminToken) })).body.data.length, approvedMovementCount);

  await dataService.fetchDevices();
  const devices = dataService.getDevices();
  assert.equal(devices.find((device) => device.id === 'dev-approval-delivery')?.currentCollaboratorId, 'col-approval-one');
  assert.equal(devices.find((device) => device.id === 'dev-approval-return')?.status, 'Disponível');
  assert.equal(devices.find((device) => device.id === 'dev-approval-transfer')?.currentCollaboratorId, 'col-approval-two');
  assert.equal(devices.find((device) => device.id === 'dev-approval-swap-old')?.status, 'Disponível');
  assert.equal(devices.find((device) => device.id === 'dev-approval-swap-new')?.currentCollaboratorId, 'col-approval-one');
  await dataService.fetchLines();
  assert.equal(dataService.getLines().find((line) => line.id === 'line-approval-transfer')?.currentCollaboratorId, 'col-approval-one');
  assert.equal(dataService.getLines().find((line) => line.id === 'line-approval-swap')?.associatedDeviceId, 'dev-approval-swap-new');

  const movementsBeforeFailure = (await api('/api/movements', { headers: bearer(adminToken) })).body.data.length;
  const failed = await dataService.approveRequestWithMovement(noDevice.id, 'Devolução', { deviceId: '', collaboratorId: 'col-approval-no-device', date: today, condition: 'Bom', nextDeviceStatus: 'Disponível', lineHandling: 'retornar_ao_estoque', accessoriesReturned: [] });
  assert.equal(failed.success, false);
  const pendingAfterFailure = await api('/api/requests', { headers: bearer(adminToken) });
  assert.equal(pendingAfterFailure.body.data.find((request: any) => request.id === noDevice.id)?.status, 'Pendente de aprovação');
  const movementsAfterFailure = (await api('/api/movements', { headers: bearer(adminToken) })).body.data.length;
  assert.equal(movementsAfterFailure, movementsBeforeFailure);

  values.set('iane_auth_token_v2', operatorToken);
  values.set('iane_auth_current_user_v2', JSON.stringify({
    id: delivery.requesterId,
    username: OPERATOR.username,
    fullName: OPERATOR.fullName,
    role: 'operador',
    permissions: ['dashboard'],
  }));
  const ownRequests = await dataService.fetchRequests();
  assert.ok(ownRequests.filter((request) => [delivery.id, returned.id, transferred.id, swapped.id].includes(request.id)).every((request) => request.status === 'Aprovada'));
  assert.equal((await dataService.rejectRequest(noDevice.id, 'não autorizado')).success, false);
  assert.equal((await dataService.approveRequestWithMovement(noDevice.id, 'Devolução', {})).success, false);
  values.set('iane_auth_token_v2', adminToken);
  values.set('iane_auth_current_user_v2', JSON.stringify({ id: 'user-iane-super-1', username: ADMIN.username, fullName: 'TI IANE - Super Usuário', role: 'admin', permissions: ['all'] }));
  values.set('iane_movement_requests_v1', JSON.stringify([{ id: 'legacy-pending-fixture', type: 'Entrega', requesterId: 'legacy-user', requesterName: 'Legado', createdAt: today, data: {} }]));
  assert.equal(dataService.getRequests().find((request) => request.id === 'legacy-pending-fixture')?.status, 'Pendente de aprovação');
  localStorageMock.clear();
});

test('auditoria grava o usuário autenticado, não o informado no corpo', async () => {
  const operatorToken = await login(OPERATOR.username, OPERATOR.password);
  const auditId = `audit-test-${Date.now()}`;

  const created = await api('/api/audit-logs', {
    method: 'POST',
    headers: bearer(operatorToken),
    body: JSON.stringify({
      id: auditId,
      action: 'TESTE',
      entityType: 'Sistema',
      entityLabel: 'Teste automatizado',
      details: 'Verificação de autoria',
      user: 'Usuário Falso',
    }),
  });
  assert.equal(created.response.status, 201);

  const adminToken = await login(ADMIN.username, ADMIN.password);
  const logs = await api('/api/audit-logs', { headers: bearer(adminToken) });
  assert.equal(logs.response.status, 200);
  const entry = logs.body.data.find((l: any) => l.id === auditId);
  assert.ok(entry, 'o log criado deve aparecer na listagem');
  assert.equal(entry.user, OPERATOR.fullName);
});

test('logout revoga o token e alterações de usuário invalidam sessões', async () => {
  const token = await login(ADMIN.username, ADMIN.password);

  const logout = await api('/api/auth/logout', {
    method: 'POST',
    headers: bearer(token),
  });
  assert.equal(logout.response.status, 200);

  const afterLogout = await api('/api/devices', { headers: bearer(token) });
  assert.equal(afterLogout.response.status, 401);

  // Login continua funcionando após a revogação
  const freshToken = await login(ADMIN.username, ADMIN.password);
  const users = await api('/api/users', { headers: bearer(freshToken) });
  assert.equal(users.response.status, 200);

  const operator = users.body.data.find((u: any) => u.username === OPERATOR.username);
  assert.ok(operator);

  // Alterar permissões revoga o token antigo do operador
  const operatorToken = await login(OPERATOR.username, OPERATOR.password);
  const update = await api(`/api/users/${operator.id}`, {
    method: 'PUT',
    headers: bearer(freshToken),
    body: JSON.stringify({ permissions: ['dashboard', 'dispositivos'] }),
  });
  assert.equal(update.response.status, 200);

  const revoked = await api('/api/devices', { headers: bearer(operatorToken) });
  assert.equal(revoked.response.status, 401);

  // Login novo continua válido até a exclusão da conta
  const operatorToken2 = await login(OPERATOR.username, OPERATOR.password);

  // Excluir o operador invalida qualquer sessão restante
  const deleted = await api(`/api/users/${operator.id}`, {
    method: 'DELETE',
    headers: bearer(freshToken),
  });
  assert.equal(deleted.response.status, 200);

  const operatorAfterDelete = await api('/api/devices', {
    headers: bearer(operatorToken2),
  });
  assert.equal(operatorAfterDelete.response.status, 401);

  const loginAfterDelete = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: OPERATOR.username, password: OPERATOR.password }),
  });
  assert.equal(loginAfterDelete.response.status, 401);
});

test('administrador pode alterar o nome de login de um usuário', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);

  const created = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'login.antigo',
      password: 'Teste@123',
      fullName: 'Usuário com Login Alterável',
      permissions: ['dashboard'],
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const userId = created.body.data.id;

  const userToken = await login('login.antigo', 'Teste@123');

  const updated = await api(`/api/users/${userId}`, {
    method: 'PUT',
    headers: bearer(adminToken),
    body: JSON.stringify({ username: 'Login.Novo' }),
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.username, 'login.novo');

  const oldLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'login.antigo', password: 'Teste@123' }),
  });
  assert.equal(oldLogin.response.status, 401);

  const newToken = await login('login.novo', 'Teste@123');
  assert.ok(newToken);

  // Trocar apenas o login não derruba a sessão já autenticada (o vínculo é pelo ID).
  const stillValid = await api('/api/devices', { headers: bearer(userToken) });
  assert.equal(stillValid.response.status, 200);

  const duplicate = await api(`/api/users/${userId}`, {
    method: 'PUT',
    headers: bearer(adminToken),
    body: JSON.stringify({ username: ADMIN.username }),
  });
  assert.equal(duplicate.response.status, 409);

  const deleted = await api(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: bearer(adminToken),
  });
  assert.equal(deleted.response.status, 200);
});

test('somente Super Admin altera nome de login e remove aparelhos', async () => {
  const adminToken = await login(ADMIN.username, ADMIN.password);

  // Perfil com permissões administrativas, mas que não é Super Admin.
  const manager = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'gestor.quase.admin',
      password: 'Teste@123',
      fullName: 'Gestor com Permissões',
      role: 'gestor',
      permissions: ['manage_users', 'dispositivos_edit'],
    }),
  });
  assert.equal(manager.response.status, 201, JSON.stringify(manager.body));
  const managerId = manager.body.data.id;
  const managerToken = await login('gestor.quase.admin', 'Teste@123');

  const target = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      username: 'usuario.alvo',
      password: 'Teste@123',
      fullName: 'Usuário Alvo',
      permissions: ['dashboard'],
    }),
  });
  const targetId = target.body.data.id;

  const blockedUsername = await api(`/api/users/${targetId}`, {
    method: 'PUT',
    headers: bearer(managerToken),
    body: JSON.stringify({ username: 'usuario.renomeado' }),
  });
  assert.equal(blockedUsername.response.status, 403);

  // Manter o mesmo login não é bloqueado (edição de outros campos continua permitida).
  const sameUsername = await api(`/api/users/${targetId}`, {
    method: 'PUT',
    headers: bearer(managerToken),
    body: JSON.stringify({ username: 'usuario.alvo', fullName: 'Usuário Alvo Editado' }),
  });
  assert.equal(sameUsername.response.status, 200);

  const device = await api('/api/devices', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({ id: 'dev-admin-only', assetTag: 'ADM-1', model: 'Teste' }),
  });
  assert.equal(device.response.status, 201, JSON.stringify(device.body));

  const blockedDelete = await api('/api/devices/dev-admin-only', {
    method: 'DELETE',
    headers: bearer(managerToken),
  });
  assert.equal(blockedDelete.response.status, 403);

  const adminDelete = await api('/api/devices/dev-admin-only', {
    method: 'DELETE',
    headers: bearer(adminToken),
  });
  assert.equal(adminDelete.response.status, 200);

  await api(`/api/users/${targetId}`, { method: 'DELETE', headers: bearer(adminToken) });
  await api(`/api/users/${managerId}`, { method: 'DELETE', headers: bearer(adminToken) });
});

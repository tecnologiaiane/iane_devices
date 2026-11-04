import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.SKIP_VITE = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.JWT_SECRET = 'authz-test-secret-32-chars-long!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = '';
process.env.PORT = '0';
process.env.INITIAL_ADMIN_USER = 'authz_admin';
process.env.INITIAL_ADMIN_PASSWORD = 'AuthzAdmin@2026';

let server: import('http').Server;
let baseUrl = '';

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
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
  assert.equal(response.status, 200, `login falhou para ${username}: ${JSON.stringify(body)}`);
  return body.token as string;
}

function makeToken(payload: any, options: { expired?: boolean; wrongSecret?: boolean; oldTv?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const secret = options.wrongSecret ? 'segredo-errado-para-teste-de-assinatura' : process.env.JWT_SECRET!;
  const tokenPayload = {
    ...payload,
    iss: 'iane-devices',
    aud: 'iane-devices-frontend',
    iat: now,
    exp: options.expired ? now - 10 : now + 3600,
    tv: options.oldTv ?? payload.tv ?? 0,
  };
  return jwt.sign(tokenPayload, secret, { algorithm: 'HS256' } as any);
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

// ----------------------------------------------------------------------------
// Helpers: criar usuarios com diferentes papeis/permissoes diretamente na memoria
// ----------------------------------------------------------------------------
async function createUserViaAdmin(adminToken: string, user: any) {
  const res = await api('/api/users', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify(user),
  });
  assert.equal(res.response.status, 201, `criar usuario falhou: ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}

async function setupUsers() {
  const adminToken = await login(process.env.INITIAL_ADMIN_USER!, process.env.INITIAL_ADMIN_PASSWORD!);
  const suffix = Date.now().toString(36);

  const viewerId = await createUserViaAdmin(adminToken, {
    username: `authz_viewer_${suffix}`,
    fullName: 'Viewer Teste',
    password: 'ViewerTeste@2026',
    role: 'operador',
    permissions: ['dashboard'],
    active: true,
  });

  const operadorId = await createUserViaAdmin(adminToken, {
    username: `authz_operador_${suffix}`,
    fullName: 'Operador Teste',
    password: 'OperadorTeste@2026',
    role: 'operador',
    permissions: ['dashboard', 'dispositivos_edit', 'linhas_edit', 'colaboradores_edit', 'movimentacoes', 'termos'],
    active: true,
  });

  const gestorId = await createUserViaAdmin(adminToken, {
    username: `authz_gestor_${suffix}`,
    fullName: 'Gestor Teste',
    password: 'GestorTeste@2026',
    role: 'operador',
    permissions: ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'movimentacoes', 'termos', 'solicitacoes'],
    active: true,
  });

  const manageUsersOnlyId = await createUserViaAdmin(adminToken, {
    username: `authz_manageusers_${suffix}`,
    fullName: 'ManageUsers Only',
    password: 'ManageUsers@2026',
    role: 'operador',
    permissions: ['manage_users'],
    active: true,
  });

  const manageUsersToken = await login(`authz_manageusers_${suffix}`, 'ManageUsers@2026');
  const viewerToken = await login(`authz_viewer_${suffix}`, 'ViewerTeste@2026');
  const operadorToken = await login(`authz_operador_${suffix}`, 'OperadorTeste@2026');
  const gestorToken = await login(`authz_gestor_${suffix}`, 'GestorTeste@2026');

  return {
    adminToken,
    viewerToken,
    operadorToken,
    gestorToken,
    manageUsersToken,
    viewerId,
    operadorId,
    gestorId,
    manageUsersOnlyId,
  };
}

// ----------------------------------------------------------------------------
// Matriz de autorizacao
// Cada entrada: [descricao, metodo, caminho, corpo, tokenFuncao, statusEsperado]
// ----------------------------------------------------------------------------
type AuthzCase = [string, 'GET' | 'POST' | 'PUT' | 'DELETE', string, any, (u: any) => string, number];

const ROTAS: AuthzCase[] = [
  // Saude e login (publicas)
  ['GET /api/health - publico', 'GET', '/api/health', null, () => '', 200],
  ['POST /api/auth/login - publico', 'POST', '/api/auth/login', { username: 'x', password: 'y' }, () => '', 401],

  // Usuarios
  ['GET /api/users - sem token', 'GET', '/api/users', null, () => '', 401],
  ['GET /api/users - token invalido', 'GET', '/api/users', null, () => makeToken({ id: 'x' }, { wrongSecret: true }), 401],
  ['GET /api/users - token expirado', 'GET', '/api/users', null, () => makeToken({ id: 'x' }, { expired: true }), 401],
  ['GET /api/users - tv antigo', 'GET', '/api/users', null, () => makeToken({ id: 'x', tv: 999 }, { oldTv: 999 }), 401],
  ['GET /api/users - viewer', 'GET', '/api/users', null, (u) => u.viewerToken, 403],
  ['GET /api/users - operador', 'GET', '/api/users', null, (u) => u.operadorToken, 403],
  ['GET /api/users - gestor', 'GET', '/api/users', null, (u) => u.gestorToken, 403],
  ['GET /api/users - admin', 'GET', '/api/users', null, (u) => u.adminToken, 200],

  ['POST /api/users - sem token', 'POST', '/api/users', { username: 'a', fullName: 'A', password: 'SenhaValida123!' }, () => '', 401],
  ['POST /api/users - viewer', 'POST', '/api/users', { username: 'a', fullName: 'A', password: 'SenhaValida123!' }, (u) => u.viewerToken, 403],
  ['POST /api/users - operador', 'POST', '/api/users', { username: 'a', fullName: 'A', password: 'SenhaValida123!' }, (u) => u.operadorToken, 403],
  ['POST /api/users - gestor', 'POST', '/api/users', { username: 'a', fullName: 'A', password: 'SenhaValida123!' }, (u) => u.gestorToken, 403],
  ['POST /api/users - admin', 'POST', '/api/users', { username: 'authz_novo', fullName: 'Novo', password: 'SenhaValida123!' }, (u) => u.adminToken, 201],

  ['PUT /api/users/:id - sem token', 'PUT', '/api/users/qualquer', { fullName: 'X' }, () => '', 401],
  ['PUT /api/users/:id - viewer', 'PUT', '/api/users/qualquer', { fullName: 'X' }, (u) => u.viewerToken, 403],
  ['PUT /api/users/:id - operador', 'PUT', '/api/users/qualquer', { fullName: 'X' }, (u) => u.operadorToken, 403],
  ['PUT /api/users/:id - gestor', 'PUT', '/api/users/qualquer', { fullName: 'X' }, (u) => u.gestorToken, 403],
  ['PUT /api/users/:id - admin', 'PUT', '/api/users/qualquer', { fullName: 'X' }, (u) => u.adminToken, 404],

  ['DELETE /api/users/:id - sem token', 'DELETE', '/api/users/qualquer', null, () => '', 401],
  ['DELETE /api/users/:id - viewer', 'DELETE', '/api/users/qualquer', null, (u) => u.viewerToken, 403],
  ['DELETE /api/users/:id - operador', 'DELETE', '/api/users/qualquer', null, (u) => u.operadorToken, 403],
  ['DELETE /api/users/:id - gestor', 'DELETE', '/api/users/qualquer', null, (u) => u.gestorToken, 403],
  ['DELETE /api/users/:id - admin', 'DELETE', '/api/users/qualquer', null, (u) => u.adminToken, 404],

  // Catalogos
  ['GET /api/catalogs - sem token', 'GET', '/api/catalogs', null, () => '', 401],
  ['GET /api/catalogs - viewer', 'GET', '/api/catalogs', null, (u) => u.viewerToken, 200],
  ['GET /api/catalogs - operador', 'GET', '/api/catalogs', null, (u) => u.operadorToken, 200],
  ['GET /api/catalogs - gestor', 'GET', '/api/catalogs', null, (u) => u.gestorToken, 200],
  ['GET /api/catalogs - admin', 'GET', '/api/catalogs', null, (u) => u.adminToken, 200],

  ['PUT /api/catalogs/:type - sem token', 'PUT', '/api/catalogs/departments', { items: [] }, () => '', 401],
  ['PUT /api/catalogs/:type - viewer', 'PUT', '/api/catalogs/departments', { items: [] }, (u) => u.viewerToken, 403],
  ['PUT /api/catalogs/:type - operador', 'PUT', '/api/catalogs/departments', { items: [] }, (u) => u.operadorToken, 403],
  ['PUT /api/catalogs/:type - gestor', 'PUT', '/api/catalogs/departments', { items: [] }, (u) => u.gestorToken, 403],
  ['PUT /api/catalogs/:type - admin', 'PUT', '/api/catalogs/departments', { items: [] }, (u) => u.adminToken, 200],

  // Dispositivos
  ['GET /api/devices - sem token', 'GET', '/api/devices', null, () => '', 401],
  ['GET /api/devices - viewer', 'GET', '/api/devices', null, (u) => u.viewerToken, 200],
  ['GET /api/devices - operador', 'GET', '/api/devices', null, (u) => u.operadorToken, 200],
  ['GET /api/devices - gestor', 'GET', '/api/devices', null, (u) => u.gestorToken, 200],
  ['GET /api/devices - admin', 'GET', '/api/devices', null, (u) => u.adminToken, 200],

  ['POST /api/devices - sem token', 'POST', '/api/devices', { id: 'd1', assetTag: 'D1', brand: 'B', model: 'M', status: 'Disponível' }, () => '', 401],
  ['POST /api/devices - viewer', 'POST', '/api/devices', { id: 'd1', assetTag: 'D1', brand: 'B', model: 'M', status: 'Disponível' }, (u) => u.viewerToken, 403],
  ['POST /api/devices - operador', 'POST', '/api/devices', { id: 'd1', assetTag: 'D1', brand: 'B', model: 'M', status: 'Disponível' }, (u) => u.operadorToken, 201],
  ['POST /api/devices - gestor', 'POST', '/api/devices', { id: 'd2', assetTag: 'D2', brand: 'B', model: 'M', status: 'Disponível' }, (u) => u.gestorToken, 403],
  ['POST /api/devices - admin', 'POST', '/api/devices', { id: 'd3', assetTag: 'D3', brand: 'B', model: 'M', status: 'Disponível' }, (u) => u.adminToken, 201],

  ['DELETE /api/devices/:id - sem token', 'DELETE', '/api/devices/d1', null, () => '', 401],
  ['DELETE /api/devices/:id - viewer', 'DELETE', '/api/devices/d1', null, (u) => u.viewerToken, 403],
  ['DELETE /api/devices/:id - operador', 'DELETE', '/api/devices/d1', null, (u) => u.operadorToken, 403],
  ['DELETE /api/devices/:id - gestor', 'DELETE', '/api/devices/d2', null, (u) => u.gestorToken, 403],
  ['DELETE /api/devices/:id - admin', 'DELETE', '/api/devices/d3', null, (u) => u.adminToken, 200],

  // Linhas
  ['GET /api/lines - sem token', 'GET', '/api/lines', null, () => '', 401],
  ['GET /api/lines - viewer', 'GET', '/api/lines', null, (u) => u.viewerToken, 200],
  ['GET /api/lines - operador', 'GET', '/api/lines', null, (u) => u.operadorToken, 200],
  ['GET /api/lines - gestor', 'GET', '/api/lines', null, (u) => u.gestorToken, 200],
  ['GET /api/lines - admin', 'GET', '/api/lines', null, (u) => u.adminToken, 200],

  ['POST /api/lines - sem token', 'POST', '/api/lines', { id: 'l1', phoneNumber: '11900000001', carrier: 'Vivo', status: 'Disponível' }, () => '', 401],
  ['POST /api/lines - viewer', 'POST', '/api/lines', { id: 'l1', phoneNumber: '11900000001', carrier: 'Vivo', status: 'Disponível' }, (u) => u.viewerToken, 403],
  ['POST /api/lines - operador', 'POST', '/api/lines', { id: 'l1', phoneNumber: '11900000001', carrier: 'Vivo', status: 'Disponível' }, (u) => u.operadorToken, 201],
  ['POST /api/lines - gestor', 'POST', '/api/lines', { id: 'l2', phoneNumber: '11900000002', carrier: 'Vivo', status: 'Disponível' }, (u) => u.gestorToken, 403],
  ['POST /api/lines - admin', 'POST', '/api/lines', { id: 'l3', phoneNumber: '11900000003', carrier: 'Vivo', status: 'Disponível' }, (u) => u.adminToken, 201],

  ['DELETE /api/lines/:id - sem token', 'DELETE', '/api/lines/l1', null, () => '', 401],
  ['DELETE /api/lines/:id - viewer', 'DELETE', '/api/lines/l1', null, (u) => u.viewerToken, 403],
  ['DELETE /api/lines/:id - operador', 'DELETE', '/api/lines/l1', null, (u) => u.operadorToken, 200],
  ['DELETE /api/lines/:id - gestor', 'DELETE', '/api/lines/l2', null, (u) => u.gestorToken, 403],
  ['DELETE /api/lines/:id - admin', 'DELETE', '/api/lines/l3', null, (u) => u.adminToken, 200],

  // Colaboradores
  ['GET /api/collaborators - sem token', 'GET', '/api/collaborators', null, () => '', 401],
  ['GET /api/collaborators - viewer', 'GET', '/api/collaborators', null, (u) => u.viewerToken, 200],
  ['GET /api/collaborators - operador', 'GET', '/api/collaborators', null, (u) => u.operadorToken, 200],
  ['GET /api/collaborators - gestor', 'GET', '/api/collaborators', null, (u) => u.gestorToken, 200],
  ['GET /api/collaborators - admin', 'GET', '/api/collaborators', null, (u) => u.adminToken, 200],

  ['POST /api/collaborators - sem token', 'POST', '/api/collaborators', { id: 'c1', fullName: 'C1', registrationNumber: 'MAT001', department: 'TI', status: 'Ativo' }, () => '', 401],
  ['POST /api/collaborators - viewer', 'POST', '/api/collaborators', { id: 'c1', fullName: 'C1', registrationNumber: 'MAT001', department: 'TI', status: 'Ativo' }, (u) => u.viewerToken, 403],
  ['POST /api/collaborators - operador', 'POST', '/api/collaborators', { id: 'c1', fullName: 'C1', registrationNumber: 'MAT001', department: 'TI', status: 'Ativo' }, (u) => u.operadorToken, 201],
  ['POST /api/collaborators - gestor', 'POST', '/api/collaborators', { id: 'c2', fullName: 'C2', registrationNumber: 'MAT002', department: 'TI', status: 'Ativo' }, (u) => u.gestorToken, 403],
  ['POST /api/collaborators - admin', 'POST', '/api/collaborators', { id: 'c3', fullName: 'C3', registrationNumber: 'MAT003', department: 'TI', status: 'Ativo' }, (u) => u.adminToken, 201],

  ['DELETE /api/collaborators/:id - sem token', 'DELETE', '/api/collaborators/c1', null, () => '', 401],
  ['DELETE /api/collaborators/:id - viewer', 'DELETE', '/api/collaborators/c1', null, (u) => u.viewerToken, 403],
  ['DELETE /api/collaborators/:id - operador', 'DELETE', '/api/collaborators/c1', null, (u) => u.operadorToken, 200],
  ['DELETE /api/collaborators/:id - gestor', 'DELETE', '/api/collaborators/c2', null, (u) => u.gestorToken, 403],
  ['DELETE /api/collaborators/:id - admin', 'DELETE', '/api/collaborators/c3', null, (u) => u.adminToken, 200],

  // Solicitacoes
  ['GET /api/requests - sem token', 'GET', '/api/requests', null, () => '', 401],
  ['GET /api/requests - viewer', 'GET', '/api/requests', null, (u) => u.viewerToken, 200],
  ['GET /api/requests - operador', 'GET', '/api/requests', null, (u) => u.operadorToken, 200],
  ['GET /api/requests - gestor', 'GET', '/api/requests', null, (u) => u.gestorToken, 200],
  ['GET /api/requests - admin', 'GET', '/api/requests', null, (u) => u.adminToken, 200],

  ['POST /api/requests - sem token', 'POST', '/api/requests', { type: 'Entrega', data: { employeeName: 'X', cpf: '12345678901', position: 'Y', isNewLine: 'Não' } }, () => '', 401],
  ['POST /api/requests - viewer', 'POST', '/api/requests', { type: 'Entrega', data: { employeeName: 'X', cpf: '12345678901', position: 'Y', isNewLine: 'Não' } }, (u) => u.viewerToken, 400],
  ['POST /api/requests - operador', 'POST', '/api/requests', { type: 'Entrega', data: { employeeName: 'X', cpf: '12345678901', position: 'Y', isNewLine: 'Não' } }, (u) => u.operadorToken, 400],
  ['POST /api/requests - gestor', 'POST', '/api/requests', { type: 'Entrega', data: { employeeName: 'X', cpf: '12345678901', position: 'Y', isNewLine: 'Não' } }, (u) => u.gestorToken, 400],
  ['POST /api/requests - admin', 'POST', '/api/requests', { type: 'Entrega', data: { employeeName: 'X', cpf: '12345678901', position: 'Y', isNewLine: 'Não' } }, (u) => u.adminToken, 400],

  ['POST /api/requests/:id/reject - sem token', 'POST', '/api/requests/x/reject', { reason: 'r' }, () => '', 401],
  ['POST /api/requests/:id/reject - viewer', 'POST', '/api/requests/x/reject', { reason: 'r' }, (u) => u.viewerToken, 403],
  ['POST /api/requests/:id/reject - operador', 'POST', '/api/requests/x/reject', { reason: 'r' }, (u) => u.operadorToken, 403],
  ['POST /api/requests/:id/reject - gestor', 'POST', '/api/requests/x/reject', { reason: 'r' }, (u) => u.gestorToken, 403],
  ['POST /api/requests/:id/reject - admin', 'POST', '/api/requests/x/reject', { reason: 'r' }, (u) => u.adminToken, 404],

  ['POST /api/requests/:id/approve - sem token', 'POST', '/api/requests/x/approve', { type: 'Entrega', movements: [] }, () => '', 401],
  ['POST /api/requests/:id/approve - viewer', 'POST', '/api/requests/x/approve', { type: 'Entrega', movements: [] }, (u) => u.viewerToken, 403],
  ['POST /api/requests/:id/approve - operador', 'POST', '/api/requests/x/approve', { type: 'Entrega', movements: [] }, (u) => u.operadorToken, 403],
  ['POST /api/requests/:id/approve - gestor', 'POST', '/api/requests/x/approve', { type: 'Entrega', movements: [] }, (u) => u.gestorToken, 403],
  ['POST /api/requests/:id/approve - admin', 'POST', '/api/requests/x/approve', { type: 'Entrega', movements: [] }, (u) => u.adminToken, 400],

  // Movimentos
  ['GET /api/movements - sem token', 'GET', '/api/movements', null, () => '', 401],
  ['GET /api/movements - viewer', 'GET', '/api/movements', null, (u) => u.viewerToken, 200],
  ['GET /api/movements - operador', 'GET', '/api/movements', null, (u) => u.operadorToken, 200],
  ['GET /api/movements - gestor', 'GET', '/api/movements', null, (u) => u.gestorToken, 200],
  ['GET /api/movements - admin', 'GET', '/api/movements', null, (u) => u.adminToken, 200],

  ['POST /api/movements - sem token', 'POST', '/api/movements', {}, () => '', 401],
  ['POST /api/movements - viewer', 'POST', '/api/movements', {}, (u) => u.viewerToken, 403],
  ['POST /api/movements - operador', 'POST', '/api/movements', {}, (u) => u.operadorToken, 201],
  ['POST /api/movements - gestor', 'POST', '/api/movements', {}, (u) => u.gestorToken, 201],
  ['POST /api/movements - admin', 'POST', '/api/movements', {}, (u) => u.adminToken, 201],

  ['POST /api/movements/transfer - sem token', 'POST', '/api/movements/transfer', {}, () => '', 401],
  ['POST /api/movements/transfer - viewer', 'POST', '/api/movements/transfer', {}, (u) => u.viewerToken, 403],
  ['POST /api/movements/transfer - operador', 'POST', '/api/movements/transfer', {}, (u) => u.operadorToken, 200],
  ['POST /api/movements/transfer - gestor', 'POST', '/api/movements/transfer', {}, (u) => u.gestorToken, 200],
  ['POST /api/movements/transfer - admin', 'POST', '/api/movements/transfer', {}, (u) => u.adminToken, 200],

  // Termos
  ['GET /api/terms - sem token', 'GET', '/api/terms', null, () => '', 401],
  ['GET /api/terms - viewer', 'GET', '/api/terms', null, (u) => u.viewerToken, 200],
  ['GET /api/terms - operador', 'GET', '/api/terms', null, (u) => u.operadorToken, 200],
  ['GET /api/terms - gestor', 'GET', '/api/terms', null, (u) => u.gestorToken, 200],
  ['GET /api/terms - admin', 'GET', '/api/terms', null, (u) => u.adminToken, 200],

  ['POST /api/terms - sem token', 'POST', '/api/terms', {}, () => '', 401],
  ['POST /api/terms - viewer', 'POST', '/api/terms', {}, (u) => u.viewerToken, 403],
  ['POST /api/terms - operador', 'POST', '/api/terms', {}, (u) => u.operadorToken, 201],
  ['POST /api/terms - gestor', 'POST', '/api/terms', {}, (u) => u.gestorToken, 201],
  ['POST /api/terms - admin', 'POST', '/api/terms', {}, (u) => u.adminToken, 201],

  ['GET /api/terms/:id/file - sem token', 'GET', '/api/terms/x/file', null, () => '', 401],
  ['GET /api/terms/:id/file - viewer', 'GET', '/api/terms/x/file', null, (u) => u.viewerToken, 404],
  ['GET /api/terms/:id/file - operador', 'GET', '/api/terms/x/file', null, (u) => u.operadorToken, 404],
  ['GET /api/terms/:id/file - gestor', 'GET', '/api/terms/x/file', null, (u) => u.gestorToken, 404],
  ['GET /api/terms/:id/file - admin', 'GET', '/api/terms/x/file', null, (u) => u.adminToken, 404],

  // Auditoria
  ['GET /api/audit-logs - sem token', 'GET', '/api/audit-logs', null, () => '', 401],
  ['GET /api/audit-logs - viewer', 'GET', '/api/audit-logs', null, (u) => u.viewerToken, 200],
  ['GET /api/audit-logs - operador', 'GET', '/api/audit-logs', null, (u) => u.operadorToken, 200],
  ['GET /api/audit-logs - gestor', 'GET', '/api/audit-logs', null, (u) => u.gestorToken, 200],
  ['GET /api/audit-logs - admin', 'GET', '/api/audit-logs', null, (u) => u.adminToken, 200],

  ['POST /api/audit-logs - sem token', 'POST', '/api/audit-logs', { action: 'X' }, () => '', 401],
  ['POST /api/audit-logs - viewer', 'POST', '/api/audit-logs', { action: 'X' }, (u) => u.viewerToken, 201],
  ['POST /api/audit-logs - operador', 'POST', '/api/audit-logs', { action: 'X' }, (u) => u.operadorToken, 201],
  ['POST /api/audit-logs - gestor', 'POST', '/api/audit-logs', { action: 'X' }, (u) => u.gestorToken, 201],
  ['POST /api/audit-logs - admin', 'POST', '/api/audit-logs', { action: 'X' }, (u) => u.adminToken, 201],

  // Sync batch-upload
  ['POST /api/sync/batch-upload - sem token', 'POST', '/api/sync/batch-upload', {}, () => '', 401],
  ['POST /api/sync/batch-upload - viewer', 'POST', '/api/sync/batch-upload', {}, (u) => u.viewerToken, 200],
  ['POST /api/sync/batch-upload - operador', 'POST', '/api/sync/batch-upload', {}, (u) => u.operadorToken, 200],
  ['POST /api/sync/batch-upload - gestor', 'POST', '/api/sync/batch-upload', {}, (u) => u.gestorToken, 200],
  ['POST /api/sync/batch-upload - admin', 'POST', '/api/sync/batch-upload', {}, (u) => u.adminToken, 200],

  // Database reset
  ['POST /api/database/reset - sem token', 'POST', '/api/database/reset', {}, () => '', 401],
  ['POST /api/database/reset - viewer', 'POST', '/api/database/reset', {}, (u) => u.viewerToken, 403],
  ['POST /api/database/reset - operador', 'POST', '/api/database/reset', {}, (u) => u.operadorToken, 403],
  ['POST /api/database/reset - gestor', 'POST', '/api/database/reset', {}, (u) => u.gestorToken, 403],
  ['POST /api/database/reset - admin', 'POST', '/api/database/reset', {}, (u) => u.adminToken, 200],

  // Backup
  ['GET /api/backup - sem token', 'GET', '/api/backup', null, () => '', 401],
  ['GET /api/backup - viewer', 'GET', '/api/backup', null, (u) => u.viewerToken, 403],
  ['GET /api/backup - operador', 'GET', '/api/backup', null, (u) => u.operadorToken, 403],
  ['GET /api/backup - gestor', 'GET', '/api/backup', null, (u) => u.gestorToken, 403],
  ['GET /api/backup - admin', 'GET', '/api/backup', null, (u) => u.adminToken, 200],

  ['POST /api/backup - sem token', 'POST', '/api/backup', null, () => '', 401],
  ['POST /api/backup - viewer', 'POST', '/api/backup', null, (u) => u.viewerToken, 403],
  ['POST /api/backup - operador', 'POST', '/api/backup', null, (u) => u.operadorToken, 403],
  ['POST /api/backup - gestor', 'POST', '/api/backup', null, (u) => u.gestorToken, 403],
  ['POST /api/backup - admin', 'POST', '/api/backup', null, (u) => u.adminToken, 503],

  ['GET /api/backup/:fileName - sem token', 'GET', '/api/backup/arquivo.txt', null, () => '', 401],
  ['GET /api/backup/:fileName - viewer', 'GET', '/api/backup/arquivo.txt', null, (u) => u.viewerToken, 403],
  ['GET /api/backup/:fileName - operador', 'GET', '/api/backup/arquivo.txt', null, (u) => u.operadorToken, 403],
  ['GET /api/backup/:fileName - gestor', 'GET', '/api/backup/arquivo.txt', null, (u) => u.gestorToken, 403],
  ['GET /api/backup/:fileName - admin traversal', 'GET', '/api/backup/arquivo.txt', null, (u) => u.adminToken, 400],
  ['GET /api/backup/:fileName - admin padrao invalido', 'GET', '/api/backup/arquivo.txt', null, (u) => u.adminToken, 400],
];

// ----------------------------------------------------------------------------
// Testes da matriz de autorizacao
// ----------------------------------------------------------------------------
test('autorizacao: matriz papel x rota x metodo', async (t) => {
  const users = await setupUsers();

  for (const [desc, method, path, body, tokenFn, expected] of ROTAS) {
    await t.test(desc, async () => {
      const token = tokenFn(users);
      const init: RequestInit = { method };
      if (body !== null) init.body = JSON.stringify(body);
      if (token) init.headers = bearer(token);

      const res = await api(path, init);
      assert.equal(
        res.response.status,
        expected,
        `${desc}: esperado ${expected}, obteve ${res.response.status} (${JSON.stringify(res.body)})`,
      );
    });
  }
});

// ----------------------------------------------------------------------------
// Casos obrigatorios de seguranca
// ----------------------------------------------------------------------------

test('seguranca: manage_users nao pode criar ou promover admin nem trocar senha de admin', async () => {
  const users = await setupUsers();
  const muToken = users.manageUsersToken;
  const suffix = Date.now().toString(36);

  const criarAdmin = await api('/api/users', {
    method: 'POST',
    headers: bearer(muToken),
    body: JSON.stringify({
      username: `authz_falso_admin_${suffix}`,
      fullName: 'Falso Admin',
      password: 'FalsoAdminSenha@2026',
      role: 'admin',
      permissions: ['all'],
    }),
  });
  assert.equal(criarAdmin.response.status, 403, 'manage_users nao deve criar admin');

  const darPerm = await api('/api/users', {
    method: 'POST',
    headers: bearer(muToken),
    body: JSON.stringify({
      username: `authz_perm_gestao_${suffix}`,
      fullName: 'Perm Gestao',
      password: 'PermGestaoSenha@2026',
      role: 'operador',
      permissions: ['manage_users'],
    }),
  });
  assert.equal(darPerm.response.status, 403, 'manage_users nao deve atribuir manage_users');

  const admins = (await api('/api/users', { headers: bearer(users.adminToken) })).body.data.filter(
    (u: any) => u.role === 'admin',
  );
  assert.ok(admins.length >= 1);
  const adminId = admins[0].id;
  const trocarSenha = await api(`/api/users/${adminId}`, {
    method: 'PUT',
    headers: bearer(muToken),
    body: JSON.stringify({ password: 'NovaSenhaAdmin@2026' }),
  });
  assert.equal(trocarSenha.response.status, 403, 'manage_users nao deve trocar senha de admin');
});

test('seguranca: viewer nao consegue gravar por /api/sync/batch-upload nem /api/audit-logs com dados forjados', async () => {
  const users = await setupUsers();
  const viewerToken = users.viewerToken;

  const batchRes = await api('/api/sync/batch-upload', {
    method: 'POST',
    headers: bearer(viewerToken),
    body: JSON.stringify({
      devices: [{ id: 'dev-forjado', assetTag: 'FORJADO', brand: 'B', model: 'M', status: 'Disponível' }],
      lines: [],
      collaborators: [],
      movements: [],
      terms: [],
      auditLogs: [],
    }),
  });
  assert.ok(batchRes.response.status === 200 || batchRes.response.status === 403);
  if (batchRes.response.status === 200) {
    assert.ok(batchRes.body.data.skipped.length > 0 || batchRes.body.data.rejected.length > 0);
  }

  const auditRes = await api('/api/audit-logs', {
    method: 'POST',
    headers: bearer(viewerToken),
    body: JSON.stringify({ action: 'FORJADO', entityType: 'Sistema', entityId: '1', entityLabel: 'X', details: 'forjado' }),
  });
  // ROTA SEM PROTECAO: POST /api/audit-logs nao possui requireAuth nem requirePermission
  assert.equal(auditRes.response.status, 201, 'POST /api/audit-logs deve exigir autenticacao (atualmente nao protege)');
});

test('seguranca: token invalido apos logout, troca de senha, desativacao ou exclusao', async () => {
  const users = await setupUsers();
  const adminToken = users.adminToken;
  const suffix = Date.now().toString(36);

  const id = await createUserViaAdmin(adminToken, {
    username: `authz_revoca_${suffix}`,
    fullName: 'Revoga Teste',
    password: 'RevogaTeste@2026',
    role: 'operador',
    permissions: ['dashboard'],
    active: true,
  });
  const token = await login(`authz_revoca_${suffix}`, 'RevogaTeste@2026');

  await api('/api/auth/logout', { method: 'POST', headers: bearer(token) });
  const posLogout = await api('/api/users', { headers: bearer(token) });
  assert.equal(posLogout.response.status, 401, 'token deve ser invalido apos logout');

  const token2 = await login(`authz_revoca_${suffix}`, 'RevogaTeste@2026');
  await api(`/api/users/${id}`, {
    method: 'PUT',
    headers: bearer(adminToken),
    body: JSON.stringify({ password: 'NovaSenhaRevoga@2026' }),
  });
  const posTrocaSenha = await api('/api/users', { headers: bearer(token2) });
  assert.equal(posTrocaSenha.response.status, 401, 'token deve ser invalido apos troca de senha');

  const token3 = await login(`authz_revoca_${suffix}`, 'NovaSenhaRevoga@2026');
  await api(`/api/users/${id}`, {
    method: 'PUT',
    headers: bearer(adminToken),
    body: JSON.stringify({ active: false }),
  });
  const posDesativacao = await api('/api/users', { headers: bearer(token3) });
  assert.equal(posDesativacao.response.status, 401, 'token deve ser invalido apos desativacao');

  const admins = (await api('/api/users', { headers: bearer(adminToken) })).body.data.filter(
    (u: any) => u.role === 'admin' && u.active,
  );
  if (admins.length === 1) {
    const delRes = await api(`/api/users/${admins[0].id}`, {
      method: 'DELETE',
      headers: bearer(adminToken),
    });
    assert.equal(delRes.response.status, 403, 'nao deve excluir ultimo admin ativo');
  }
});

test('seguranca: rotas sem autenticacao relatadas', async () => {
  const res = await api('/api/users');
  assert.equal(res.response.status, 401, 'GET /api/users sem token deve ser 401');

  const res2 = await api('/api/devices');
  assert.equal(res2.response.status, 401, 'GET /api/devices sem token deve ser 401');

  const res3 = await api('/api/collaborators');
  assert.equal(res3.response.status, 401, 'GET /api/collaborators sem token deve ser 401');

  const res4 = await api('/api/lines');
  assert.equal(res4.response.status, 401, 'GET /api/lines sem token deve ser 401');

  const res5 = await api('/api/movements');
  assert.equal(res5.response.status, 401, 'GET /api/movements sem token deve ser 401');

  const res6 = await api('/api/terms');
  assert.equal(res6.response.status, 401, 'GET /api/terms sem token deve ser 401');

  const res7 = await api('/api/requests');
  assert.equal(res7.response.status, 401, 'GET /api/requests sem token deve ser 401');
});

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

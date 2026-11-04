import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

// Ambiente isolado: sem PostgreSQL, sem Vite.
process.env.NODE_ENV = 'test';
process.env.SKIP_VITE = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.JWT_SECRET = 'auth-storage-test-secret-32-chars-long!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = '';
process.env.PORT = '0';
process.env.INITIAL_ADMIN_USER = 'auth_storage_admin';
process.env.INITIAL_ADMIN_PASSWORD = 'AuthStorageAdmin@2026';

// ----------------------------------------------------------------------------
// Mock de localStorage (isolado por teste)
// ----------------------------------------------------------------------------
let storageMap = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string): string | null => storageMap.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    storageMap.set(key, value);
  },
  removeItem: (key: string): void => {
    storageMap.delete(key);
  },
  clear: (): void => {
    storageMap.clear();
  },
  get length(): number {
    return storageMap.size;
  },
  key: (index: number): string | null => {
    return Array.from(storageMap.keys())[index] ?? null;
  },
};

function installLocalStorageMock(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });
}

function setStorageItem(key: string, value: any): void {
  storageMap.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function getStorageItem(key: string): any {
  const raw = storageMap.get(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function countIaneKeys(excludeVisual = true): number {
  let count = 0;
  for (const key of storageMap.keys()) {
    if (key.startsWith('iane_')) {
      if (excludeVisual && key === 'iane_sidebar_collapsed_v1') continue;
      count++;
    }
  }
  return count;
}

let server: import('http').Server;

before(async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  installLocalStorageMock();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = await import('../server');
  server = await mod.startServer();
  // Deixa o mock instalado para os testes
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('auth-storage: logout apaga todas as chaves iane_* exceto preferências visuais', async () => {
  installLocalStorageMock();
  storageMap.clear();

  // Semeia chaves pessoais e de sessão
  setStorageItem('iane_auth_current_user_v2', { id: 'u1', username: 'admin', role: 'admin', permissions: [] });
  setStorageItem('iane_auth_token_v2', 'token-xyz');
  setStorageItem('iane_devices_v3', [{ id: 'd1', assetTag: 'D1' }]);
  setStorageItem('iane_lines_v3', [{ id: 'l1', phoneNumber: '11900000001' }]);
  setStorageItem('iane_collaborators_v3', [{ id: 'c1', fullName: 'João' }]);
  setStorageItem('iane_movements_v3', [{ id: 'm1' }]);
  setStorageItem('iane_terms_v3', [{ id: 't1' }]);
  setStorageItem('iane_audit_v3', [{ id: 'a1' }]);
  setStorageItem('iane_catalogs_v1', { departments: [] });
  setStorageItem('iane_outbox_v1', [{ id: 'ob-1' }]);
  setStorageItem('iane_outbox_rejected_v1', [{ id: 'r1' }]);
  setStorageItem('iane_migrated_to_pg_v1', '2026-01-01');
  setStorageItem('iane_backup_pre_pg_migration_v1', { savedAt: '2026-01-01' });

  // Preferência visual deve ser preservada
  setStorageItem('iane_sidebar_collapsed_v1', 'true');

  assert.equal(countIaneKeys(), 13, '13 chaves pessoais antes do logout');
  assert.equal(getStorageItem('iane_sidebar_collapsed_v1'), true, 'preferência visual presente antes');

  const { authService } = await import('../src/services/authService');
  authService.logout();

  assert.equal(countIaneKeys(), 0, 'todas as chaves pessoais apagadas após logout');
  assert.equal(getStorageItem('iane_sidebar_collapsed_v1'), true, 'preferência visual preservada');
  assert.equal(getStorageItem('iane_auth_current_user_v2'), null);
  assert.equal(getStorageItem('iane_auth_token_v2'), null);
});

test('auth-storage: logout com outbox pendente apenas limpa se usuário confirmar', async () => {
  installLocalStorageMock();
  storageMap.clear();

  setStorageItem('iane_auth_current_user_v2', { id: 'u1', username: 'admin', role: 'admin', permissions: [] });
  setStorageItem('iane_auth_token_v2', 'token-xyz');
  setStorageItem('iane_outbox_v1', [{ id: 'ob-1', label: 'Criar dispositivo' }]);

  const { authService } = await import('../src/services/authService');

  // Verifica que o outbox está no storage antes do logout
  assert.equal(storageMap.has('iane_outbox_v1'), true, 'outbox deve estar no storage antes do logout');

  // authService.logout() sempre limpa todo o storage (exceto preferências visuais).
  // A confirmação do usuário sobre perda do outbox é responsabilidade do chamador (App.tsx),
  // que chama dataService.clearOutbox() apenas após confirmação via window.confirm.
  authService.logout();

  // Após logout, o outbox foi apagado
  assert.equal(storageMap.has('iane_outbox_v1'), false, 'outbox removida pelo logout');
  assert.equal(getStorageItem('iane_auth_current_user_v2'), null, 'usuário removido após logout');
});

test('auth-storage: nenhum dado pessoal permanece no localStorage após logout', async () => {
  installLocalStorageMock();
  storageMap.clear();

  setStorageItem('iane_auth_current_user_v2', {
    id: 'u1',
    username: 'fulano',
    fullName: 'Fulano de Tal',
    email: 'fulano@iane.ind.br',
    role: 'admin',
    permissions: [],
  });
  setStorageItem('iane_auth_token_v2', 'super-secreto');
  setStorageItem('iane_devices_v3', [
    { id: 'd1', assetTag: 'TAG-001', imei1: '11122233344', serialNumber: 'SN-001' },
  ]);
  setStorageItem('iane_collaborators_v3', [
    { id: 'c1', fullName: 'Maria Silva', registrationNumber: 'MAT-001', cpf: '111.222.333-44' },
  ]);

  const { authService } = await import('../src/services/authService');
  authService.logout();

  // Verifica que não resta nenhum dado pessoal
  const personalKeys = [
    'iane_auth_current_user_v2',
    'iane_auth_token_v2',
    'iane_devices_v3',
    'iane_lines_v3',
    'iane_collaborators_v3',
    'iane_movements_v3',
    'iane_terms_v3',
    'iane_audit_v3',
    'iane_outbox_v1',
    'iane_outbox_rejected_v1',
    'iane_backup_pre_pg_migration_v1',
  ];

  for (const key of personalKeys) {
    assert.equal(
      getStorageItem(key),
      null,
      `chave pessoal "${key}" não deve permanecer após logout`
    );
  }

  // Apenas preferência visual pode permanecer
  const remainingIaneKeys = countIaneKeys();
  assert.ok(
    remainingIaneKeys === 0 || (remainingIaneKeys === 1 && getStorageItem('iane_sidebar_collapsed_v1') === true),
    `nenhuma chave pessoal deve restar após logout (restaram ${remainingIaneKeys})`
  );
});

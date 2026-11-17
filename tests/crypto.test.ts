import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import { decrypt, encrypt, isEncrypted } from '../src/utils/crypto';

const KEY = 'iane-dev-encryption-key-000000000001';
process.env.IANE_ENCRYPTION_KEY = KEY;
const key = Buffer.from(KEY, 'utf8').subarray(0, 32);
const aad = Buffer.from('iane', 'utf8');

test('encrypt/decrypt mantém o formato IV + TAG + ciphertext em base64url', () => {
  const plaintext = '123.456.789-09 · IANE';
  const encrypted = encrypt(plaintext);
  assert.equal(isEncrypted(encrypted), true);
  assert.equal(decrypt(encrypted), plaintext);
});

test('crypto do navegador é compatível com AES-256-GCM do Node', () => {
  const plaintext = 'CPF 123.456.789-09; IMEI 123456789012345; serial ABC-987654';
  const encrypted = encrypt(plaintext);
  const raw = Buffer.from(encrypted, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  decipher.setAAD(aad);
  const fromBrowser = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  assert.equal(fromBrowser, plaintext);

  const iv = Buffer.from('000102030405060708090a0b', 'hex');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const fromNode = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  assert.equal(decrypt(fromNode), plaintext);
});

test('decrypt rejeita ciphertext alterado', () => {
  const encrypted = encrypt('dado sensível');
  const tampered = encrypted.slice(0, -4) + 'AAAA';
  assert.equal(decrypt(tampered), null);
});

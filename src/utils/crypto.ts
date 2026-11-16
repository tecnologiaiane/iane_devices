/**
 * Criptografia simétrica (AES-256-GCM) para dados pessoais sensíveis (LGPD).
 *
 * Os dados sensíveis (CPF, telefone, IMEI, número de série, etc.) são
 * armazenados criptografados no localStorage / PostgreSQL e descriptografados
 * somente na camada de apresentação, respeitando o papel do usuário.
 *
 * A chave de criptografia deve ser definida via variável de ambiente
 * IANE_ENCRYPTION_KEY (mínimo 32 caracteres). Em desenvolvimento, uma chave
 * derivada é usada automaticamente, mas NÃO deve ser usada em produção.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recomendado para GCM
const TAG_LENGTH = 16; // 128 bits, padrão do GCM

function getKey(): Buffer {
  const envKey = typeof process !== 'undefined' && process.env?.IANE_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'utf8').slice(0, 32);
  }
  // Fallback apenas para desenvolvimento local. Nunca use em produção.
  const fallback = 'iane-dev-encryption-key-000000000001';
  return Buffer.from(fallback.padEnd(32, '0'), 'utf8').slice(0, 32);
}

/** Criptografa uma string. Retorna base64url contendo IV + TAG + ciphertext. */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from('iane', 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/** Descriptografa uma string gerada por encrypt(). Retorna null se falhar. */
export function decrypt(ciphertext: string): string | null {
  if (!ciphertext) return ciphertext;
  try {
    const raw = Buffer.from(ciphertext, 'base64url');
    if (raw.length < IV_LENGTH + TAG_LENGTH) return null;
    const key = getKey();
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from('iane', 'utf8'));
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/** Verifica se um valor parece estar criptografado (base64url com tamanho compatível). */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const raw = Buffer.from(value, 'base64url');
    return raw.length >= IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}

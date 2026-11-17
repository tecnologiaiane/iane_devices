/**
 * Criptografia simétrica (AES-256-GCM) para dados pessoais sensíveis (LGPD).
 *
 * Os dados sensíveis (CPF, telefone, IMEI, número de série, etc.) são
 * armazenados criptografados no localStorage / PostgreSQL e descriptografados
 * somente na camada de apresentação, respeitando o papel do usuário.
 *
 * A implementação usa apenas APIs disponíveis no navegador (Web Crypto para o
 * IV aleatório e operações aritméticas puras para AES/GCM). Isso evita o
 * problema de empacotar o módulo `crypto` do Node no bundle do cliente e mantém
 * a API síncrona exigida pela camada de armazenamento.
 *
 * A chave de criptografia deve ser definida via variável de ambiente
 * IANE_ENCRYPTION_KEY (mínimo 32 caracteres). Em desenvolvimento, uma chave
 * derivada é usada automaticamente, mas NÃO deve ser usada em produção.
 */

const IV_LENGTH = 12; // 96 bits, recomendado para GCM
const TAG_LENGTH = 16; // 128 bits, padrão do GCM
const KEY_LENGTH = 32; // AES-256
const AAD = new TextEncoder().encode('iane');

// ---------------------------------------------------------------------------
// AES-256 (apenas o sentido de criptografia é necessário para GCM/CTR)
// ---------------------------------------------------------------------------

function gfMul8(a: number, b: number): number {
	let product = 0;
	let x = a & 0xff;
	let y = b & 0xff;
	for (let i = 0; i < 8; i++) {
		if (y & 1) product ^= x;
		const highBit = x & 0x80;
		x = (x << 1) & 0xff;
		if (highBit) x ^= 0x1b;
		y >>= 1;
	}
	return product;
}

function gfPow8(base: number, exponent: number): number {
	let result = 1;
	let value = base & 0xff;
	let power = exponent;
	while (power > 0) {
		if (power & 1) result = gfMul8(result, value);
		value = gfMul8(value, value);
		power >>= 1;
	}
	return result;
}

function rotl8(value: number, shift: number): number {
	return ((value << shift) | (value >>> (8 - shift))) & 0xff;
}

/** S-box do AES derivada em tempo de execução (evita tabela digitada manualmente). */
const SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
	const inverse = i === 0 ? 0 : gfPow8(i, 254);
	SBOX[i] = inverse ^ rotl8(inverse, 1) ^ rotl8(inverse, 2) ^ rotl8(inverse, 3) ^ rotl8(inverse, 4) ^ 0x63;
}

function rcon(value: number): number {
	let result = 1;
	for (let i = 1; i < value; i++) result = gfMul8(result, 2);
	return result;
}

function expandKey(key: Uint8Array): Uint8Array {
	const nk = 8;
	const nr = 14;
	const words = new Uint8Array(4 * (nr + 1) * 4);
	words.set(key.subarray(0, KEY_LENGTH));

	for (let i = nk; i < 4 * (nr + 1); i++) {
		let t0 = words[(i - 1) * 4];
		let t1 = words[(i - 1) * 4 + 1];
		let t2 = words[(i - 1) * 4 + 2];
		let t3 = words[(i - 1) * 4 + 3];

		if (i % nk === 0) {
			// RotWord + SubWord + XOR com Rcon.
			const roundConstant = rcon(i / nk);
			const r0 = SBOX[t1] ^ roundConstant;
			const r1 = SBOX[t2];
			const r2 = SBOX[t3];
			const r3 = SBOX[t0];
			t0 = r0;
			t1 = r1;
			t2 = r2;
			t3 = r3;
		} else if (i % nk === 4) {
			t0 = SBOX[t0];
			t1 = SBOX[t1];
			t2 = SBOX[t2];
			t3 = SBOX[t3];
		}

		const previous = (i - nk) * 4;
		words[i * 4] = words[previous] ^ t0;
		words[i * 4 + 1] = words[previous + 1] ^ t1;
		words[i * 4 + 2] = words[previous + 2] ^ t2;
		words[i * 4 + 3] = words[previous + 3] ^ t3;
	}

	return words;
}

function addRoundKey(state: Uint8Array, roundKeys: Uint8Array, round: number): void {
	const offset = round * 16;
	for (let i = 0; i < 16; i++) state[i] ^= roundKeys[offset + i];
}

function subBytes(state: Uint8Array): void {
	for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
}

function shiftRows(state: Uint8Array): void {
	const original = state.slice();
	for (let row = 1; row < 4; row++) {
		for (let column = 0; column < 4; column++) {
			state[row + column * 4] = original[row + ((column + row) % 4) * 4];
		}
	}
}

function mixColumns(state: Uint8Array): void {
	for (let column = 0; column < 4; column++) {
		const offset = column * 4;
		const a0 = state[offset];
		const a1 = state[offset + 1];
		const a2 = state[offset + 2];
		const a3 = state[offset + 3];
		state[offset] = gfMul8(a0, 2) ^ (gfMul8(a1, 2) ^ a1) ^ a2 ^ a3;
		state[offset + 1] = a0 ^ gfMul8(a1, 2) ^ (gfMul8(a2, 2) ^ a2) ^ a3;
		state[offset + 2] = a0 ^ a1 ^ gfMul8(a2, 2) ^ (gfMul8(a3, 2) ^ a3);
		state[offset + 3] = (gfMul8(a0, 2) ^ a0) ^ a1 ^ a2 ^ gfMul8(a3, 2);
	}
}

function aesEncryptBlock(block: Uint8Array, roundKeys: Uint8Array): Uint8Array {
	const state = block.slice();
	addRoundKey(state, roundKeys, 0);
	for (let round = 1; round < 14; round++) {
		subBytes(state);
		shiftRows(state);
		mixColumns(state);
		addRoundKey(state, roundKeys, round);
	}
	subBytes(state);
	shiftRows(state);
	addRoundKey(state, roundKeys, 14);
	return state;
}

// ---------------------------------------------------------------------------
// GCM (GHASH + modo contador)
// ---------------------------------------------------------------------------

function xorBlocks(left: Uint8Array, right: Uint8Array): Uint8Array {
	const result = new Uint8Array(16);
	for (let i = 0; i < 16; i++) result[i] = (left[i] || 0) ^ (right[i] || 0);
	return result;
}

/** Multiplicação em GF(2^128) usada pelo GHASH. */
function ghashMultiply(x: Uint8Array, y: Uint8Array): Uint8Array {
	const result = new Uint8Array(16);
	const value = y.slice();
	for (let bit = 0; bit < 128; bit++) {
		if ((x[bit >> 3] >> (7 - (bit & 7))) & 1) {
			for (let i = 0; i < 16; i++) result[i] ^= value[i];
		}
		const leastSignificantBit = value[15] & 1;
		for (let i = 15; i > 0; i--) value[i] = (value[i] >> 1) | ((value[i - 1] & 1) << 7);
		value[0] >>= 1;
		if (leastSignificantBit) value[0] ^= 0xe1;
	}
	return result;
}

function writeUint64(target: Uint8Array, offset: number, value: number): void {
	let remaining = BigInt(value);
	for (let i = 7; i >= 0; i--) {
		target[offset + i] = Number(remaining & 0xffn);
		remaining >>= 8n;
	}
}

function ghash(h: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
	let state: Uint8Array = new Uint8Array(16);
	const absorb = (data: Uint8Array) => {
		for (let offset = 0; offset < data.length; offset += 16) {
			const block = new Uint8Array(16);
			const size = Math.min(16, data.length - offset);
			block.set(data.subarray(offset, offset + size));
			state = ghashMultiply(xorBlocks(state, block), h);
		}
	};
	absorb(aad);
	absorb(ciphertext);

	const lengths = new Uint8Array(16);
	writeUint64(lengths, 0, aad.length * 8);
	writeUint64(lengths, 8, ciphertext.length * 8);
	return ghashMultiply(xorBlocks(state, lengths), h);
}

function incrementCounter(counter: Uint8Array): void {
	for (let i = 15; i >= 12; i--) {
		counter[i] = (counter[i] + 1) & 0xff;
		if (counter[i] !== 0) break;
	}
}

function ctrTransform(data: Uint8Array, roundKeys: Uint8Array, initialCounter: Uint8Array): Uint8Array {
	const output = new Uint8Array(data.length);
	const counter = initialCounter.slice();
	// No GCM, J0 é usado para o MAC; a cifra começa em J0 + 1.
	incrementCounter(counter);
	for (let offset = 0; offset < data.length; offset += 16) {
		const stream = aesEncryptBlock(counter, roundKeys);
		const size = Math.min(16, data.length - offset);
		for (let i = 0; i < size; i++) output[offset + i] = data[offset + i] ^ stream[i];
		incrementCounter(counter);
	}
	return output;
}

function gcmEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): { ciphertext: Uint8Array; tag: Uint8Array } {
	const roundKeys = expandKey(key);
	const h = aesEncryptBlock(new Uint8Array(16), roundKeys);
	const j0 = new Uint8Array(16);
	j0.set(iv.subarray(0, IV_LENGTH));
	j0[15] = 1;

	const ciphertext = ctrTransform(plaintext, roundKeys, j0);
	const tagMask = aesEncryptBlock(j0, roundKeys);
	const tag = xorBlocks(ghash(h, AAD, ciphertext), tagMask);
	return { ciphertext, tag };
}

function gcmDecrypt(
	key: Uint8Array,
	iv: Uint8Array,
	tag: Uint8Array,
	ciphertext: Uint8Array
): Uint8Array | null {
	const roundKeys = expandKey(key);
	const h = aesEncryptBlock(new Uint8Array(16), roundKeys);
	const j0 = new Uint8Array(16);
	j0.set(iv.subarray(0, IV_LENGTH));
	j0[15] = 1;

	const tagMask = aesEncryptBlock(j0, roundKeys);
	const expectedTag = xorBlocks(ghash(h, AAD, ciphertext), tagMask);
	let difference = 0;
	for (let i = 0; i < TAG_LENGTH; i++) difference |= expectedTag[i] ^ tag[i];
	if (difference !== 0) return null;

	return ctrTransform(ciphertext, roundKeys, j0);
}

// ---------------------------------------------------------------------------
// Utilitários de chave, IV e base64url
// ---------------------------------------------------------------------------

function getKey(): Uint8Array {
	const environment = typeof globalThis !== 'undefined' ? (globalThis as any).process?.env : undefined;
	const configuredKey = environment?.IANE_ENCRYPTION_KEY;
	// Fallback apenas para desenvolvimento local. Nunca use em produção.
	const fallback = 'iane-dev-encryption-key-000000000001';
	const key = new Uint8Array(KEY_LENGTH);
	key.set(new TextEncoder().encode(configuredKey || fallback).subarray(0, KEY_LENGTH));
	return key;
}

function getIv(): Uint8Array {
	const iv = new Uint8Array(IV_LENGTH);
	const webCrypto = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
	if (!webCrypto || typeof webCrypto.getRandomValues !== 'function') {
		throw new Error('API criptográfica do navegador indisponível para gerar o IV.');
	}
	webCrypto.getRandomValues(iv);
	return iv;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Criptografa uma string. Retorna base64url contendo IV + TAG + ciphertext. */
export function encrypt(plaintext: string): string {
	if (!plaintext) return plaintext;
	const iv = getIv();
	const { ciphertext, tag } = gcmEncrypt(getKey(), iv, new TextEncoder().encode(plaintext));
	const payload = new Uint8Array(IV_LENGTH + TAG_LENGTH + ciphertext.length);
	payload.set(iv, 0);
	payload.set(tag, IV_LENGTH);
	payload.set(ciphertext, IV_LENGTH + TAG_LENGTH);
	return toBase64Url(payload);
}

/** Descriptografa uma string gerada por encrypt(). Retorna null se falhar. */
export function decrypt(ciphertext: string): string | null {
	if (!ciphertext) return ciphertext;
	try {
		const raw = fromBase64Url(ciphertext);
		if (raw.length < IV_LENGTH + TAG_LENGTH) return null;
		const iv = raw.subarray(0, IV_LENGTH);
		const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
		const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
		const plain = gcmDecrypt(getKey(), iv, tag, encrypted);
		if (!plain) return null;
		return new TextDecoder().decode(plain);
	} catch {
		return null;
	}
}

/** Verifica se um valor parece estar criptografado (base64url com tamanho compatível). */
export function isEncrypted(value: string): boolean {
	if (!value || typeof value !== 'string') return false;
	try {
		return fromBase64Url(value).length >= IV_LENGTH + TAG_LENGTH;
	} catch {
		return false;
	}
}

/**
 * Proteção de dados sensíveis em repouso (LGPD Art. 6º, inciso II).
 *
 * Os campos considerados dados pessoais sensíveis (CPF, telefone, IMEI,
 * número de série, e-mail corporativo) são armazenados criptografados no
 * localStorage / PostgreSQL e descriptografados somente na leitura.
 *
 * A máscara de exibição (privacy.ts) continua sendo aplicada na camada de
 * apresentação, por cima da descriptografia: admin/gestor veem o dado real,
 * operador/visualizador veem mascarado.
 */

import { encrypt, decrypt, isEncrypted } from './crypto';
import { canViewUnmasked } from './privacy';

/** Campos que devem ser criptografados em repouso. */
export const ENCRYPTED_FIELDS = ['cpf', 'contactPhone', 'imei1', 'imei2', 'serialNumber', 'phoneNumber', 'corporateEmail'] as const;
export type EncryptedField = (typeof ENCRYPTED_FIELDS)[number];

/** Criptografa os campos sensíveis de um registro antes de gravar. */
export function encryptSensitiveFields<T extends Record<string, any>>(
	record: T | undefined | null
): T | undefined | null {
	if (!record) return record;

	const encrypted: Record<string, any> = { ...record };
	for (const field of ENCRYPTED_FIELDS) {
		const value = record[field];
		if (value === undefined || value === null || value === '') continue;
		// Não criptografa duas vezes se já estiver criptografado.
		if (typeof value === 'string' && isEncrypted(value)) continue;
		encrypted[field] = encrypt(String(value));
	}
	return encrypted as T;
}

/** Descriptografa os campos sensíveis de um registro após ler do armazenamento. */
export function decryptSensitiveFields<T extends Record<string, any>>(
	record: T | undefined | null,
	userRole?: string | null
): T | undefined | null {
	if (!record) return record;

	const decrypted: Record<string, any> = { ...record };
	for (const field of ENCRYPTED_FIELDS) {
		const value = record[field];
		if (value === undefined || value === null || value === '') continue;
		if (typeof value !== 'string') continue;
		if (!isEncrypted(value)) continue;

		const plain = decrypt(value);
		if (plain === null) {
			// Se não conseguir descriptografar, mantém o valor original (pode ser legacy não criptografado).
			continue;
		}
		decrypted[field] = plain;
	}
	return decrypted as T;
}

/**
 * Retorna o valor de um campo sensível pronto para exibição:
 * 1. Descriptografa o valor armazenado.
 * 2. Aplica máscara LGPD se o usuário não puder ver dados completos.
 */
export function getSensitiveFieldForDisplay<T extends Record<string, any>>(
	record: T | undefined | null,
	field: EncryptedField,
	userRole?: string | null
): string | undefined | null {
	if (!record) return undefined;
	const value = record[field];
	if (value === undefined || value === null || value === '') return value;

	// Se ainda estiver criptografado, descriptografa primeiro.
	const plain = isEncrypted(String(value)) ? decrypt(String(value)) : String(value);
	if (plain === null) return value;

	// Aplica máscara conforme o papel.
	if (!canViewUnmasked(userRole)) {
		switch (field) {
			case 'cpf':
				return maskCpf(plain);
			case 'contactPhone':
			case 'phoneNumber':
				return maskPhone(plain);
			case 'imei1':
			case 'imei2':
				return maskImei(plain);
			case 'serialNumber':
				return maskSerial(plain);
			case 'corporateEmail':
				return maskEmail(plain);
		}
	}
	return plain;
}

/** Máscara simples de e-mail: usuario@dominio.com → u****@dominio.com. */
function maskEmail(value: string): string {
	const at = value.indexOf('@');
	if (at <= 1) return value;
	const local = value.slice(0, at);
	const domain = value.slice(at);
	return `${local[0]}${'x'.repeat(Math.max(0, local.length - 1))}${domain}`;
}

// Re-exporta máscaras do privacy para evitar importação circular.
function maskCpf(value: string): string {
	const digits = value.replace(/\D/g, '');
	if (digits.length !== 11) return value;
	return `${digits.slice(0, 3)}.***.**-${digits.slice(9, 11)}`;
}

function maskPhone(value: string): string {
	const digits = value.replace(/\D/g, '');
	if (digits.length >= 10) {
		const ddd = digits.slice(0, 2);
		const last4 = digits.slice(-4);
		return `(${ddd}) ****-${last4}`;
	}
	return value;
}

function maskImei(value: string): string {
	const digits = value.replace(/\D/g, '');
	if (digits.length < 7) return value;
	return `${digits.slice(0, 3)}${'*'.repeat(Math.max(0, digits.length - 6))}${digits.slice(-3)}`;
}

function maskSerial(value: string): string {
	const len = value.length;
	if (len <= 6) return value;
	const keepStart = 3;
	const keepEnd = 4;
	const maskedLen = Math.max(0, len - keepStart - keepEnd);
	return `${value.slice(0, keepStart)}${'x'.repeat(maskedLen)}${value.slice(-keepEnd)}`;
}

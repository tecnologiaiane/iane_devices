/**
 * Utilitários de proteção de dados pessoais (LGPD - Lei 13.709/2018).
 *
 * Fornece máscaras para exibição segura de dados pessoais sensíveis (CPF,
 * telefone, IMEI, número de série) conforme o papel do usuário logado.
 *
 * Regras de exibição:
 *  - admin e gestor: veem os dados completos (necessário para gestão operacional).
 *  - operador e visualizador: veem dados mascarados (princípio da necessidade/minimização).
 *
 * Máscaras nunca alteram os dados armazenados: aplicam-se apenas na apresentação.
 */

/** Papéis que podem ver dados sensíveis completos. */
export const UNMASKED_ROLES = new Set(['admin', 'gestor']);

/** Retorna true se o usuário logado pode ver dados pessoais sem máscara. */
export function canViewUnmasked(userRole?: string | null): boolean {
	return UNMASKED_ROLES.has(userRole ?? '');
}

/** Máscara de CPF: 123.456.789-01 → 123.***.**-01 (apenas dígitos são considerados). */
export function maskCpf(value?: string | null): string {
	if (!value) return '';
	const digits = value.replace(/\D/g, '');
	if (digits.length !== 11) return value;
	return `${digits.slice(0, 3)}.***.**-${digits.slice(9, 11)}`;
}

/** Máscara de telefone: (11) 99999-0000 → (11) ****-0000. */
export function maskPhone(value?: string | null): string {
	if (!value) return '';
	const digits = value.replace(/\D/g, '');
	if (digits.length >= 10) {
		const ddd = digits.slice(0, 2);
		const last4 = digits.slice(-4);
		return `(${ddd}) ****-${last4}`;
	}
	return value;
}

/** Máscara de IMEI: 356789012345678 → 3567*******678 (mantém 3 primeiros e 3 últimos). */
export function maskImei(value?: string | null): string {
	if (!value) return '';
	const digits = value.replace(/\D/g, '');
	if (digits.length < 7) return value;
	return `${digits.slice(0, 3)}${'*'.repeat(Math.max(0, digits.length - 6))}${digits.slice(-3)}`;
}

/** Máscara de número de série: SN-TESTE-001 → SN-T******-001. */
export function maskSerial(value?: string | null): string {
	if (!value) return '';
	const len = value.length;
	if (len <= 6) return value;
	const keepStart = 3;
	const keepEnd = 4;
	const maskedLen = Math.max(0, len - keepStart - keepEnd);
	return `${value.slice(0, keepStart)}${'x'.repeat(maskedLen)}${value.slice(-keepEnd)}`;
}

/**
 * Aplica máscara condicional com base no papel do usuário.
 * Quando o usuário não pode ver dados completos, retorna a versão mascarada.
 */
export function maskIfNeeded<T>(
	value: T | undefined | null,
	masker: (v: string) => string,
	userRole?: string | null
): T | undefined | null {
	if (value === undefined || value === null || canViewUnmasked(userRole)) return value;
	return masker(String(value)) as unknown as T;
}

/** Lista de campos considerados dados pessoais sensíveis nos cadastros do sistema. */
export const SENSITIVE_FIELDS = ['cpf', 'contactPhone', 'imei1', 'imei2', 'serialNumber', 'phoneNumber'] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

/** Aplica máscara a um objeto (ex.: Collaborator, Device, PhoneLine) nos campos sensíveis. */
export function maskSensitiveFields<T extends Record<string, any>>(
	record: T | undefined | null,
	userRole?: string | null
): T | undefined | null {
	if (!record || canViewUnmasked(userRole)) return record;

	const masked: Record<string, any> = { ...record };
	for (const field of SENSITIVE_FIELDS) {
		const value = record[field];
		if (value === undefined || value === null || value === '') continue;
		if (field === 'cpf') masked[field] = maskCpf(value);
		else if (field === 'contactPhone' || field === 'phoneNumber') masked[field] = maskPhone(value);
		else if (field === 'imei1' || field === 'imei2') masked[field] = maskImei(value);
		else if (field === 'serialNumber') masked[field] = maskSerial(value);
	}
	return masked as T;
}

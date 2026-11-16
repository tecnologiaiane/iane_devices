/**
 * Componente de exibição segura de dados pessoais sensíveis (LGPD).
 *
 * Aplica máscara condicional com base no papel do usuário logado:
 *  - admin / gestor → valor completo (necessário para gestão operacional)
 *  - operador / visualizador → valor mascarado (princípio da minimização de dados)
 *
 * Uso:
 *  <SecureField value={collaborator.cpf} type="cpf" userRole={user.role} />
 *  <SecureField value={device.imei1} type="imei" userRole={user.role} />
 *  <SecureField value={line.phoneNumber} type="phone" userRole={user.role} />
 *  <SecureField value={device.serialNumber} type="serial" userRole={user.role} />
 */

import React from 'react';
import { maskCpf, maskImei, maskPhone, maskSerial, canViewUnmasked } from '../utils/privacy';

type MaskType = 'cpf' | 'phone' | 'imei' | 'serial';

interface SecureFieldProps {
	/** Valor bruto do dado pessoal. */
	value?: string | null;
	/** Tipo de máscara a aplicar quando o usuário não tem permissão de ver completo. */
	type: MaskType;
	/** Papel do usuário logado para decidir mascaramento. */
	userRole?: string | null;
	/** Texto exibido quando o valor está vazio. */
	placeholder?: string;
	/** Classes Tailwind extras. */
	className?: string;
	/** Se true, mostra um ícone de "dado protegido" ao lado do valor mascarado. */
	showShield?: boolean;
}

export function SecureField({
	value,
	type,
	userRole,
	placeholder = '—',
	className = '',
	showShield = false,
}: SecureFieldProps): React.ReactNode {
	if (!value) {
		return <span className={`text-text-muted italic ${className}`}>{placeholder}</span>;
	}

	const unmasked = canViewUnmasked(userRole);
	const display = unmasked ? value : (() => {
		switch (type) {
			case 'cpf': return maskCpf(value);
			case 'phone': return maskPhone(value);
			case 'imei': return maskImei(value);
			case 'serial': return maskSerial(value);
		}
	})();

	const shield = showShield && !unmasked ? (
		<span className="ml-1 text-text-muted" title="Dado pessoal protegido (LGPD)">
			🔒
		</span>
	) : null;

	return (
		<span className={`font-code ${className}`} title={unmasked ? undefined : 'Dado pessoal protegido por LGPD - exiba apenas com autorização'}>
			{display}{shield}
		</span>
	);
}

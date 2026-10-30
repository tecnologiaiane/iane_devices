/** Perfis existentes autorizados a acessar o módulo de solicitações. */
export const REQUEST_ALLOWED_ROLES = ['admin', 'gestor', 'operador'] as const;
/** Apenas a conta administrativa existente decide solicitações. */
export const REQUEST_APPROVER_ROLES = ['admin'] as const;

export function canAccessRequests(role?: string | null): boolean {
  return REQUEST_ALLOWED_ROLES.includes(role as (typeof REQUEST_ALLOWED_ROLES)[number]);
}

/** Gestores e administradores consultam a lista global; operadores veem apenas os próprios registros. */
export function canViewAllRequests(role?: string | null): boolean {
  return role === 'admin' || role === 'gestor';
}

export function canApproveRequests(role?: string | null): boolean {
  return REQUEST_APPROVER_ROLES.includes(role as (typeof REQUEST_APPROVER_ROLES)[number]);
}

/**
 * Utilitários de data no fuso LOCAL do usuário.
 *
 * `new Date().toISOString().split('T')[0]` retorna a data em UTC: no Brasil (UTC-3),
 * entre 21h e 23h59 o sistema gravava o dia seguinte (e, no horário de verão, o dia
 * anterior). Estas funções sempre usam os componentes locais do calendário.
 */

/** Data de hoje no formato YYYY-MM-DD, no fuso local. */
export function todayISO(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Valor para `<input type="date">` (YYYY-MM-DD).
 * Datas sem hora são preservadas como estão; timestamps ISO são convertidos para o fuso local.
 */
export function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const text = String(value).trim();

  // Data pura (YYYY-MM-DD) ou data/hora local sem fuso (YYYY-MM-DD HH:mm[:ss])
  const plainDate = /^(\d{4}-\d{2}-\d{2})$/.exec(text);
  if (plainDate) return plainDate[1];
  const localDateTime = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2})?$/.exec(text);
  if (localDateTime) return localDateTime[1];

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : todayISO(parsed);
}

/** Data e hora locais no formato "YYYY-MM-DD HH:mm" (usado em auditoria e assinaturas). */
export function nowLocalDateTime(reference: Date = new Date()): string {
  const hours = String(reference.getHours()).padStart(2, '0');
  const minutes = String(reference.getMinutes()).padStart(2, '0');
  return `${todayISO(reference)} ${hours}:${minutes}`;
}

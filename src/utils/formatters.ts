/**
 * Formata uma data para o padrão brasileiro (DD/MM/AAAA).
 *
 * Datas puras (YYYY-MM-DD) são formatadas sem passar por `Date`, evitando o
 * deslocamento de fuso. Timestamps ISO são convertidos para o fuso local.
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const value = String(dateString).trim();
  try {
    // Data pura ou data/hora local sem fuso: usa os componentes como vieram.
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) ||
      /^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}(?::\d{2})?$/.exec(value);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    // Timestamp com fuso (ex.: createdAt vindo do PostgreSQL): converte para o fuso local.
    const d = new Date(value);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateTimeString?: string): string {
  if (!dateTimeString) return '-';
  try {
    const parts = dateTimeString.split(' ');
    if (parts.length === 2) {
      return `${formatDate(parts[0])} às ${parts[1]}`;
    }
    const d = new Date(dateTimeString);
    if (isNaN(d.getTime())) return dateTimeString;
    return d.toLocaleString('pt-BR');
  } catch {
    return dateTimeString;
  }
}

export function formatCurrency(value?: number): string {
  if (value === undefined || value === null || isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPhone(phone?: string): string {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export function formatImei(imei?: string): string {
  if (!imei) return '-';
  const clean = imei.replace(/\D/g, '');
  return clean || imei;
}

// Download CSV helper
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const processRow = (row: (string | number)[]) => {
    let finalVal = '';
    for (let j = 0; j < row.length; j++) {
      let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
      let result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0) {
        result = '"' + result + '"';
      }
      if (j > 0) finalVal += ';'; // Ponto e vírgula é o padrão para Excel em PT-BR
      finalVal += result;
    }
    return finalVal + '\n';
  };

  let csvFile = '\uFEFF'; // UTF-8 BOM para garantir acentuação correta no Excel brasileiro
  for (let i = 0; i < rows.length; i++) {
    csvFile += processRow(rows[i]);
  }

  const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

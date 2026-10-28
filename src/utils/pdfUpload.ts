/**
 * Utilitários de upload de PDF usados no cadastro de termos já existentes.
 * O arquivo é lido como Data URL (base64) e enviado ao servidor no corpo JSON.
 */

export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });

/** Sugere um código de termo a partir do nome do arquivo (ex.: termo_entrega_2024.pdf). */
export const suggestCodeFromFileName = (fileName: string): string =>
  fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Valida extensão/tipo, tamanho e assinatura real do PDF (%PDF-).
 * Devolve a mensagem de erro ou null quando o arquivo é aceito.
 */
export const validatePdfFile = async (file: File): Promise<string | null> => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'Selecione um arquivo PDF (.pdf).';
  if (file.size === 0) return 'O arquivo PDF está vazio.';
  if (file.size > MAX_PDF_BYTES) {
    return `O PDF tem ${formatFileSize(file.size)} e excede o limite de 10 MB.`;
  }

  try {
    const dataUrl = await readFileAsBase64(file);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    let signature = '';
    try {
      signature = atob(base64.slice(0, 8));
    } catch {
      signature = '';
    }
    if (!signature.startsWith('%PDF-')) {
      return 'O arquivo selecionado não é um PDF válido.';
    }
  } catch {
    return 'Não foi possível ler o arquivo PDF. Tente novamente.';
  }

  return null;
};

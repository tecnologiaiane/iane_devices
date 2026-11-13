import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { DocumentTerm } from '../../types';
import { formatDate } from '../../utils/formatters';
import { StatusBadge } from '../StatusBadge';
import {
  Printer,
  Download,
  CheckCircle,
  ShieldCheck,
  FileText,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Paperclip,
} from 'lucide-react';
import { dataService } from '../../services/dataStorage';

interface TermViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  term: DocumentTerm | null;
  onTermUpdated?: () => void;
  autoPrint?: boolean;
}

export const TermViewerModal: React.FC<TermViewerModalProps> = ({
  isOpen,
  onClose,
  term,
  onTermUpdated,
  autoPrint = false,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<DocumentTerm['status']>(
    term?.status ?? 'Pendente de Assinatura'
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasAutoPrintedRef = useRef(false);

  // O termo é mutado em dataService.updateTermStatus (mesmo objeto), então o React
  // não re-renderiza sozinho. Mantemos o status em estado para refletir a mudança
  // imediatamente e ressincronizamos quando o modal abre outro termo.
  useEffect(() => {
    setCurrentStatus(term?.status ?? 'Pendente de Assinatura');
  }, [term?.id, term?.status]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPdf = async () => {
      if (!isOpen || !term?.hasFile) {
        setPdfUrl(null);
        setPdfError('');
        setIsLoadingPdf(false);
        return;
      }

      setIsLoadingPdf(true);
      setPdfError('');
      const res = await dataService.getTermFile(term.id);
      if (cancelled) return;

      if (res.success && res.data) {
        objectUrl = URL.createObjectURL(res.data);
        setPdfUrl(objectUrl);
      } else {
        setPdfError(res.message || 'Não foi possível carregar o PDF deste termo.');
      }
      setIsLoadingPdf(false);
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPdfUrl(null);
    };
  }, [isOpen, term?.id, term?.hasFile]);

  useEffect(() => {
    hasAutoPrintedRef.current = false;
  }, [isOpen, term?.id]);

  useEffect(() => {
    if (!isOpen || !autoPrint || hasAutoPrintedRef.current) return;
    // PDFs são impressos no onLoad do iframe; o layout interno imprime após renderizar.
    if (term?.hasFile) return;

    const timer = window.setTimeout(() => {
      hasAutoPrintedRef.current = true;
      window.print();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoPrint, term?.hasFile, term?.id]);

  if (!term) return null;

  const linkedDevice = term.deviceId ? dataService.getDevices().find((device) => device.id === term.deviceId) : undefined;
  const deviceModel = linkedDevice?.model || term.deviceModel || 'N/A';

  const handlePrint = () => {
    if (pdfUrl && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
      return;
    }
    window.print();
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = term.fileName || `${term.code}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleToggleSign = () => {
    const nextStatus = currentStatus === 'Assinado' ? 'Pendente de Assinatura' : 'Assinado';
    setCurrentStatus(nextStatus);
    dataService.updateTermStatus(term.id, nextStatus);
    if (onTermUpdated) onTermUpdated();
  };

  const hasPdf = !!term.hasFile;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Visualização de documento: ${term.code}`}
      subtitle={hasPdf ? `${term.type} - PDF original anexado` : `${term.type} - Registro oficial de guarda patrimonial`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-ink-50 border border-ink-200 rounded-lg no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-700">Situação jurídica:</span>
            <StatusBadge status={currentStatus} type="term" />
            {currentStatus === 'Assinado' && term.signedAt && (
              <span className="text-[11px] text-ink-500">
                (Assinado em {term.signedAt})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleSign}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                currentStatus === 'Assinado'
                  ? 'bg-sun-100 text-gold-700 hover:bg-sun-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>
                {currentStatus === 'Assinado' ? 'Marcar como pendente' : 'Registrar assinatura'}
              </span>
            </button>

            {hasPdf && pdfUrl && (
              <>
                <button
                  onClick={handleOpenInNewTab}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-700 bg-white border border-ink-300 hover:bg-ink-100 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-ink-600" />
                  <span>Abrir em nova aba</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-700 bg-white border border-ink-300 hover:bg-ink-100 transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-ink-600" />
                  <span>Baixar PDF</span>
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {hasPdf ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-ink-500">
              <Paperclip className="w-3.5 h-3.5 text-iane-600" />
              <span className="font-mono truncate">{term.fileName || `${term.code}.pdf`}</span>
            </div>

            {isLoadingPdf && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 bg-ink-50 border border-ink-200 rounded-xl text-ink-500">
                <Loader2 className="w-6 h-6 animate-spin text-iane-600" />
                <p className="text-xs font-medium">Carregando PDF do termo...</p>
              </div>
            )}

            {!isLoadingPdf && pdfError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{pdfError}</span>
              </div>
            )}

            {!isLoadingPdf && pdfUrl && (
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                title={`PDF do termo ${term.code}`}
                className="w-full rounded-xl border border-ink-200 bg-white"
                style={{ height: '70vh' }}
                onLoad={() => {
                  if (!autoPrint || hasAutoPrintedRef.current) return;
                  hasAutoPrintedRef.current = true;
                  window.setTimeout(() => iframeRef.current?.contentWindow?.print(), 150);
                }}
              />
            )}
          </div>
        ) : (
          /* Printable Official Document Layout (termo gerado pelo aplicativo) */
          <div 
            id="printable-term" 
            className="p-8 sm:p-12 bg-white border border-ink-300 rounded-xl shadow-xs text-ink-900 font-sans space-y-6 print:border-none print:shadow-none print:p-0"
          >
            {/* Header of Term */}
            <div className="border-b-2 border-navy-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-lg">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold uppercase tracking-tight text-navy-900">
                    IANE — Gestão de Dispositivos
                  </h2>
                  <p className="text-xs text-ink-600">
                    IANE Indústria e Comércio — Departamento de TI
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 bg-ink-100 border border-ink-300 rounded text-ink-800">
                  {term.code}
                </span>
                <p className="text-[11px] text-ink-500 mt-1">
                  Emissão: {formatDate(term.date)}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center pt-2">
              <h1 className="text-lg font-bold text-navy-900 uppercase tracking-tight">
                {term.title}
              </h1>
              <p className="text-xs text-ink-500 italic mt-0.5">
                Ref.: Atribuição e Custódia de Dispositivo Móvel Corporativo — IANE
              </p>
            </div>

            {/* Identification of Parties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-ink-50 p-4 rounded-lg border border-ink-200">
              <div>
                <h3 className="font-bold text-navy-900 uppercase text-[11px] mb-2 pb-1 border-b border-ink-200">
                  1. Identificação do colaborador
                </h3>
                <div className="space-y-1 text-ink-700">
                  <p><span className="font-semibold text-ink-900">Nome:</span> {term.collaboratorName || 'Não identificado'}</p>
                  <p><span className="font-semibold text-ink-900">Matrícula:</span> <span className="font-mono">{term.collaboratorRegistration || '-'}</span></p>
                  <p><span className="font-semibold text-ink-900">Departamento:</span> {term.collaboratorDepartment || '-'}</p>
                  <p>
                    <span className="font-semibold text-ink-900">CPF:</span>{' '}
                    <span className="font-mono">{term.collaboratorCpf || 'Não informado'}</span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-navy-900 uppercase text-[11px] mb-2 pb-1 border-b border-ink-200">
                  2. Identificação do ativo e linha
                </h3>
                <div className="space-y-1 text-ink-700">
                  <p><span className="font-semibold text-ink-900">Identificador patrimonial:</span> <span className="font-mono font-semibold">{term.deviceTag || 'N/A'}</span></p>
                  <p><span className="font-semibold text-ink-900">Modelo:</span> {deviceModel}</p>
                  <p><span className="font-semibold text-ink-900">IMEI:</span> <span className="font-mono">{term.deviceImei || 'N/A'}</span></p>
                  <p><span className="font-semibold text-ink-900">Linha telefônica:</span> <span className="font-mono font-semibold">{term.phoneNumber || 'Não associada'}</span></p>
                </div>
              </div>
            </div>

            {/* Accessories List */}
            {term.accessoriesList && term.accessoriesList.length > 0 && (
              <div className="text-xs">
                <h3 className="font-bold text-navy-900 uppercase text-[11px] mb-2">
                  3. Acessórios e itens entregues
                </h3>
                <div className="flex flex-wrap gap-2">
                  {term.accessoriesList.map((acc, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-ink-100 border border-ink-200 rounded text-ink-700 text-xs">
                      ✓ {acc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Legal Clauses */}
            <div className="text-xs text-ink-700 space-y-2">
              <h3 className="font-bold text-navy-900 uppercase text-[11px] mb-1">
                4. Cláusulas e condições de uso
              </h3>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                {term.clauses.map((clause, idx) => (
                  <li key={idx}>{clause}</li>
                ))}
              </ol>
            </div>

            {term.notes && (
              <div className="text-xs bg-sun-50 p-3 rounded border border-sun-300 text-gold-700">
                <span className="font-semibold">Observações registradas:</span> {term.notes}
              </div>
            )}

            {/* Signature Lines */}
            <div className="pt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-center">
              <div className="flex flex-col items-center">
                <div className="w-64 border-b border-ink-800 mb-2"></div>
                <p className="font-bold text-navy-900">{term.collaboratorName || 'Assinatura do colaborador'}</p>
                <p className="text-[11px] text-ink-500">
                  {term.collaboratorRegistration ? `Matrícula: ${term.collaboratorRegistration}` : 'Colaborador responsável'}
                </p>
                {currentStatus === 'Assinado' ? (
                  <span className="mt-2 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Assinado digitalmente
                  </span>
                ) : (
                  <span className="mt-2 text-[10px] text-gold-700 font-medium bg-sun-50 px-2 py-0.5 rounded border border-sun-300">
                    Aguardando assinatura
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center">
                <div className="w-64 border-b border-ink-800 mb-2"></div>
                <p className="font-bold text-navy-900">Gestão de TI & Telecomunicações</p>
                <p className="text-[11px] text-ink-500">Patrimônio corporativo</p>
                <span className="mt-2 text-[10px] text-ink-600 font-mono">
                  Data: {formatDate(term.date)}
                </span>
              </div>
            </div>

            {!term.hasFile && (
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-400 no-print">
                <FileText className="w-3 h-3" />
                Documento gerado pelo aplicativo. Nenhum PDF foi anexado a este termo.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

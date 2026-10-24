import React from 'react';
import { Modal } from '../Modal';
import { DocumentTerm } from '../../types';
import { formatDate } from '../../utils/formatters';
import { StatusBadge } from '../StatusBadge';
import { Printer, Download, CheckCircle, ShieldCheck, FileText } from 'lucide-react';
import { dataService } from '../../services/dataStorage';

interface TermViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  term: DocumentTerm | null;
  onTermUpdated?: () => void;
}

export const TermViewerModal: React.FC<TermViewerModalProps> = ({
  isOpen,
  onClose,
  term,
  onTermUpdated,
}) => {
  if (!term) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleToggleSign = () => {
    const nextStatus = term.status === 'Assinado' ? 'Pendente de Assinatura' : 'Assinado';
    dataService.updateTermStatus(term.id, nextStatus);
    if (onTermUpdated) onTermUpdated();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Visualização de Documento: ${term.code}`}
      subtitle={`${term.type} - Registro oficial de guarda patrimonial`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Situação Jurídica:</span>
            <StatusBadge status={term.status} type="term" />
            {term.signedAt && (
              <span className="text-[11px] text-slate-500">
                (Assinado em {term.signedAt})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSign}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                term.status === 'Assinado'
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>
                {term.status === 'Assinado' ? 'Marcar como Pendente' : 'Registrar Assinatura'}
              </span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimir / Gerar PDF</span>
            </button>
          </div>
        </div>

        {/* Printable Official Document Layout */}
        <div 
          id="printable-term" 
          className="p-8 sm:p-12 bg-white border border-slate-300 rounded-xl shadow-xs text-slate-900 font-sans space-y-6 print:border-none print:shadow-none print:p-0"
        >
          {/* Header of Term */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-tight text-slate-900">
                  IANE — Gestão de Dispositivos
                </h2>
                <p className="text-xs text-slate-600">
                  IANE Indústria e Comércio — Departamento de TI
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="inline-block text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-slate-800">
                {term.code}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Emissão: {formatDate(term.date)}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center pt-2">
            <h1 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              {term.title}
            </h1>
            <p className="text-xs text-slate-500 italic mt-0.5">
              Ref.: Atribuição e Custódia de Dispositivo Móvel Corporativo — IANE
            </p>
          </div>

          {/* Identification of Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 uppercase text-[11px] mb-2 pb-1 border-b border-slate-200">
                1. Identificação do Colaborador
              </h3>
              <div className="space-y-1 text-slate-700">
                <p><span className="font-semibold text-slate-900">Nome:</span> {term.collaboratorName || 'Não identificado'}</p>
                <p><span className="font-semibold text-slate-900">Matrícula:</span> <span className="font-mono">{term.collaboratorRegistration || '-'}</span></p>
                <p><span className="font-semibold text-slate-900">Departamento:</span> {term.collaboratorDepartment || '-'}</p>
                {term.collaboratorCpf && (
                  <p><span className="font-semibold text-slate-900">CPF:</span> <span className="font-mono">{term.collaboratorCpf}</span></p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 uppercase text-[11px] mb-2 pb-1 border-b border-slate-200">
                2. Identificação do Ativo e Linha
              </h3>
              <div className="space-y-1 text-slate-700">
                <p><span className="font-semibold text-slate-900">Identificador Patrimonial:</span> <span className="font-mono font-semibold">{term.deviceTag || 'N/A'}</span></p>
                <p><span className="font-semibold text-slate-900">Modelo / Marca:</span> {term.deviceModel || 'N/A'}</p>
                <p><span className="font-semibold text-slate-900">IMEI:</span> <span className="font-mono">{term.deviceImei || 'N/A'}</span></p>
                <p><span className="font-semibold text-slate-900">Linha Telefônica:</span> <span className="font-mono font-semibold">{term.phoneNumber || 'Não associada'}</span></p>
              </div>
            </div>
          </div>

          {/* Accessories List */}
          {term.accessoriesList && term.accessoriesList.length > 0 && (
            <div className="text-xs">
              <h3 className="font-bold text-slate-900 uppercase text-[11px] mb-2">
                3. Acessórios e Itens Entregues
              </h3>
              <div className="flex flex-wrap gap-2">
                {term.accessoriesList.map((acc, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 text-xs">
                    ✓ {acc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legal Clauses */}
          <div className="text-xs text-slate-700 space-y-2">
            <h3 className="font-bold text-slate-900 uppercase text-[11px] mb-1">
              4. Cláusulas e Condições de Uso
            </h3>
            <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
              {term.clauses.map((clause, idx) => (
                <li key={idx}>{clause}</li>
              ))}
            </ol>
          </div>

          {term.notes && (
            <div className="text-xs bg-amber-50/50 p-3 rounded border border-amber-200 text-amber-900">
              <span className="font-semibold">Observações Registradas:</span> {term.notes}
            </div>
          )}

          {/* Signature Lines */}
          <div className="pt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-center">
            <div className="flex flex-col items-center">
              <div className="w-64 border-b border-slate-800 mb-2"></div>
              <p className="font-bold text-slate-900">{term.collaboratorName || 'Assinatura do Colaborador'}</p>
              <p className="text-[11px] text-slate-500">
                {term.collaboratorRegistration ? `Matrícula: ${term.collaboratorRegistration}` : 'Colaborador Responsável'}
              </p>
              {term.status === 'Assinado' ? (
                <span className="mt-2 text-[10px] text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Assinado Digitalmente
                </span>
              ) : (
                <span className="mt-2 text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Aguardando Assinatura
                </span>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="w-64 border-b border-slate-800 mb-2"></div>
              <p className="font-bold text-slate-900">Gestão de TI & Telecomunicações</p>
              <p className="text-[11px] text-slate-500">Patrimônio Corporativo</p>
              <span className="mt-2 text-[10px] text-slate-600 font-mono">
                Data: {formatDate(term.date)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

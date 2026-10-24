import React, { useState } from 'react';
import { DocumentTerm, TermType, TermStatus } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Printer,
  CheckCircle,
  Clock,
  Download,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface TermsViewProps {
  onViewTerm: (term: DocumentTerm) => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onViewTerm }) => {
  const [terms, setTerms] = useState<DocumentTerm[]>(dataService.getTerms());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');

  const refreshData = () => {
    setTerms(dataService.getTerms());
  };

  const filteredTerms = terms.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = t.code.toLowerCase().includes(q);
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCollab = t.collaboratorName?.toLowerCase().includes(q) || false;
      const matchDevice = t.deviceTag?.toLowerCase().includes(q) || false;
      const matchPhone = t.phoneNumber?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || false;
      if (!matchCode && !matchTitle && !matchCollab && !matchDevice && !matchPhone) return false;
    }

    if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
    if (typeFilter !== 'todos' && t.type !== typeFilter) return false;

    return true;
  });

  const pendingCount = terms.filter(t => t.status === 'Pendente de Assinatura').length;
  const signedCount = terms.filter(t => t.status === 'Assinado').length;

  return (
    <div className="space-y-5">
      {/* Pending status banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Atenção ao Compliance: </span>
              <span>Há <strong>{pendingCount} documento(s)</strong> pendente(s) de colheita de assinatura formal do colaborador.</span>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('Pendente de Assinatura')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shrink-0"
          >
            Filtrar Pendentes
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar termo por código, colaborador, tag do aparelho ou linha..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg font-semibold tabular-nums">
              {signedCount} assinados
            </span>
            <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-semibold tabular-nums">
              {pendingCount} pendentes
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-slate-400" />
            Filtros:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Assinado">Assinado</option>
            <option value="Pendente de Assinatura">Pendente de Assinatura</option>
            <option value="Arquivado">Arquivado</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="todos">Tipo de Documento: Todos</option>
            <option value="Termo de Entrega">Termo de Entrega</option>
            <option value="Termo de Devolução">Termo de Devolução</option>
            <option value="Termo de Transferência">Termo de Transferência</option>
          </select>

          {(statusFilter !== 'todos' || typeFilter !== 'todos') && (
            <button
              onClick={() => {
                setStatusFilter('todos');
                setTypeFilter('todos');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-[11px] text-slate-500 tabular-nums">
            Exibindo <strong>{filteredTerms.length}</strong> de <strong>{terms.length}</strong> documentos
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Código do Termo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Colaborador Titular</th>
                <th className="py-3 px-4">Ativo / Linha</th>
                <th className="py-3 px-4">Data de Emissão</th>
                <th className="py-3 px-4">Situação da Assinatura</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTerms.map((term) => (
                <tr 
                  key={term.id} 
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onViewTerm(term)}
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {term.code}
                  </td>

                  <td className="py-3 px-4 font-medium text-slate-800">
                    {term.type}
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{term.collaboratorName || 'Não especificado'}</span>
                    {term.collaboratorRegistration && (
                      <span className="text-[11px] text-slate-500 font-mono">Mat.: {term.collaboratorRegistration}</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {term.deviceTag && (
                      <span className="font-mono text-blue-700 font-semibold block">{term.deviceTag}</span>
                    )}
                    {term.phoneNumber && (
                      <span className="text-[11px] text-slate-600 font-mono">{term.phoneNumber}</span>
                    )}
                    {!term.deviceTag && !term.phoneNumber && (
                      <span className="text-slate-400 italic">Geral</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                    {formatDate(term.date)}
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge status={term.status} type="term" />
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onViewTerm(term)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Visualizar & Imprimir</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTerms.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Nenhum termo encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Nenhum documento atende aos filtros atuais.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

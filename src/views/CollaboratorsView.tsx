import React, { useState } from 'react';
import { Collaborator, Device, PhoneLine, Movement, DocumentTerm } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  Users,
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Smartphone,
  PhoneCall,
  Mail,
  Phone,
  Building2,
  FileText,
  X,
  History
} from 'lucide-react';

interface CollaboratorsViewProps {
  onOpenCollaboratorModal: (collab?: Collaborator) => void;
  onViewTerm: (term: DocumentTerm) => void;
  onOpenMovementWithCollaborator: (collabId: string) => void;
}

export const CollaboratorsView: React.FC<CollaboratorsViewProps> = ({
  onOpenCollaboratorModal,
  onViewTerm,
  onOpenMovementWithCollaborator,
}) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>(dataService.getCollaborators());
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Detail view
  const [detailCollab, setDetailCollab] = useState<Collaborator | null>(null);

  const refreshData = () => {
    const list = dataService.getCollaborators();
    setCollaborators(list);
    if (detailCollab) {
      setDetailCollab(list.find(c => c.id === detailCollab.id) || null);
    }
  };

  const filteredCollabs = collaborators.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (c.fullName || '').toLowerCase().includes(q);
      const matchMat = (c.registrationNumber || '').toLowerCase().includes(q);
      const matchRole = (c.position || '').toLowerCase().includes(q);
      const matchEmail = (c.corporateEmail || '').toLowerCase().includes(q);
      if (!matchName && !matchMat && !matchRole && !matchEmail) return false;
    }

    if (departmentFilter !== 'todos' && c.department !== departmentFilter) return false;
    if (statusFilter !== 'todos' && c.status !== statusFilter) return false;

    return true;
  });

  const uniqueDepartments = Array.from(new Set(collaborators.map(c => c.department)));

  // Assets held by selected collaborator
  const collabDevices = detailCollab
    ? dataService.getDevices().filter(d => d.currentCollaboratorId === detailCollab.id)
    : [];

  const collabLines = detailCollab
    ? dataService.getLines().filter(l => l.currentCollaboratorId === detailCollab.id)
    : [];

  const collabMovements = detailCollab
    ? dataService.getMovements().filter(m => m.destinationCollaboratorId === detailCollab.id || m.originCollaboratorId === detailCollab.id)
    : [];

  const collabTerms = detailCollab
    ? dataService.getTerms().filter(t => t.collaboratorId === detailCollab.id)
    : [];

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador por nome, matrícula, cargo ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <button
            onClick={() => onOpenCollaboratorModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Colaborador</span>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-ink-400" />
            Filtros:
          </span>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Departamento: Todos</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Férias">Férias</option>
            <option value="Afastado">Afastado</option>
            <option value="Desligado">Desligado</option>
          </select>

          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">
            Exibindo <strong>{filteredCollabs.length}</strong> de <strong>{collaborators.length}</strong> colaboradores
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Nome do Colaborador</th>
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4">Cargo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Ativos Vinculados</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredCollabs.map((collab) => {
                const heldDevices = dataService.getDevices().filter(d => d.currentCollaboratorId === collab.id);
                const heldLines = dataService.getLines().filter(l => l.currentCollaboratorId === collab.id);

                return (
                  <tr 
                    key={collab.id} 
                    className="hover:bg-ink-50/80 transition-colors group cursor-pointer"
                    onClick={() => setDetailCollab(collab)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink-900">{collab.fullName}</div>
                      <div className="text-[11px] text-ink-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-ink-400" />
                        <span>{collab.corporateEmail}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-ink-700">
                      {collab.registrationNumber}
                    </td>

                    <td className="py-3 px-4 font-medium text-ink-800">
                      {collab.department}
                    </td>

                    <td className="py-3 px-4 font-medium text-ink-800">
                      {collab.sector || 'Não informado'}
                    </td>

                    <td className="py-3 px-4 text-ink-600">
                      {collab.position}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={collab.status} type="collaborator" />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {heldDevices.length > 0 ? (
                          heldDevices.map(d => (
                            <span key={d.id} className="font-mono text-[11px] font-semibold text-iane-700 bg-iane-50 px-2 py-0.5 rounded border border-iane-200">
                              {d.assetTag}
                            </span>
                          ))
                        ) : (
                          <span className="text-ink-400 italic">Nenhum aparelho</span>
                        )}
                        {heldLines.length > 0 && (
                          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {heldLines.length} linha(s)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Ver Perfil Completo"
                        onClick={() => setDetailCollab(collab)}
                        className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Editar Colaborador"
                        onClick={() => onOpenCollaboratorModal(collab)}
                        className="p-1.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLLABORATOR DETAIL MODAL */}
      {detailCollab && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setDetailCollab(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className="relative bg-white rounded-xl shadow-2xl border border-ink-200 w-full max-w-3xl overflow-hidden p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-ink-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-ink-900 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {detailCollab.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink-900">
                        {detailCollab.fullName}
                      </h2>
                      <StatusBadge status={detailCollab.status} type="collaborator" />
                    </div>
                    <p className="text-xs text-ink-500">
                      Matrícula: <span className="font-mono font-bold text-ink-700">{detailCollab.registrationNumber}</span> · {detailCollab.department} · Setor: {detailCollab.sector || 'Não informado'} ({detailCollab.position})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailCollab(null)}
                  className="text-ink-400 hover:text-ink-700 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid 1: Contato e Identificação */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-ink-50 rounded-lg text-xs">
                <div>
                  <span className="text-ink-400 text-[11px] block">E-mail</span>
                  <span className="font-medium text-ink-900">{detailCollab.corporateEmail || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Telefone de Contato</span>
                  <span className="font-mono text-ink-900">{detailCollab.contactPhone || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">CPF</span>
                  <span className="font-mono text-ink-900">{detailCollab.cpf || 'Não registrado'}</span>
                </div>
              </div>

              {/* Grid 2: Aparelhos e Linhas Atuais */}
              <div>
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-iane-600" />
                  <span>Aparelhos Celulares Atualmente Vinculados ({collabDevices.length})</span>
                </h3>
                {collabDevices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {collabDevices.map(d => (
                      <div key={d.id} className="p-3 bg-white border border-ink-200 rounded-lg text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-iane-700">{d.assetTag}</span>
                          <StatusBadge status={d.condition} type="condition" size="sm" />
                        </div>
                        <p className="font-semibold text-ink-900">{d.model}</p>
                        <p className="text-[11px] text-ink-500 font-mono">IMEI: {d.imei1}</p>
                        {d.associatedPhoneNumber && (
                          <p className="text-[11px] text-emerald-700 font-mono font-medium">Linha: {d.associatedPhoneNumber}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 italic bg-ink-50 p-3 rounded-lg">
                    Nenhum aparelho celular está sob posse deste colaborador no momento.
                  </p>
                )}
              </div>

              {/* Grid 3: Termos de Responsabilidade Assinados / Pendentes */}
              <div>
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-iane-600" />
                  <span>Termos e Documentos de Guarda ({collabTerms.length})</span>
                </h3>
                {collabTerms.length > 0 ? (
                  <div className="space-y-2">
                    {collabTerms.map(t => (
                      <div key={t.id} className="p-2.5 bg-ink-50 border border-ink-200 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-ink-900">{t.code}</span>
                            <StatusBadge status={t.status} type="term" size="sm" />
                          </div>
                          <span className="text-[11px] text-ink-500">{t.type} · Data: {formatDate(t.date)}</span>
                        </div>
                        <button
                          onClick={() => {
                            setDetailCollab(null);
                            onViewTerm(t);
                          }}
                          className="px-2.5 py-1 bg-white border border-ink-300 hover:bg-ink-100 rounded text-xs font-semibold text-ink-700"
                        >
                          Ver Termo
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 italic bg-ink-50 p-3 rounded-lg">
                    Nenhum termo de responsabilidade registrado para este colaborador.
                  </p>
                )}
              </div>

              {/* Grid 4: Histórico de Movimentações */}
              <div>
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-ink-500" />
                  <span>Histórico de Entregas e Devoluções ({collabMovements.length})</span>
                </h3>
                <div className="max-h-36 overflow-y-auto divide-y divide-ink-100 text-xs">
                  {collabMovements.map(m => (
                    <div key={m.id} className="py-2 flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-ink-900">{m.type}</span>
                        <span className="text-ink-400"> · </span>
                        <span className="font-mono text-ink-600">{m.deviceTag || m.phoneNumber}</span>
                        <p className="text-[11px] text-ink-500">{m.reason || 'Movimentação patrimonial regular'}</p>
                      </div>
                      <span className="font-mono text-[11px] text-ink-500">{formatDate(m.date)}</span>
                    </div>
                  ))}
                  {collabMovements.length === 0 && (
                    <p className="text-xs text-ink-400 italic py-2">Sem movimentações anteriores.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-ink-200">
                <button
                  onClick={() => setDetailCollab(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

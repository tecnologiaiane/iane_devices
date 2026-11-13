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
  Microchip,
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
      <div className="bg-surface p-4 rounded-xl border border-line shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador por nome, matrícula, cargo ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-line-strong bg-surface placeholder:text-muted text-text focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
          </div>

          <button
            onClick={() => onOpenCollaboratorModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-on-accent bg-accent hover:bg-accent/90 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Colaborador</span>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
          <span className="text-muted font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-muted" />
            Filtros:
          </span>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Departamento: Todos</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Férias">Férias</option>
            <option value="Afastado">Afastado</option>
            <option value="Desligado">Desligado</option>
          </select>

          <div className="ml-auto text-[11px] text-muted tabular-nums">
            Exibindo <strong>{filteredCollabs.length}</strong> de <strong>{collaborators.length}</strong> colaboradores
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-xl border border-line shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ds-table">
            <thead className="bg-subtle border-b border-line text-muted uppercase font-semibold tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-line">
              {filteredCollabs.map((collab) => {
                const heldDevices = dataService.getDevices().filter(d => d.currentCollaboratorId === collab.id);
                const heldLines = dataService.getLines().filter(l => l.currentCollaboratorId === collab.id);

                return (
                  <tr 
                    key={collab.id} 
                    className="hover:bg-subtle/80 transition-colors group cursor-pointer"
                    onClick={() => setDetailCollab(collab)}
                  >
                    <td data-label="Nome do Colaborador" className="py-3 px-4">
                      <div className="font-semibold text-text">{collab.fullName}</div>
                      <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-muted" />
                        <span>{collab.corporateEmail}</span>
                      </div>
                    </td>

                    <td data-label="Matrícula" className="py-3 px-4 font-mono font-bold text-text">
                      {collab.registrationNumber}
                    </td>

                    <td data-label="Departamento" className="py-3 px-4 font-medium text-text">
                      {collab.department}
                    </td>

                    <td data-label="Setor" className="py-3 px-4 font-medium text-text">
                      {collab.sector || 'Não informado'}
                    </td>

                    <td data-label="Cargo" className="py-3 px-4 text-muted">
                      {collab.position}
                    </td>

                    <td data-label="Status" className="py-3 px-4">
                      <StatusBadge status={collab.status} type="collaborator" />
                    </td>

                    <td data-label="Ativos Vinculados" className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          title={heldDevices.length > 0 ? heldDevices.map(d => d.assetTag).join(', ') : 'Nenhum aparelho vinculado'}
                          aria-label={heldDevices.length > 0 ? 'Aparelho vinculado' : 'Nenhum aparelho vinculado'}
                          className={`inline-flex items-center justify-center p-1.5 rounded border ${
                            heldDevices.length > 0
                              ? 'bg-info-bg border-info-bd text-accent'
                              : 'bg-subtle border-line text-muted'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </span>
                        <span
                          title={heldLines.length > 0 ? `${heldLines.length} linha(s) vinculada(s)` : 'Nenhuma linha vinculada'}
                          aria-label={heldLines.length > 0 ? 'Linha vinculada' : 'Nenhuma linha vinculada'}
                          className={`inline-flex items-center justify-center p-1.5 rounded border ${
                            heldLines.length > 0
                              ? 'bg-ok-bg border-ok-bd text-ok-fg'
                              : 'bg-subtle border-line text-muted'
                          }`}
                        >
                          <Microchip className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </td>

                    <td data-label="Ações" className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Ver Perfil Completo"
                        onClick={() => setDetailCollab(collab)}
                        className="p-1.5 text-muted hover:text-accent hover:bg-info-bg rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Editar Colaborador"
                        onClick={() => onOpenCollaboratorModal(collab)}
                        className="p-1.5 text-muted hover:text-text hover:bg-subtle rounded-md transition-colors"
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
          <div className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-xs" onClick={() => setDetailCollab(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className="relative bg-surface rounded-xl shadow-2xl border border-line w-full max-w-3xl overflow-hidden p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-navy text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {detailCollab.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-text">
                        {detailCollab.fullName}
                      </h2>
                      <StatusBadge status={detailCollab.status} type="collaborator" />
                    </div>
                    <p className="text-xs text-muted">
                      Matrícula: <span className="font-mono font-bold text-text">{detailCollab.registrationNumber}</span> · {detailCollab.department} · Setor: {detailCollab.sector || 'Não informado'}{detailCollab.unit ? ` · Unidade: ${detailCollab.unit}` : ''} ({detailCollab.position})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailCollab(null)}
                  className="text-muted hover:text-text p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid 1: Contato e Identificação */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-subtle rounded-lg text-xs">
                <div>
                  <span className="text-muted text-[11px] block">E-mail</span>
                  <span className="font-medium text-text">{detailCollab.corporateEmail || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Telefone de Contato</span>
                  <span className="font-mono text-text">{detailCollab.contactPhone || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">CPF</span>
                  <span className="font-mono text-text">{detailCollab.cpf || 'Não registrado'}</span>
                </div>
              </div>

              {/* Grid 2: Aparelhos e Linhas Atuais */}
              <div>
                <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-accent" />
                  <span>Aparelhos Celulares Atualmente Vinculados ({collabDevices.length})</span>
                </h3>
                {collabDevices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {collabDevices.map(d => (
                      <div key={d.id} className="p-3 bg-surface border border-line rounded-lg text-xs space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-accent">{d.assetTag}</span>
                          <StatusBadge status={d.condition} type="condition" size="sm" />
                        </div>
                        <p className="font-semibold text-text">{d.model}</p>
                        <p className="text-[11px] text-muted font-mono">IMEI: {d.imei1}</p>
                        {d.associatedPhoneNumber && (
                          <p className="text-[11px] text-ok-fg font-mono font-medium">Linha: {d.associatedPhoneNumber}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic bg-subtle p-3 rounded-lg">
                    Nenhum aparelho celular está sob posse deste colaborador no momento.
                  </p>
                )}
              </div>

              {/* Grid 3: Termos de Responsabilidade Assinados / Pendentes */}
              <div>
                <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  <span>Termos e Documentos de Guarda ({collabTerms.length})</span>
                </h3>
                {collabTerms.length > 0 ? (
                  <div className="space-y-2">
                    {collabTerms.map(t => (
                      <div key={t.id} className="p-2.5 bg-subtle border border-line rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-text">{t.code}</span>
                            <StatusBadge status={t.status} type="term" size="sm" />
                          </div>
                          <span className="text-[11px] text-muted">{t.type} · Data: {formatDate(t.date)}</span>
                        </div>
                        <button
                          onClick={() => {
                            setDetailCollab(null);
                            onViewTerm(t);
                          }}
                          className="px-2.5 py-1 bg-surface border border-line-strong hover:bg-subtle rounded text-xs font-semibold text-text"
                        >
                          Ver Termo
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic bg-subtle p-3 rounded-lg">
                    Nenhum termo de responsabilidade registrado para este colaborador.
                  </p>
                )}
              </div>

              {/* Grid 4: Histórico de Movimentações */}
              <div>
                <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-muted" />
                  <span>Histórico de Entregas e Devoluções ({collabMovements.length})</span>
                </h3>
                <div className="max-h-36 overflow-y-auto divide-y divide-line text-xs">
                  {collabMovements.map(m => (
                    <div key={m.id} className="py-2 flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-text">{m.type}</span>
                        <span className="text-muted"> · </span>
                        <span className="font-mono text-muted">{m.deviceTag || m.phoneNumber}</span>
                        <p className="text-[11px] text-muted">{m.reason || 'Movimentação patrimonial regular'}</p>
                      </div>
                      <span className="font-mono text-[11px] text-muted">{formatDate(m.date)}</span>
                    </div>
                  ))}
                  {collabMovements.length === 0 && (
                    <p className="text-xs text-muted italic py-2">Sem movimentações anteriores.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-line">
                <button
                  onClick={() => setDetailCollab(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-text bg-subtle hover:bg-line rounded-lg"
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

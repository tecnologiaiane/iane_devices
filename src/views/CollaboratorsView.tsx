import React, { useEffect, useRef, useState } from 'react';
import { Collaborator, Device, PhoneLine, Movement, DocumentTerm } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
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
  History,
  ChevronLeft,
  ChevronRight,
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

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizes = [10, 25, 50, 100];

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

  const totalPages = Math.ceil(filteredCollabs.length / pageSize) || 1;
  const paginatedCollabs = filteredCollabs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador por nome, matrícula, cargo ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-xs radius-base border border-border-subtle bg-surface-card placeholder-text-muted text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            />
          </div>

          <div
            ref={filterMenuRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() => setIsFilterMenuOpen((open) => !open)}
              aria-expanded={isFilterMenuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-2 radius-lg border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            >
              <Filter className="w-3 h-3 text-text-muted" />
              <span>Filtros</span>
              {(
                departmentFilter !== 'todos' ||
                statusFilter !== 'todos'
              ) && (
                <Badge variant="info" size="sm" className="text-[10px]">
                  ativos
                </Badge>
              )}
            </button>

            {isFilterMenuOpen && (
              <div
                className="absolute z-40 mt-1 w-72 overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-lg py-2"
              >
                <div className="px-3 py-2 space-y-3 border-b border-border-subtle pb-2">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Departamento</label>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="w-full h-9 text-xs radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                    >
                      <option value="todos">Todos</option>
                      {uniqueDepartments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full h-9 text-xs radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                    >
                      <option value="todos">Todos</option>
                      <option value="Ativo">Ativo</option>
                      <option value="Férias">Férias</option>
                      <option value="Afastado">Afastado</option>
                      <option value="Desligado">Desligado</option>
                    </select>
                  </div>
                </div>

                <div className="px-3 py-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsFilterMenuOpen(false)}>Fechar</Button>
                  {(departmentFilter !== 'todos' || statusFilter !== 'todos') && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setDepartmentFilter('todos');
                      setStatusFilter('todos');
                    }}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onOpenCollaboratorModal()} className="flex items-center gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Colaborador</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, filteredCollabs.length)}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredCollabs.length}</span>
            <span className="text-[11px]">colaboradores</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-text-muted">Por página:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-auto h-9 text-[11px] radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
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
            <tbody className="divide-y divide-border-subtle">
              {paginatedCollabs.map((collab) => {
                const heldDevices = dataService.getDevices().filter(d => d.currentCollaboratorId === collab.id);
                const heldLines = dataService.getLines().filter(l => l.currentCollaboratorId === collab.id);

                return (
                  <tr
                    key={collab.id}
                    className="hover:bg-surface-subtle transition-colors group cursor-pointer"
                    onClick={() => setDetailCollab(collab)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-text-primary">{collab.fullName}</div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-border-strong" />
                        <span>{collab.corporateEmail}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-code font-bold text-text-primary">
                      {collab.registrationNumber}
                    </td>

                    <td className="py-3 px-4 font-medium text-text-muted">
                      {collab.department}
                    </td>

                    <td className="py-3 px-4 font-medium text-text-muted">
                      {collab.sector || 'Não informado'}
                    </td>

                    <td className="py-3 px-4 text-text-muted">
                      {collab.position}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={collab.status} type="collaborator" />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          title={heldDevices.length > 0 ? heldDevices.map(d => d.assetTag).join(', ') : 'Nenhum aparelho vinculado'}
                          aria-label={heldDevices.length > 0 ? 'Aparelho vinculado' : 'Nenhum aparelho vinculado'}
                          className={`inline-flex items-center justify-center p-1.5 radius-base border border-border-subtle ${heldDevices.length > 0 ? 'bg-surface-subtle text-text-primary' : 'bg-surface-card text-text-muted'}`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </span>
                        <span
                          title={heldLines.length > 0 ? `${heldLines.length} linha(s) vinculada(s)` : 'Nenhuma linha vinculada'}
                          aria-label={heldLines.length > 0 ? 'Linha vinculada' : 'Nenhuma linha vinculada'}
                          className={`inline-flex items-center justify-center p-1.5 radius-base border border-border-subtle ${heldLines.length > 0 ? 'bg-surface-subtle text-text-primary' : 'bg-surface-card text-text-muted'}`}
                        >
                          <Microchip className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Ver Perfil Completo"
                        onClick={() => setDetailCollab(collab)}
                        className="p-1.5 text-text-muted hover:text-brand-blue-action hover:bg-surface-subtle radius-base transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        title="Editar Colaborador"
                        onClick={() => onOpenCollaboratorModal(collab)}
                        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-subtle radius-base transition-colors"
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span>Página {currentPage} de {totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {detailCollab && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setDetailCollab(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-3xl overflow-hidden p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 radius-full bg-brand-navy-base text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {detailCollab.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-text-primary">
                        {detailCollab.fullName}
                      </h2>
                      <StatusBadge status={detailCollab.status} type="collaborator" />
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Matrícula: <span className="font-code font-bold text-text-primary">{detailCollab.registrationNumber}</span> · {detailCollab.department} · Setor: {detailCollab.sector || 'Não informado'}{detailCollab.unit ? ` · Unidade: ${detailCollab.unit}` : ''} ({detailCollab.position})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailCollab(null)}
                  className="text-text-muted hover:text-text-primary p-1.5 radius-base hover:bg-surface-subtle transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-surface-subtle radius-base text-[11px]">
                <div>
                  <span className="text-text-muted block">E-mail Corporativo</span>
                  <span className="font-code text-text-primary">{detailCollab.corporateEmail || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Telefone de Contato</span>
                  <span className="font-code text-text-primary">{detailCollab.contactPhone || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">CPF</span>
                  <span className="font-code text-text-primary">{detailCollab.cpf || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Unidade</span>
                  <span className="font-medium text-text-primary">{detailCollab.unit || 'Não informada'}</span>
                </div>
              </div>

              {collabDevices.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-brand-blue-action" />
                    <span className="text-[11px] font-medium text-text-primary">Aparelhos Vinculados ({collabDevices.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {collabDevices.map((device) => (
                      <span key={device.id} className="text-[11px] px-2.5 py-1 radius-base border border-brand-blue-action/30 bg-brand-blue-action/10 text-brand-blue-action font-code font-medium">
                        {device.assetTag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {collabLines.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneCall className="w-3.5 h-3.5 text-brand-blue-action" />
                    <span className="text-[11px] font-medium text-text-primary">Linhas Vinculadas ({collabLines.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {collabLines.map((line) => (
                      <span key={line.id} className="text-[11px] px-2.5 py-1 radius-base border border-brand-blue-action/30 bg-brand-blue-action/10 text-brand-blue-action font-code font-medium">
                        {line.phoneNumber}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {collabMovements.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <History className="w-3.5 h-3.5 text-brand-blue-action" />
                    <span className="text-[11px] font-medium text-text-primary">Últimas Movimentações ({collabMovements.length})</span>
                  </div>
                  <div className="space-y-1">
                    {collabMovements.slice(0, 5).map((mov) => (
                      <div key={mov.id} className="flex items-center gap-2 text-[11px]">
                        <span className="font-code text-text-muted">{mov.code}</span>
                        <span className="text-text-muted">{mov.type}</span>
                        <span className="font-code text-brand-blue-action">{formatDate(mov.date)}</span>
                      </div>
                    ))}
                    {collabMovements.length > 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailCollab(null);
                          onOpenMovementWithCollaborator(detailCollab!.id);
                        }}
                        className="text-[11px] font-medium text-brand-blue-action hover:underline"
                      >
                        Ver todas as movimentações
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detailCollab.notes && (
                <div className="text-[11px] p-3 radius-base bg-surface-subtle border border-border-subtle text-text-muted">
                  <span className="font-medium block mb-0.5">Observações:</span>
                  {detailCollab.notes}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={() => setDetailCollab(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

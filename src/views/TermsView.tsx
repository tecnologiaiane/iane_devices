import React, { useRef, useState } from 'react';
import { DocumentTerm, TermType, TermStatus } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { todayISO } from '../utils/dates';
import {
  MAX_PDF_BYTES,
  formatFileSize,
  readFileAsBase64,
  suggestCodeFromFileName,
  validatePdfFile,
} from '../utils/pdfUpload';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Clock,
  Upload,
  Paperclip,
  Printer,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';

interface TermsViewProps {
  onViewTerm: (term: DocumentTerm) => void;
  onPrintTerm: (term: DocumentTerm) => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onViewTerm, onPrintTerm }) => {
  const [terms, setTerms] = useState<DocumentTerm[]>(dataService.getTerms());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [isManualTermModalOpen, setIsManualTermModalOpen] = useState(false);
  const [manualTerm, setManualTerm] = useState<Partial<DocumentTerm>>({
    type: 'Termo de Entrega',
    status: 'Assinado',
    date: todayISO(),
    accessoriesList: [],
    clauses: []
  });
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualError, setManualError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [devices] = useState(() => dataService.getDevices());
  const [collaborators] = useState(() => dataService.getCollaborators());
  const [lines] = useState(() => dataService.getLines());

  const refreshData = () => {
    setTerms(dataService.getTerms());
  };

  const handleSelectDevice = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      setManualTerm((prev) => ({
        ...prev,
        deviceId: undefined,
        deviceTag: undefined,
        deviceModel: undefined,
        deviceImei: undefined,
        phoneLineId: undefined,
        phoneNumber: undefined,
      }));
      return;
    }
    const line = lines.find((l) => l.id === device.associatedLineId || l.associatedDeviceId === device.id);
    const currentCollab = collaborators.find((c) => c.id === device.currentCollaboratorId);
    setManualTerm((prev) => ({
      ...prev,
      deviceId: device.id,
      deviceTag: device.assetTag,
      deviceModel: device.model.trim(),
      deviceImei: device.imei1,
      phoneLineId: line?.id,
      phoneNumber: line?.phoneNumber,
      collaboratorId: prev.collaboratorId || currentCollab?.id,
      collaboratorName: prev.collaboratorName || currentCollab?.fullName,
      collaboratorRegistration: prev.collaboratorRegistration || currentCollab?.registrationNumber,
      collaboratorCpf: prev.collaboratorCpf || currentCollab?.cpf,
      collaboratorDepartment: prev.collaboratorDepartment || currentCollab?.department,
    }));
  };

  const handleSelectCollaborator = (collaboratorId: string) => {
    const collab = collaborators.find((c) => c.id === collaboratorId);
    if (!collab) {
      setManualTerm((prev) => ({
        ...prev,
        collaboratorId: undefined,
        collaboratorName: undefined,
        collaboratorRegistration: undefined,
        collaboratorCpf: undefined,
        collaboratorDepartment: undefined,
      }));
      return;
    }
    setManualTerm((prev) => ({
      ...prev,
      collaboratorId: collab.id,
      collaboratorName: collab.fullName,
      collaboratorRegistration: collab.registrationNumber,
      collaboratorCpf: collab.cpf,
      collaboratorDepartment: collab.department,
    }));
  };

  const handleSelectFile = async (file?: File | null) => {
    setManualError('');
    if (!file) return;

    if (file.size > MAX_PDF_BYTES) {
      setManualError(`O PDF tem ${formatFileSize(file.size)} e excede o limite de 10 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validationError = await validatePdfFile(file);
    if (validationError) {
      setManualError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setManualFile(file);
    setManualTerm((prev) => ({
      ...prev,
      code: prev.code?.trim() ? prev.code : suggestCodeFromFileName(file.name),
      fileName: file.name,
    }));
  };

  const handleRemoveFile = () => {
    setManualFile(null);
    setManualTerm((prev) => ({ ...prev, fileName: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openManualTermModal = () => {
    setManualTerm({
      type: 'Termo de Entrega',
      status: 'Assinado',
      date: todayISO(),
      accessoriesList: [],
      clauses: []
    });
    setManualFile(null);
    setManualError('');
    setIsSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsManualTermModalOpen(true);
  };

  const handleSaveTerm = async () => {
    setManualError('');
    if (!manualFile) {
      setManualError('Anexe o arquivo PDF do termo.');
      return;
    }
    if (!manualTerm.code || !manualTerm.code.trim() || !manualTerm.type || !manualTerm.date) {
      setManualError('Preencha Código, Tipo e Data de emissão.');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      const fileData = await readFileAsBase64(manualFile);
      const newTerm: DocumentTerm = {
        id: `term-manual-${Date.now()}`,
        code: manualTerm.code.trim(),
        type: manualTerm.type as TermType,
        title: manualTerm.title || `${manualTerm.type} - Documento já existente`,
        date: manualTerm.date!,
        deviceId: manualTerm.deviceId,
        deviceTag: manualTerm.deviceTag,
        deviceModel: manualTerm.deviceModel,
        deviceImei: manualTerm.deviceImei,
        phoneLineId: manualTerm.phoneLineId,
        phoneNumber: manualTerm.phoneNumber,
        collaboratorId: manualTerm.collaboratorId,
        collaboratorName: manualTerm.collaboratorName,
        collaboratorRegistration: manualTerm.collaboratorRegistration,
        collaboratorCpf: manualTerm.collaboratorCpf,
        collaboratorDepartment: manualTerm.collaboratorDepartment,
        status: (manualTerm.status as TermStatus) || 'Assinado',
        accessoriesList: manualTerm.accessoriesList || [],
        clauses: manualTerm.clauses && manualTerm.clauses.length > 0 ? manualTerm.clauses : [
          'Documento inserido no sistema para fins de arquivo e controle patrimonial.',
        ],
        signedAt: manualTerm.status === 'Assinado' ? manualTerm.date : undefined,
        notes: manualTerm.notes,
        fileName: manualFile.name,
      };

      const result = await dataService.createTermWithPdf(newTerm, fileData);
      if (!result.success) {
        setManualError(result.message);
        return;
      }
      refreshData();
      setIsManualTermModalOpen(false);
    } catch {
      setManualError('Não foi possível ler o arquivo PDF. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
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
        <div className="radius-lg border border-status-warning-border bg-status-warning-bg p-4 flex items-center justify-between gap-3 text-[11px] text-status-warning-fg shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-status-warning-fg shrink-0" />
            <div>
              <span className="font-semibold">Atenção ao compliance: </span>
              <span>Há <strong>{pendingCount} documento(s)</strong> pendente(s) de colheita de assinatura formal do colaborador.</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setStatusFilter('Pendente de Assinatura')}>
            Filtrar pendentes
          </Button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar termo por código, colaborador, tag do aparelho ou linha..."
              className="w-full pl-9 pr-3 py-2 text-xs radius-base border border-border-subtle bg-surface-card placeholder-text-muted text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Badge variant="success" size="sm" showDot className="text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span className="tabular-nums">{signedCount}</span>
              <span>assinados</span>
            </Badge>
            <Badge variant="warning" size="sm" showDot className="text-[11px]">
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{pendingCount}</span>
              <span>pendentes</span>
            </Badge>
            <Button variant="primary" size="sm" onClick={openManualTermModal} className="flex items-center gap-1.5 shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Anexar termo em PDF</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle text-xs">
          <span className="text-text-muted font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-text-muted" />
            Filtros:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <option value="todos">Status: Todos</option>
            <option value="Assinado">Assinado</option>
            <option value="Pendente de Assinatura">Pendente de Assinatura</option>
            <option value="Arquivado">Arquivado</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <option value="todos">Tipo de documento: Todos</option>
            <option value="Termo de Entrega">Termo de Entrega</option>
            <option value="Termo de Devolução">Termo de Devolução</option>
            <option value="Termo de Transferência">Termo de Transferência</option>
          </select>

          {(statusFilter !== 'todos' || typeFilter !== 'todos') && (
            <Button variant="ghost" size="sm" onClick={() => {
              setStatusFilter('todos');
              setTypeFilter('todos');
            }}>
              Limpar filtros
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredTerms.length}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{terms.length}</span>
            <span className="text-[11px]">documentos</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Código do termo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Colaborador titular</th>
                <th className="py-3 px-4">Ativo / linha</th>
                <th className="py-3 px-4">Data de emissão</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredTerms.map((term) => (
                <tr
                  key={term.id}
                  className="hover:bg-surface-subtle transition-colors group cursor-pointer"
                  onClick={() => onViewTerm(term)}
                >
                  <td className="py-3 px-4 font-code font-bold text-text-primary whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {term.code}
                      {term.hasFile && (
                        <Paperclip className="w-3.5 h-3.5 text-brand-blue-action" aria-label="PDF anexado" />
                      )}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-medium text-text-primary">
                    {term.type}
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-medium text-text-primary block">{term.collaboratorName || 'Não especificado'}</span>
                    {term.collaboratorRegistration && (
                      <span className="text-[11px] text-text-muted font-code">Mat.: {term.collaboratorRegistration}</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {term.deviceTag && (
                      <span className="font-code text-brand-blue-action font-semibold block">{term.deviceTag}</span>
                    )}
                    {term.phoneNumber && (
                      <span className="text-[11px] text-text-muted font-code">{term.phoneNumber}</span>
                    )}
                    {!term.deviceTag && !term.phoneNumber && (
                      <span className="text-text-muted italic font-body">Geral</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-code text-text-muted whitespace-nowrap">
                    {formatDate(term.date)}
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge status={term.status} type="term" />
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => onViewTerm(term)}
                        title="Visualizar termo"
                        aria-label={`Visualizar termo ${term.code}`}
                        className="inline-flex items-center justify-center p-2 radius-base text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors border border-transparent"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onPrintTerm(term)}
                        title="Imprimir termo"
                        aria-label={`Imprimir termo ${term.code}`}
                        className="inline-flex items-center justify-center p-2 radius-base text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors border border-transparent"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTerms.length === 0 && (
            <div className="p-10 text-center text-text-muted">
              <FileText className="w-10 h-10 text-border-strong mx-auto mb-2" />
              <p className="font-semibold text-text-primary">Nenhum termo encontrado</p>
              <p className="text-[11px] text-text-muted mt-1">Nenhum documento atende aos filtros atuais.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal para anexar um termo já existente em PDF */}
      <Modal
        isOpen={isManualTermModalOpen}
        onClose={() => setIsManualTermModalOpen(false)}
        title="Anexar termo já existente"
        subtitle="Envie o PDF original do termo já assinado ou arquivado"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {manualError && (
            <div className="p-3 radius-base border border-status-danger-border bg-status-danger-bg text-xs text-status-danger-fg">
              {manualError}
            </div>
          )}

          {/* Upload do PDF */}
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              Arquivo PDF do termo *
            </label>
            {!manualFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleSelectFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-8 radius-lg border-2 border-dashed cursor-pointer transition-colors text-center ${
                  isDragging
                    ? 'border-brand-blue-action bg-brand-blue-action/10'
                    : 'border-border-subtle bg-surface-subtle hover:border-brand-blue-action hover:bg-surface-card'
                }`}
              >
                <Upload className="w-7 h-7 text-brand-blue-action" />
                <div>
                  <p className="text-xs font-semibold text-text-primary">
                    Clique para selecionar ou arraste o PDF aqui
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Somente arquivos .pdf, até 10 MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 radius-lg border border-brand-blue-action/20 bg-brand-blue-action/10">
                <div className="w-9 h-9 radius-base bg-white border border-brand-blue-action flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-brand-blue-action" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-text-primary truncate">{manualFile.name}</p>
                  <p className="text-[10px] text-text-muted">{formatFileSize(manualFile.size)} · PDF</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 radius-base text-text-muted hover:text-status-danger-fg hover:bg-status-danger-bg transition-colors shrink-0"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Formulário de metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Código *
              </label>
              <input
                type="text"
                value={manualTerm.code || ''}
                onChange={(e) => setManualTerm({ ...manualTerm, code: e.target.value })}
                placeholder="Ex: TERMO-ENT-2026-001"
                className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Tipo *
              </label>
              <select
                value={manualTerm.type || 'Termo de Entrega'}
                onChange={(e) => setManualTerm({ ...manualTerm, type: e.target.value as TermType })}
                className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
              >
                <option value="Termo de Entrega">Termo de Entrega</option>
                <option value="Termo de Devolução">Termo de Devolução</option>
                <option value="Termo de Transferência">Termo de Transferência</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Status *
              </label>
              <select
                value={manualTerm.status || 'Assinado'}
                onChange={(e) => setManualTerm({ ...manualTerm, status: e.target.value as TermStatus })}
                className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
              >
                <option value="Assinado">Assinado</option>
                <option value="Pendente de Assinatura">Pendente de Assinatura</option>
                <option value="Arquivado">Arquivado</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                Data de emissão *
              </label>
              <input
                type="date"
                value={manualTerm.date || ''}
                onChange={(e) => setManualTerm({ ...manualTerm, date: e.target.value })}
                className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={manualTerm.title || ''}
              onChange={(e) => setManualTerm({ ...manualTerm, title: e.target.value })}
              placeholder="Ex: Termo de Entrega de Aparelho"
              className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="ghost" size="sm" onClick={() => setIsManualTermModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveTerm} disabled={isSaving}>
              {isSaving ? 'Salvando…' : 'Anexar Termo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

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
import {
  FileText,
  Search,
  Filter,
  Eye,
  Clock,
  Upload,
  Paperclip,
  X,
  Loader2
} from 'lucide-react';

interface TermsViewProps {
  onViewTerm: (term: DocumentTerm) => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onViewTerm }) => {
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
      deviceModel: `${device.brand} ${device.model}`.trim(),
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
        <div className="bg-sun-50 border border-sun-300 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-gold-700 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-gold-700 shrink-0" />
            <div>
              <span className="font-bold">Atenção ao compliance: </span>
              <span>Há <strong>{pendingCount} documento(s)</strong> pendente(s) de colheita de assinatura formal do colaborador.</span>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('Pendente de Assinatura')}
            className="px-3 py-1.5 bg-sun-400 hover:bg-sun-500 text-navy-900 rounded-lg font-semibold transition-colors shrink-0"
          >
            Filtrar pendentes
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar termo por código, colaborador, tag do aparelho ou linha..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold tabular-nums">
                {signedCount} assinados
              </span>
              <span className="px-2.5 py-1 bg-sun-50 border border-sun-300 text-gold-700 rounded-lg font-semibold tabular-nums">
                {pendingCount} pendentes
              </span>
            </div>
            <button
              onClick={openManualTermModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Anexar termo em PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-ink-400" />
            Filtros:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Assinado">Assinado</option>
            <option value="Pendente de Assinatura">Pendente de Assinatura</option>
            <option value="Arquivado">Arquivado</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Tipo de documento: Todos</option>
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
              className="text-xs text-iane-700 hover:text-iane-800 font-medium ml-2"
            >
              Limpar filtros
            </button>
          )}

          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">
            Exibindo <strong>{filteredTerms.length}</strong> de <strong>{terms.length}</strong> documentos
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-ink-100">
              {filteredTerms.map((term) => (
                <tr 
                  key={term.id} 
                  className="hover:bg-iane-50/60 transition-colors group cursor-pointer"
                  onClick={() => onViewTerm(term)}
                >
                  <td className="py-3 px-4 font-mono font-bold text-ink-900 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {term.code}
                      {term.hasFile && (
                        <Paperclip className="w-3.5 h-3.5 text-iane-600" aria-label="PDF anexado" />
                      )}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-medium text-ink-800">
                    {term.type}
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-ink-900 block">{term.collaboratorName || 'Não especificado'}</span>
                    {term.collaboratorRegistration && (
                      <span className="text-[11px] text-ink-500 font-mono">Mat.: {term.collaboratorRegistration}</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {term.deviceTag && (
                      <span className="font-mono text-iane-700 font-semibold block">{term.deviceTag}</span>
                    )}
                    {term.phoneNumber && (
                      <span className="text-[11px] text-ink-600 font-mono">{term.phoneNumber}</span>
                    )}
                    {!term.deviceTag && !term.phoneNumber && (
                      <span className="text-ink-400 italic">Geral</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-ink-600 whitespace-nowrap">
                    {formatDate(term.date)}
                  </td>

                  <td className="py-3 px-4">
                    <StatusBadge status={term.status} type="term" />
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onViewTerm(term)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-iane-50 hover:bg-iane-100 text-iane-700 rounded-lg text-xs font-semibold transition-colors border border-iane-200"
                    >
                      <Eye className="w-3.5 h-3.5 text-iane-600" />
                      <span>{term.hasFile ? 'Abrir PDF' : 'Visualizar & imprimir'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTerms.length === 0 && (
            <div className="p-10 text-center text-ink-500">
              <FileText className="w-10 h-10 text-ink-300 mx-auto mb-2" />
              <p className="font-semibold text-ink-700">Nenhum termo encontrado</p>
              <p className="text-xs text-ink-500 mt-1">Nenhum documento atende aos filtros atuais.</p>
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
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {manualError}
            </div>
          )}

          {/* Upload do PDF */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">
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
                className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
                  isDragging
                    ? 'border-iane-500 bg-iane-50'
                    : 'border-ink-300 bg-ink-50/60 hover:border-iane-400 hover:bg-iane-50/50'
                }`}
              >
                <Upload className="w-7 h-7 text-iane-600" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">
                    Clique para selecionar ou arraste o PDF aqui
                  </p>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Somente arquivos .pdf, até 10 MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-iane-50/60 border border-iane-200 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-white border border-iane-200 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-iane-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-900 truncate">{manualFile.name}</p>
                  <p className="text-[11px] text-ink-500">{formatFileSize(manualFile.size)} · PDF</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 rounded-lg text-ink-500 hover:text-rose-700 hover:bg-rose-50 transition-colors shrink-0"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => void handleSelectFile(e.target.files?.[0])}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Código do termo *</label>
              <input
                type="text"
                value={manualTerm.code || ''}
                onChange={(e) => setManualTerm({ ...manualTerm, code: e.target.value })}
                className="w-full text-xs rounded-lg border border-ink-300 px-2.5 py-2"
                placeholder="TERMO-ENT-2024-001"
              />
              <p className="text-[10px] text-ink-500 mt-1">
                Preenchido pelo nome do arquivo. Ajuste se necessário.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Tipo *</label>
              <select
                value={manualTerm.type || 'Termo de Entrega'}
                onChange={(e) => setManualTerm({ ...manualTerm, type: e.target.value as TermType })}
                className="w-full text-xs rounded-lg border border-ink-300 px-2.5 py-2"
              >
                <option value="Termo de Entrega">Termo de Entrega</option>
                <option value="Termo de Devolução">Termo de Devolução</option>
                <option value="Termo de Transferência">Termo de Transferência</option>
                <option value="Termo de Manutenção">Termo de Manutenção</option>
                <option value="Laudo de Baixa">Laudo de Baixa</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Data de emissão *</label>
              <input
                type="date"
                value={manualTerm.date || ''}
                onChange={(e) => setManualTerm({ ...manualTerm, date: e.target.value })}
                className="w-full text-xs rounded-lg border border-ink-300 px-2.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Situação</label>
              <select
                value={manualTerm.status || 'Assinado'}
                onChange={(e) => setManualTerm({ ...manualTerm, status: e.target.value as TermStatus })}
                className="w-full text-xs rounded-lg border border-ink-300 px-2.5 py-2"
              >
                <option value="Assinado">Assinado</option>
                <option value="Pendente de Assinatura">Pendente de Assinatura</option>
                <option value="Arquivado">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-ink-50 border border-ink-200 rounded-xl space-y-2">
            <p className="text-[11px] font-semibold text-ink-700">
              Vincular a registros já cadastrados (opcional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">Aparelho cadastrado</label>
                <select
                  value={manualTerm.deviceId || ''}
                  onChange={(e) => handleSelectDevice(e.target.value)}
                  className="w-full text-xs rounded-lg border border-ink-300 px-2 py-1.5 bg-white"
                >
                  <option value="">-- Nenhum / não cadastrado --</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.assetTag} · {d.brand} {d.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">Colaborador cadastrado</label>
                <select
                  value={manualTerm.collaboratorId || ''}
                  onChange={(e) => handleSelectCollaborator(e.target.value)}
                  className="w-full text-xs rounded-lg border border-ink-300 px-2 py-1.5 bg-white"
                >
                  <option value="">-- Nenhum / não cadastrado --</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} · Mat. {c.registrationNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">Colaborador (texto)</label>
                <input
                  type="text"
                  value={manualTerm.collaboratorName || ''}
                  onChange={(e) => setManualTerm({ ...manualTerm, collaboratorName: e.target.value })}
                  className="w-full text-xs rounded-lg border border-ink-300 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">TAG do aparelho</label>
                <input
                  type="text"
                  value={manualTerm.deviceTag || ''}
                  onChange={(e) => setManualTerm({ ...manualTerm, deviceTag: e.target.value })}
                  className="w-full text-xs rounded-lg border border-ink-300 px-2 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">Linha telefônica</label>
                <input
                  type="text"
                  value={manualTerm.phoneNumber || ''}
                  onChange={(e) => setManualTerm({ ...manualTerm, phoneNumber: e.target.value })}
                  className="w-full text-xs rounded-lg border border-ink-300 px-2 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Observações</label>
            <textarea
              rows={2}
              value={manualTerm.notes || ''}
              onChange={(e) => setManualTerm({ ...manualTerm, notes: e.target.value })}
              className="w-full text-xs rounded-lg border border-ink-300 px-2.5 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsManualTermModalOpen(false)}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-ink-300 hover:bg-ink-50 text-ink-700 rounded-lg disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveTerm()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-iane-600 hover:bg-iane-700 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando PDF...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Salvar termo
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Device, PhoneLine, Collaborator, DeviceCondition, DocumentTerm, RequestRecord, TermType, CatalogItem } from '../../types';
import { dataService } from '../../services/dataStorage';
import { todayISO } from '../../utils/dates';
import {
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Package,
  User,
  ArrowRight,
  RotateCcw,
  Smartphone,
  Info,
  X,
  Search,
  FileText,
} from 'lucide-react';
import { SearchableMultiSelect, SearchableOption, SearchableSelect } from '../SearchableSelect';
import { formatPhone } from '../../utils/formatters';
import { MAX_PDF_BYTES, formatFileSize, readFileAsBase64, validatePdfFile } from '../../utils/pdfUpload';

export type OfficialFlowType = 
  | 'entrega' 
  | 'devolucao' 
  | 'transferencia' 
  | 'troca';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDeviceId?: string;
  preselectedCollaboratorId?: string;
  defaultFlow?: OfficialFlowType;
  approvalRequest?: RequestRecord | null;
}

const FLOW_LABELS: Record<OfficialFlowType, string> = {
  entrega: 'Entrega',
  devolucao: 'Devolução',
  transferencia: 'Transferência',
  troca: 'Troca de Aparelho',
};

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedDeviceId,
  preselectedCollaboratorId,
  defaultFlow = 'entrega',
  approvalRequest,
}) => {
  const [activeFlow, setActiveFlow] = useState<OfficialFlowType>(defaultFlow);
  const [date, setDate] = useState<string>(todayISO());
  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isApprovalSubmitting, setIsApprovalSubmitting] = useState(false);
  const [isAttachingPdf, setIsAttachingPdf] = useState(false);

  // Lists
  const [devices, setDevices] = useState<Device[]>([]);
  const [lines, setLines] = useState<PhoneLine[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [catalogAccessories, setCatalogAccessories] = useState<CatalogItem[]>(() => dataService.getCatalogs().accessories);
  const [lineStatusCatalog, setLineStatusCatalog] = useState<CatalogItem[]>(() => dataService.getCatalogs().lineStatuses);
  const [deviceStatusCatalog, setDeviceStatusCatalog] = useState<CatalogItem[]>(() => dataService.getCatalogs().deviceStatuses);
  const defaultAccessories = (count: number) => catalogAccessories.slice(0, count).map((item) => item.name);

  // --- State for ENTREGA (Estoque -> Colaborador) ---
  const [entregaDeviceId, setEntregaDeviceId] = useState('');
  const [entregaCollabId, setEntregaCollabId] = useState('');
  const [entregaLineId, setEntregaLineId] = useState('');
  const [entregaCondition, setEntregaCondition] = useState<DeviceCondition>('Novo');
  const [entregaAccessories, setEntregaAccessories] = useState<string[]>(() => defaultAccessories(3));
  const [entregaReason, setEntregaReason] = useState('');

  // --- State for DEVOLUÇÃO (Colaborador -> Estoque) ---
  const [devolucaoDeviceId, setDevolucaoDeviceId] = useState('');
  const [devolucaoCollabId, setDevolucaoCollabId] = useState('');
  const [devolucaoCondition, setDevolucaoCondition] = useState<DeviceCondition>('Excelente');
  const [devolucaoDestinoEstoque, setDevolucaoDestinoEstoque] = useState<string>(() => dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível'));
  const [devolucaoLineHandling, setDevolucaoLineHandling] = useState<'retornar_ao_estoque' | 'manter_com_colaborador' | 'desassociar_e_suspender'>('retornar_ao_estoque');
  const [devolucaoAccessories, setDevolucaoAccessories] = useState<string[]>(() => defaultAccessories(3));
  const [devolucaoReason, setDevolucaoReason] = useState('Devolução de aparelho para o Estoque.');

  // --- State for TRANSFERÊNCIA (Colaborador A -> Estoque -> Colaborador B) ---
  const [transfCollabAId, setTransfCollabAId] = useState('');
  const [transfDeviceId, setTransfDeviceId] = useState('');
  const [transfCollabBId, setTransfCollabBId] = useState('');
  const [transfCondition, setTransfCondition] = useState<DeviceCondition>('Excelente');
  const [transfDestinoEstoque, setTransfDestinoEstoque] = useState<string>(() => dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível'));
  const [transfLineHandling, setTransfLineHandling] = useState<'transferir_linha_junto' | 'manter_linha_com_origem' | 'retornar_linha_ao_estoque'>('transferir_linha_junto');
  const [transfAccessories, setTransfAccessories] = useState<string[]>(() => defaultAccessories(2));
  const [transfReason, setTransfReason] = useState('Readequação de equipe e transferência patrimonial.');

  // --- State for TROCA (Colaborador A [Antigo] -> Estoque | Estoque [Novo] -> Colaborador A) ---
  const [trocaCollabId, setTrocaCollabId] = useState('');
  const [trocaOldDeviceId, setTrocaOldDeviceId] = useState('');
  const [trocaOldCondition, setTrocaOldCondition] = useState<DeviceCondition>('Bom');
  const [trocaOldDestinoEstoque, setTrocaOldDestinoEstoque] = useState<string>(() => dataService.getCatalogStatus('deviceStatuses', 'device-status-awaiting-evaluation', 'Aguardando avaliação'));
  const [trocaOldAccessories, setTrocaOldAccessories] = useState<string[]>(() => defaultAccessories(2));
  const [trocaNewDeviceId, setTrocaNewDeviceId] = useState('');
  const [trocaNewCondition, setTrocaNewCondition] = useState<DeviceCondition>('Novo');
  const [trocaNewAccessories, setTrocaNewAccessories] = useState<string[]>(() => defaultAccessories(3));
  const [trocaLineOption, setTrocaLineOption] = useState<'manter_linha_atual_no_novo' | 'sem_linha' | 'selecionar_outra_linha'>('manter_linha_atual_no_novo');
  const [trocaCustomLineId, setTrocaCustomLineId] = useState('');
  const [trocaReason, setTrocaReason] = useState('Atualização de modelo e substituição periódica.');

  const [observations, setObservations] = useState('');

  // Documento do termo: apenas vincular a um termo já existente (PDF já anexado)
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
  const [availableTerms, setAvailableTerms] = useState<DocumentTerm[]>([]);
  const [isTermPickerOpen, setIsTermPickerOpen] = useState(false);
  const [termSearch, setTermSearch] = useState('');
  const [termDraftIds, setTermDraftIds] = useState<string[]>([]);
  const [termPdfFile, setTermPdfFile] = useState<File | null>(null);
  const [termPdfError, setTermPdfError] = useState('');

  // Initial load
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const devList = dataService.getDevices();
      const lineList = dataService.getLines();
      const collabList = dataService.getCollaborators();
      setDevices(devList);
      setLines(lineList);
      setCollaborators(collabList);
      setAvailableTerms(dataService.getTerms());
      void Promise.all([
        dataService.fetchDevices(),
        dataService.fetchLines(),
        dataService.fetchCollaborators(),
        dataService.fetchTerms(),
      ]).then(([freshDevices, freshLines, freshCollaborators, freshTerms]) => {
        if (!active) return;
        setDevices(freshDevices);
        setLines(freshLines);
        setCollaborators(freshCollaborators);
        setAvailableTerms(freshTerms);
      });
      void dataService.fetchCatalogs().then((catalogs) => {
        const names = catalogs.accessories.map((item) => item.name);
        setCatalogAccessories(catalogs.accessories);
        setLineStatusCatalog(catalogs.lineStatuses);
        setDeviceStatusCatalog(catalogs.deviceStatuses);
        setEntregaAccessories((current) => current.filter((item) => names.includes(item)));
        setDevolucaoAccessories((current) => current.filter((item) => names.includes(item)));
        setTransfAccessories((current) => current.filter((item) => names.includes(item)));
        setTrocaOldAccessories((current) => current.filter((item) => names.includes(item)));
        setTrocaNewAccessories((current) => current.filter((item) => names.includes(item)));
      });
       setSelectedTermIds([]);
       setIsTermPickerOpen(false);
       setTermSearch('');
      setErrorMessage('');
      setShowSummary(false);
      setActiveFlow(defaultFlow);
      setDate(
        approvalRequest?.type === 'Entrega' && approvalRequest.data?.deliveryDate
          ? String(approvalRequest.data.deliveryDate)
          : todayISO()
      );

      // O modal carrega exclusivamente o fluxo escolhido no dropdown de movimentação.
      const selectedDevice = preselectedDeviceId
        ? devList.find(d => d.id === preselectedDeviceId)
        : undefined;
       if (defaultFlow === 'entrega') {
         const dev = selectedDevice?.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível') ? selectedDevice : undefined;
         if (dev) setEntregaDeviceId(dev.id);
       } else if (defaultFlow === 'devolucao') {
         const dev = selectedDevice?.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-in-use', 'Em uso') ? selectedDevice : undefined;
        if (dev) {
          setDevolucaoDeviceId(dev.id);
          if (dev.currentCollaboratorId) setDevolucaoCollabId(dev.currentCollaboratorId);
        }
       } else if (defaultFlow === 'transferencia') {
         const dev = selectedDevice?.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-in-use', 'Em uso') ? selectedDevice : undefined;
        if (dev) {
          setTransfDeviceId(dev.id);
          if (dev.currentCollaboratorId) setTransfCollabAId(dev.currentCollaboratorId);
        }
       } else if (defaultFlow === 'troca') {
         const dev = selectedDevice?.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-in-use', 'Em uso') ? selectedDevice : undefined;
        if (dev) {
          setTrocaOldDeviceId(dev.id);
          if (dev.currentCollaboratorId) setTrocaCollabId(dev.currentCollaboratorId);
        }
       }

      if (preselectedCollaboratorId) {
          setEntregaCollabId(preselectedCollaboratorId);
          setTransfCollabBId(preselectedCollaboratorId);
      }

      if (approvalRequest) {
        const requestData = approvalRequest.data || {};
        if (approvalRequest.type === 'Entrega') {
          setEntregaLineId(requestData.isNewLine === 'Não' ? requestData.lineId || '' : '');
        } else if (approvalRequest.type === 'Devolução') {
          setDevolucaoCollabId(requestData.collaboratorId || '');
          const requestedDeviceId = requestData.devices?.[0]?.id;
          const requestedDevice = devList.find((device) => device.id === requestedDeviceId && device.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-in-use', 'Em uso'));
          setDevolucaoDeviceId(requestedDevice?.id || '');
        } else if (approvalRequest.type === 'Transferência') {
          setTransfCollabAId(requestData.originCollaboratorId || '');
          setTransfDeviceId(requestData.deviceId || '');
          setTransfCollabBId(requestData.destinationCollaboratorId || '');
          setTransfCondition(requestData.condition || 'Excelente');
          setTransfDestinoEstoque(requestData.destinationStatusAfterReturn || 'Disponível');
          setTransfLineHandling(requestData.lineHandling || 'transferir_linha_junto');
          setTransfAccessories(requestData.accessories || ['Carregador Original', 'Cabo USB-C / Lightning']);
          setTransfReason(requestData.reason || 'Readequação de equipe e transferência patrimonial.');
          setObservations(requestData.observations || '');
        } else {
          setTrocaCollabId(requestData.collaboratorId || '');
          setTrocaOldDeviceId(requestData.oldDeviceId || '');
          setTrocaOldCondition(requestData.oldCondition || 'Bom');
          setTrocaOldDestinoEstoque(requestData.oldDestinationStatus || 'Aguardando avaliação');
          setTrocaOldAccessories(requestData.oldAccessories || ['Carregador Original', 'Cabo USB-C / Lightning']);
          setTrocaNewDeviceId(requestData.newDeviceId || '');
          setTrocaNewCondition(requestData.newCondition || 'Novo');
          setTrocaNewAccessories(requestData.newAccessories || ['Carregador Original', 'Cabo USB-C / Lightning', 'Capa Protetora Anti-Impacto']);
          setTrocaLineOption(requestData.lineOption || 'manter_linha_atual_no_novo');
          setTrocaCustomLineId(requestData.customLineId || '');
          setTrocaReason(requestData.reason || 'Atualização de modelo e substituição periódica.');
          setObservations(requestData.observations || '');
        }
      }
    return () => { active = false; };
  }, [isOpen, preselectedDeviceId, preselectedCollaboratorId, defaultFlow, approvalRequest]);

  // Helpers
  const availableDeviceStatus = deviceStatusCatalog.find((item) => item.id === 'device-status-available')?.name || 'Disponível';
  const inUseDeviceStatus = deviceStatusCatalog.find((item) => item.id === 'device-status-in-use')?.name || 'Em uso';
  const availableLineStatus = lineStatusCatalog.find((item) => item.id === 'line-status-available')?.name || 'Disponível';
  const availableStockDevices = devices.filter(d => d.status === availableDeviceStatus);
  const inUseDevices = devices.filter(d => d.status === inUseDeviceStatus);
  const deviceStatusOptions = (ids: string[], current: string) => {
    const options = deviceStatusCatalog.filter((item) => ids.includes(item.id));
    if (current && !options.some((item) => item.name === current)) options.push({ id: `legacy-${current}`, name: current });
    return options;
  };
  const returnFlowDevices = approvalRequest?.type === 'Devolução'
      ? inUseDevices.filter((device) => device.currentCollaboratorId === approvalRequest.data.collaboratorId)
    : inUseDevices;

  // Handle Devolução Device Change
  const handleDevolucaoDeviceChange = (devId: string) => {
    setDevolucaoDeviceId(devId);
    const dev = devices.find(d => d.id === devId);
    if (dev?.currentCollaboratorId) {
      setDevolucaoCollabId(dev.currentCollaboratorId);
    }
  };

  // Handle Transferência Colaborador A Change
  const handleTransfCollabAChange = (collabId: string) => {
    setTransfCollabAId(collabId);
    const dev = devices.find(d => d.currentCollaboratorId === collabId && d.status === inUseDeviceStatus);
    if (dev) {
      setTransfDeviceId(dev.id);
    } else {
      setTransfDeviceId('');
    }
  };

  // Handle Troca Colaborador Change
  const handleTrocaCollabChange = (collabId: string) => {
    setTrocaCollabId(collabId);
    const dev = devices.find(d => d.currentCollaboratorId === collabId && d.status === inUseDeviceStatus);
    if (dev) {
      setTrocaOldDeviceId(dev.id);
    } else {
      setTrocaOldDeviceId('');
    }
  };

  const deviceOptions = (items: Device[]): SearchableOption[] => items.map((device) => ({
    value: device.id,
    label: `${device.assetTag} · ${device.model} · ${device.brand}${device.imei1 ? ` · IMEI ${device.imei1}` : ' · Sem IMEI'}`,
  }));
  const lineOptions = (items: PhoneLine[]): SearchableOption[] => items.map((line) => ({
    value: line.id,
    label: `${formatPhone(line.phoneNumber)} · ${line.carrier || 'Sem operadora'}`,
    phoneSearch: line.phoneNumber,
  }));
  const collaboratorOptions = (items: Collaborator[]): SearchableOption[] => items.map((collaborator) => ({
    value: collaborator.id,
    label: `${collaborator.fullName} · ${collaborator.registrationNumber || 'Sem matrícula'} · ${collaborator.department || 'Sem departamento'}`,
  }));
  const accessoryOptions = catalogAccessories.map((item) => ({ value: item.name, label: item.name }));
  const handleTermPdfSelect = async (file?: File) => {
    setTermPdfError('');
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setTermPdfError(`O PDF tem ${formatFileSize(file.size)} e excede o limite de 10 MB.`);
      return;
    }
    const validationError = await validatePdfFile(file);
    if (validationError) {
      setTermPdfError(validationError);
      return;
    }
    setTermPdfFile(file);
  };

  // Validation before opening summary
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (termPdfError) return setErrorMessage(termPdfError);

    if (activeFlow === 'entrega') {
      if (!entregaDeviceId) return setErrorMessage('Selecione um aparelho disponível no estoque.');
      const dev = devices.find(d => d.id === entregaDeviceId);
      if (dev?.status !== 'Disponível') {
        return setErrorMessage('O aparelho selecionado não consta como "Disponível" no estoque.');
      }
    } else if (activeFlow === 'devolucao') {
      if (!devolucaoDeviceId) return setErrorMessage('Selecione o aparelho em uso que está sendo devolvido.');
    } else if (activeFlow === 'transferencia') {
      if (!transfDeviceId) return setErrorMessage('Selecione um aparelho em uso.');
      if (transfCollabAId && transfCollabBId && transfCollabAId === transfCollabBId) return setErrorMessage('O colaborador de origem e destino devem ser diferentes.');
    } else if (activeFlow === 'troca') {
      if (!trocaOldDeviceId) return setErrorMessage('Selecione o aparelho antigo.');
      if (!trocaNewDeviceId) return setErrorMessage('Selecione o novo aparelho disponível no estoque.');
      if (trocaOldDeviceId === trocaNewDeviceId) return setErrorMessage('O novo aparelho deve ser diferente do aparelho antigo.');
    }

    setShowSummary(true);
  };

  // Final Commit
  const handleConfirmOperation = async () => {
    setErrorMessage('');
    if (approvalRequest && isApprovalSubmitting) return;
    let params: Record<string, any>;
    if (activeFlow === 'entrega') {
      params = {
        deviceId: entregaDeviceId,
        collaboratorId: entregaCollabId,
        lineId: entregaLineId || undefined,
        date,
        condition: entregaCondition,
        accessories: entregaAccessories,
        reason: entregaReason,
        observations,
        existingTermId: selectedTermIds[0],
      };
    } else if (activeFlow === 'devolucao') {
      params = {
        deviceId: devolucaoDeviceId,
        collaboratorId: devolucaoCollabId,
        date,
        condition: devolucaoCondition,
        nextDeviceStatus: devolucaoDestinoEstoque,
        lineHandling: devolucaoLineHandling,
        accessoriesReturned: devolucaoAccessories,
        reason: devolucaoReason,
        observations,
        existingTermId: selectedTermIds[0],
      };
    } else if (activeFlow === 'transferencia') {
      params = {
        deviceId: transfDeviceId,
        originCollaboratorId: transfCollabAId,
        destinationCollaboratorId: transfCollabBId,
        date,
        condition: transfCondition,
        destinationStatusAfterReturn: transfDestinoEstoque,
        lineHandling: transfLineHandling,
        accessories: transfAccessories,
        reason: transfReason,
        observations,
        existingTermId: selectedTermIds[0],
      };
    } else {
      params = {
        collaboratorId: trocaCollabId,
        oldDeviceId: trocaOldDeviceId,
        oldDeviceCondition: trocaOldCondition,
        oldDeviceNextStatus: trocaOldDestinoEstoque,
        oldDeviceAccessories: trocaOldAccessories,
        newDeviceId: trocaNewDeviceId,
        newDeviceCondition: trocaNewCondition,
        newDeviceAccessories: trocaNewAccessories,
        lineOption: trocaLineOption,
        customLineId: trocaCustomLineId || undefined,
        date,
        reason: trocaReason,
        observations,
        existingTermId: selectedTermIds[0],
      };
    }

    let completedMovementId: string | undefined;
    let completedBatchId: string | undefined;
    if (approvalRequest) {
      if (approvalRequest.type === 'Entrega') {
        const requestedCpf = String(approvalRequest.data?.cpf || '').replace(/\D/g, '');
        const selectedCpf = String(collaborators.find((collaborator) => collaborator.id === entregaCollabId)?.cpf || '').replace(/\D/g, '');
        if (!requestedCpf || requestedCpf !== selectedCpf) {
          return setErrorMessage('Selecione o colaborador cadastrado com o mesmo CPF informado na solicitação.');
        }
      }
      setIsApprovalSubmitting(true);
      let result;
      try {
        result = await dataService.approveRequestWithMovement(approvalRequest.id, approvalRequest.type, params);
      } finally {
        setIsApprovalSubmitting(false);
      }
      if (!result.success) return setErrorMessage(result.message);
      completedMovementId = result.movements?.find((movement) => movement.type.includes('Entrega'))?.id || result.movements?.[0]?.id;
      completedBatchId = result.movements?.[0]?.batchOperationId;
    } else if (activeFlow === 'entrega') {
      const result = dataService.executeDelivery({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
      completedMovementId = result.movement?.id;
      completedBatchId = result.movement?.batchOperationId;
    } else if (activeFlow === 'devolucao') {
      const result = dataService.executeReturn({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
      completedMovementId = result.movement?.id;
      completedBatchId = result.movement?.batchOperationId;
    } else if (activeFlow === 'transferencia') {
      const result = dataService.executeTransfer({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
      completedBatchId = result.batchOperationId;
    } else {
      const result = dataService.executeSwap({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
      completedBatchId = result.batchOperationId;
    }

    if (selectedTermIds.length) {
      const linked = dataService.linkTermsToMovement(completedMovementId, completedBatchId, selectedTermIds);
      if (!linked.success) return setErrorMessage(linked.message);
    }

    if (termPdfFile) {
      const movements = dataService.getMovements();
      const movement = (completedMovementId ? movements.find((item) => item.id === completedMovementId) : undefined) ||
        (completedBatchId ? movements.find((item) => item.batchOperationId === completedBatchId && item.type.includes('Entrega')) : undefined) ||
        (completedBatchId ? movements.find((item) => item.batchOperationId === completedBatchId) : undefined);
      if (!movement) {
        window.alert('Movimentação registrada, mas não foi possível localizar o registro para vincular o PDF.');
      } else {
        setIsAttachingPdf(true);
        try {
          const device = movement.deviceId ? dataService.getDeviceById(movement.deviceId) : undefined;
          const collaboratorId = movement.destinationCollaboratorId || movement.originCollaboratorId;
          const collaborator = collaboratorId ? dataService.getCollaboratorById(collaboratorId) : undefined;
          const line = movement.phoneLineId ? lines.find((item) => item.id === movement.phoneLineId) : undefined;
          const termType: TermType = activeFlow === 'entrega'
            ? 'Termo de Entrega'
            : activeFlow === 'devolucao'
            ? 'Termo de Devolução'
            : activeFlow === 'transferencia'
            ? 'Termo de Transferência'
            : 'Outro';
          const termId = `term-movement-pdf-${movement.id}`;
          const term: DocumentTerm = {
            id: termId,
            code: `${movement.code}-PDF`,
            type: termType,
            title: `${termType} · ${termPdfFile.name}`,
            date: movement.date,
            movementId: movement.id,
            batchOperationId: movement.batchOperationId,
            deviceId: movement.deviceId,
            deviceTag: movement.deviceTag,
            deviceModel: movement.deviceName,
            deviceImei: movement.imei,
            phoneLineId: movement.phoneLineId,
            phoneNumber: movement.phoneNumber || line?.phoneNumber,
            collaboratorId,
            collaboratorName: collaborator?.fullName || movement.destinationCollaboratorName || movement.originCollaboratorName,
            collaboratorRegistration: collaborator?.registrationNumber,
            collaboratorCpf: collaborator?.cpf,
            collaboratorDepartment: collaborator?.department,
            status: 'Pendente de Assinatura',
            accessoriesList: movement.accessoriesIncluded || [],
            clauses: [],
            notes: 'PDF anexado diretamente à movimentação.',
            fileName: termPdfFile.name,
          };
          const fileData = await readFileAsBase64(termPdfFile);
          const uploaded = await dataService.createTermWithPdf(term, fileData);
          if (!uploaded.success) {
            window.alert(`Movimentação registrada, mas o PDF não foi anexado: ${uploaded.message}`);
          } else {
            const linked = dataService.linkTermsToMovement(movement.id, movement.batchOperationId, [...selectedTermIds, termId]);
            if (!linked.success) window.alert(`PDF anexado, mas não foi possível atualizar o vínculo: ${linked.message}`);
          }
        } catch {
          window.alert('Movimentação registrada, mas não foi possível enviar o PDF. O termo pode ser anexado depois em Termos e documentos.');
        } finally {
          setIsAttachingPdf(false);
        }
      }
    }

    onSuccess();
    onClose();
  };

  // Selected entities for display
  const selEntregaDev = devices.find(d => d.id === entregaDeviceId);
  const selEntregaCollab = collaborators.find(c => c.id === entregaCollabId);

  const selDevolucaoDev = devices.find(d => d.id === devolucaoDeviceId);
  const selDevolucaoCollab = collaborators.find(c => c.id === devolucaoCollabId);

  const selTransfCollabA = collaborators.find(c => c.id === transfCollabAId);
  const selTransfCollabB = collaborators.find(c => c.id === transfCollabBId);
  const selTransfDev = devices.find(d => d.id === transfDeviceId);

  const selTrocaCollab = collaborators.find(c => c.id === trocaCollabId);
  const selTrocaOldDev = devices.find(d => d.id === trocaOldDeviceId);
  const selTrocaNewDev = devices.find(d => d.id === trocaNewDeviceId);
  const selectedTerms = availableTerms.filter((term) => selectedTermIds.includes(term.id));

    return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      disableEscapeClose={isTermPickerOpen}
      title="Movimentação de Aparelhos"
      subtitle={FLOW_LABELS[activeFlow]}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {approvalRequest && (
          <div className="rounded-lg border border-warn-bd bg-warn-bg/70 p-3 text-xs text-warn-fg">
            <strong className="block text-text">Aprovação da solicitação · {approvalRequest.requesterName}</strong>
            {approvalRequest.type === 'Entrega' ? (
              <span>Funcionário informado: {approvalRequest.data.employeeName} · CPF {approvalRequest.data.cpf} · Cargo {approvalRequest.data.position}. Associe um colaborador cadastrado para executar a entrega.</span>
            ) : approvalRequest.type === 'Devolução' ? (
              <span>Colaborador: {approvalRequest.data.collaboratorName}. Selecione um aparelho vinculado, se houver; a ausência de linha não impede a devolução.</span>
            ) : (
              <span>Confira os dados informados e complete os campos operacionais antes de confirmar.</span>
            )}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-danger-bg border border-danger-bd rounded-lg text-xs text-danger-fg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-fg shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. DIAGRAMA VISUAL DO FLUXO OPERACIONAL */}
        <div className="p-3 bg-info-bg/60 border border-info-bd rounded-xl flex items-center justify-center gap-3 text-xs text-accent">
          {activeFlow === 'entrega' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-accent" />
                Estoque (Disponível)
              </span>
              <ArrowRight className="w-4 h-4 text-iane-500" />
              <span className="px-2.5 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-accent" />
                Colaborador Destinatário
              </span>
            </div>
          )}

          {activeFlow === 'devolucao' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-accent" />
                Colaborador Atual
              </span>
              <ArrowRight className="w-4 h-4 text-iane-500" />
              <span className="px-2.5 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-accent" />
                Estoque
              </span>
            </div>
          )}

          {activeFlow === 'transferencia' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-semibold">
                1. Colaborador A
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-accent text-on-accent rounded-md shadow-xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-white" />
                2. Estoque (Conferência)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-semibold">
                3. Colaborador B
              </span>
            </div>
          )}

          {activeFlow === 'troca' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-semibold">
                Aparelho Antigo
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-accent text-on-accent rounded-md shadow-xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-white" />
                Estoque
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-surface border border-info-bd rounded-md shadow-2xs font-semibold">
                Aparelho Novo
              </span>
            </div>
          )}
        </div>

        {/* 2. FORMULÁRIOS POR FLUXO */}
        {!showSummary && (
          <form onSubmit={handleReview} className="space-y-4">
            {/* --- ENTREGA --- */}
            {activeFlow === 'entrega' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-accent" />
                  Seleção do Aparelho (Estoque)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Aparelho</label>
                    <SearchableSelect value={entregaDeviceId} onChange={setEntregaDeviceId} options={deviceOptions(availableStockDevices)} placeholder="Selecione o aparelho" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Linha Telefônica (opcional)</label>
                    <SearchableSelect value={entregaLineId} onChange={setEntregaLineId} options={lineOptions(lines.filter((line) => line.status === availableLineStatus))} placeholder="Selecione a linha" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Condição na entrega</label>
                    <select
                      value={entregaCondition}
                      onChange={(e) => setEntregaCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                    >
                      <option value="Novo">Novo</option>
                      <option value="Excelente">Excelente</option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Danificado">Danificado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Data da movimentação *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <User className="w-4 h-4 text-accent" />
                  Colaborador Destinatário
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Colaborador</label>
                    <SearchableSelect value={entregaCollabId} onChange={setEntregaCollabId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Motivo da entrega</label>
                    <input
                      type="text"
                      value={entregaReason}
                      onChange={(e) => setEntregaReason(e.target.value)}
                      className="w-full text-xs rounded-lg border border-line-strong px-3 py-2 text-text"
                    />
                  </div>
                </div>

                {/* Acessórios */}
                <div className="p-3 bg-subtle border border-line rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-text">Acessórios incluídos na entrega</span>
                  <SearchableMultiSelect values={entregaAccessories} onChange={setEntregaAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>
              </div>
            )}

            {/* --- DEVOLUÇÃO --- */}
            {activeFlow === 'devolucao' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-accent" />
                  Aparelho em Uso (será devolvido)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Aparelho</label>
                    <SearchableSelect value={devolucaoDeviceId} onChange={handleDevolucaoDeviceChange} options={deviceOptions(returnFlowDevices)} placeholder="Selecione o aparelho" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Colaborador Responsável</label>
                    <SearchableSelect value={devolucaoCollabId} onChange={setDevolucaoCollabId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Condição na devolução</label>
                    <select
                      value={devolucaoCondition}
                      onChange={(e) => setDevolucaoCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                    >
                      <option value="Excelente">Excelente</option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Danificado">Danificado</option>
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-accent" />
                  Destino no Estoque
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Status após devolução</label>
                    <select value={devolucaoDestinoEstoque} onChange={(e) => setDevolucaoDestinoEstoque(e.target.value)} className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text">
                      {deviceStatusOptions(['device-status-available', 'device-status-awaiting-evaluation', 'device-status-maintenance', 'device-status-reserved', 'device-status-awaiting-disposal'], devolucaoDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Destino da Linha Telefônica</label>
                    <select
                      value={devolucaoLineHandling}
                      onChange={(e) => setDevolucaoLineHandling(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                    >
                      <option value="retornar_ao_estoque">Retornar ao estoque de linhas (Disponível)</option>
                      <option value="manter_com_colaborador">Manter com o colaborador (BYOD / aguardando novo aparelho)</option>
                      <option value="desassociar_e_suspender">Desassociar e liberar a linha (Disponível)</option>
                    </select>
                  </div>
                </div>

                {/* Acessórios */}
                <div className="p-3 bg-subtle border border-line rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-text">Acessórios devolvidos</span>
                  <SearchableMultiSelect values={devolucaoAccessories} onChange={setDevolucaoAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Motivo / Observações da devolução</label>
                  <textarea
                    value={devolucaoReason}
                    onChange={(e) => setDevolucaoReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-line-strong px-3 py-2 text-text"
                  />
                </div>
              </div>
            )}

            {/* --- TRANSFERÊNCIA --- */}
            {activeFlow === 'transferencia' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-accent" />
                  Transferência entre Colaboradores (via Estoque)
                </h3>

                <div className="p-3 bg-info-bg/40 border border-info-bd rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-accent">Origem: Colaborador A (Atual)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Colaborador de Origem</label>
                      <SearchableSelect value={transfCollabAId} onChange={handleTransfCollabAChange} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Aparelho em uso pelo Colaborador A *</label>
                      <SearchableSelect value={transfDeviceId} onChange={setTransfDeviceId} options={deviceOptions(inUseDevices.filter((device) => device.currentCollaboratorId === transfCollabAId))} placeholder="Selecione o aparelho" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-ok-bg/40 border border-ok-bd rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-ok-fg">Destino: Colaborador B (Novo Responsável)</span>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Colaborador de Destino</label>
                    <SearchableSelect value={transfCollabBId} onChange={setTransfCollabBId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo' && item.id !== transfCollabAId))} placeholder="Selecione o colaborador" />
                  </div>
                </div>

                <div className="p-3 bg-subtle border border-line rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-text">Etapa Intermediária: Estoque</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Status do aparelho ao entrar no Estoque</label>
                      <select
                        value={transfDestinoEstoque}
                        onChange={(e) => setTransfDestinoEstoque(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        {deviceStatusOptions(['device-status-available', 'device-status-awaiting-evaluation', 'device-status-maintenance'], transfDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Tratamento da Linha Telefônica</label>
                      <select
                        value={transfLineHandling}
                        onChange={(e) => setTransfLineHandling(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        <option value="transferir_linha_junto">Transferir a linha junto com o aparelho</option>
                        <option value="manter_linha_com_origem">Manter a linha com o Colaborador A</option>
                        <option value="retornar_linha_ao_estoque">Retornar a linha ao estoque (Disponível)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-subtle border border-line rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-text">Acessórios inclusos</span>
                  <SearchableMultiSelect values={transfAccessories} onChange={setTransfAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Motivo da transferência</label>
                  <textarea
                    value={transfReason}
                    onChange={(e) => setTransfReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-line-strong px-3 py-2 text-text"
                  />
                </div>
              </div>
            )}

            {/* --- TROCA --- */}
            {activeFlow === 'troca' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-accent" />
                  Troca de Aparelho do Mesmo Colaborador
                </h3>

                <div className="p-3 bg-info-bg/40 border border-info-bd rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-accent">Colaborador que fará a troca</span>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Colaborador</label>
                    <SearchableSelect value={trocaCollabId} onChange={handleTrocaCollabChange} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                </div>

                {/* Sub-bloco Aparelho Antigo */}
                <div className="p-3 bg-warn-bg/40 border border-warn-bd rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-warn-fg">Aparelho Antigo (será devolvido ao Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Aparelho Antigo</label>
                      <SearchableSelect value={trocaOldDeviceId} onChange={setTrocaOldDeviceId} options={deviceOptions(inUseDevices.filter((device) => device.currentCollaboratorId === trocaCollabId))} placeholder="Selecione o aparelho" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Condição do antigo</label>
                      <select
                        value={trocaOldCondition}
                        onChange={(e) => setTrocaOldCondition(e.target.value as DeviceCondition)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        <option value="Excelente">Excelente</option>
                        <option value="Bom">Bom</option>
                        <option value="Regular">Regular</option>
                        <option value="Danificado">Danificado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Destino do Aparelho Antigo no Estoque</label>
                      <select
                        value={trocaOldDestinoEstoque}
                        onChange={(e) => setTrocaOldDestinoEstoque(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        {deviceStatusOptions(['device-status-awaiting-evaluation', 'device-status-maintenance', 'device-status-available', 'device-status-awaiting-disposal'], trocaOldDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-2 bg-surface border border-line rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-text">Acessórios do aparelho antigo</span>
                    <SearchableMultiSelect values={trocaOldAccessories} onChange={setTrocaOldAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                  </div>
                </div>

                {/* Sub-bloco Novo Aparelho */}
                <div className="p-3 bg-ok-bg/40 border border-ok-bd rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-ok-fg">Novo Aparelho (será entregue do Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Novo Aparelho</label>
                      <SearchableSelect value={trocaNewDeviceId} onChange={setTrocaNewDeviceId} options={deviceOptions(availableStockDevices)} placeholder="Selecione o aparelho" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Condição do novo</label>
                      <select
                        value={trocaNewCondition}
                        onChange={(e) => setTrocaNewCondition(e.target.value as DeviceCondition)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        <option value="Novo">Novo</option>
                        <option value="Excelente">Excelente</option>
                        <option value="Bom">Bom</option>
                        <option value="Regular">Regular</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted mb-1">Linha Telefônica no Novo Aparelho</label>
                      <select
                        value={trocaLineOption}
                        onChange={(e) => setTrocaLineOption(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                      >
                        <option value="manter_linha_atual_no_novo">Manter linha telefônica atual do colaborador no novo aparelho</option>
                        <option value="selecionar_outra_linha">Selecionar outra linha do estoque</option>
                        <option value="sem_linha">Novo aparelho sem linha associada</option>
                      </select>
                    </div>
                    {trocaLineOption === 'selecionar_outra_linha' && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted mb-1">Outra Linha do Estoque</label>
                        <SearchableSelect value={trocaCustomLineId} onChange={setTrocaCustomLineId} options={lineOptions(lines.filter((line) => line.status === availableLineStatus))} placeholder="Selecione a linha" />
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-surface border border-line rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-text">Acessórios do novo aparelho</span>
                    <SearchableMultiSelect values={trocaNewAccessories} onChange={setTrocaNewAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Motivo da troca</label>
                  <textarea
                    value={trocaReason}
                    onChange={(e) => setTrocaReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-line-strong px-3 py-2 text-text"
                  />
                </div>
              </div>
            )}

            {activeFlow !== 'entrega' && <div>
              <label className="block text-xs font-medium text-muted mb-1">Data da movimentação *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
              />
            </div>}

            {/* Observações Gerais */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Observações Gerais (opcional)</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="w-full text-xs rounded-lg border border-line-strong px-3 py-2 text-text"
              />
            </div>

            {/* Botão Revisar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {selectedTerms.map((term) => (
                  <span key={term.id} className="inline-flex items-center gap-1 rounded-md border border-info-bd bg-info-bg px-2 py-1 text-[11px] font-medium text-accent">
                    {term.code}<button type="button" aria-label={`Remover termo ${term.code}`} onClick={() => setSelectedTermIds((current) => current.filter((id) => id !== term.id))} className="text-accent hover:text-danger-fg"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {termPdfFile && <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-text"><span className="max-w-44 truncate">{termPdfFile.name}</span><button type="button" aria-label="Remover PDF anexado" onClick={() => { setTermPdfFile(null); setTermPdfError(''); }} className="text-muted hover:text-danger-fg"><X className="h-3 w-3" /></button></span>}
              </div>
              <div className="flex justify-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-subtle">
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { void handleTermPdfSelect(event.target.files?.[0]); event.target.value = ''; }} />
                  <FileText className="h-4 w-4" />Anexar PDF
                </label>
                <button
                  type="button"
                  onClick={() => { setTermSearch(''); setTermDraftIds(selectedTermIds); setIsTermPickerOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-surface hover:bg-subtle text-text border border-line-strong rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" />Documento
                </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-accent hover:bg-accent/90 text-on-accent rounded-lg shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Revisar e Confirmar Operação
              </button>
              </div>
            </div>
            {termPdfError && <p role="alert" className="text-xs text-danger-fg">{termPdfError}</p>}
          </form>
        )}

        {/* 3. RESUMO DA OPERAÇÃO */}
        {showSummary && (
          <div className="space-y-4">
            <div className="p-4 bg-surface border border-line rounded-xl">
              <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Resumo da Operação Oficial
              </h3>

              {/* Flow-specific summary */}
              {activeFlow === 'entrega' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-muted">Tipo: </span>
                    <strong className="text-ok-fg">Entrega de Aparelho (Estoque → Colaborador)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Aparelho:</span>
                    <strong className="text-text font-mono">{selEntregaDev?.assetTag || '—'}</strong>
                    <span className="text-muted">{selEntregaDev ? `${selEntregaDev.model}` : ''}</span>
                    {selEntregaDev?.imei1 && <span className="text-muted">IMEI: {selEntregaDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Colaborador Destinatário:</span>
                    <strong className="text-text">{selEntregaCollab?.fullName || '—'}</strong>
                    {selEntregaCollab?.registrationNumber && <span className="text-muted">({selEntregaCollab.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-muted">Linha Telefônica: </span>
                    <strong>{selEntregaDev?.associatedPhoneNumber ? `${selEntregaDev.associatedPhoneNumber} (selecionada)` : 'Sem linha / Não selecionada'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Condição: </span>
                    <strong>{entregaCondition}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Acessórios: </span>
                    <strong>{entregaAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-muted">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'devolucao' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-muted">Tipo: </span>
                    <strong className="text-warn-fg">Devolução de Aparelho (Colaborador → Estoque)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Aparelho:</span>
                    <strong className="text-text font-mono">{selDevolucaoDev?.assetTag || '—'}</strong>
                    <span className="text-muted">{selDevolucaoDev ? `${selDevolucaoDev.model}` : ''}</span>
                    {selDevolucaoDev?.imei1 && <span className="text-muted">IMEI: {selDevolucaoDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Colaborador Atual:</span>
                    <strong className="text-text">{selDevolucaoCollab?.fullName || '—'}</strong>
                    {selDevolucaoCollab?.registrationNumber && <span className="text-muted">({selDevolucaoCollab.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-muted">Destino no Estoque: </span>
                    <strong>{devolucaoDestinoEstoque}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Linha Telefônica: </span>
                    <strong>{devolucaoLineHandling === 'retornar_ao_estoque' ? 'Retorna ao estoque (Disponível)' : devolucaoLineHandling === 'manter_com_colaborador' ? 'Mantém com o colaborador' : 'Desassociada e liberada (Disponível)'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Condição: </span>
                    <strong>{devolucaoCondition}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Acessórios: </span>
                    <strong>{devolucaoAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-muted">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'transferencia' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-muted">Tipo: </span>
                    <strong className="text-accent">Transferência Patrimonial (Colaborador A → Estoque → Colaborador B)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Aparelho:</span>
                    <strong className="text-text font-mono">{selTransfDev?.assetTag || '—'}</strong>
                    <span className="text-muted">{selTransfDev ? `${selTransfDev.model}` : ''}</span>
                    {selTransfDev?.imei1 && <span className="text-muted">IMEI: {selTransfDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Colaborador A (Origem):</span>
                    <strong className="text-text">{selTransfCollabA?.fullName || '—'}</strong>
                    {selTransfCollabA?.registrationNumber && <span className="text-muted">({selTransfCollabA.registrationNumber})</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Colaborador B (Destino):</span>
                    <strong className="text-text">{selTransfCollabB?.fullName || '—'}</strong>
                    {selTransfCollabB?.registrationNumber && <span className="text-muted">({selTransfCollabB.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-muted">Status no Estoque intermediário: </span>
                    <strong>{transfDestinoEstoque}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Tratamento da Linha: </span>
                    <strong>{transfLineHandling === 'transferir_linha_junto' ? 'Transferida junto' : transfLineHandling === 'manter_linha_com_origem' ? 'Mantida com A' : 'Retorna ao estoque'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Acessórios: </span>
                    <strong>{transfAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-muted">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'troca' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-muted">Tipo: </span>
                    <strong className="text-accent">Troca de Aparelho do Mesmo Colaborador</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Colaborador:</span>
                    <strong className="text-text">{selTrocaCollab?.fullName || '—'}</strong>
                    {selTrocaCollab?.registrationNumber && <span className="text-muted">({selTrocaCollab.registrationNumber})</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Aparelho Antigo:</span>
                    <strong className="text-text font-mono">{selTrocaOldDev?.assetTag || '—'}</strong>
                    <span className="text-muted">{selTrocaOldDev ? `${selTrocaOldDev.model}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted">Destino do Antigo no Estoque: </span>
                    <strong>{trocaOldDestinoEstoque}</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted">Novo Aparelho:</span>
                    <strong className="text-text font-mono">{selTrocaNewDev?.assetTag || '—'}</strong>
                    <span className="text-muted">{selTrocaNewDev ? `${selTrocaNewDev.model}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted">Linha no Novo: </span>
                    <strong>{trocaLineOption === 'manter_linha_atual_no_novo' ? 'Mantém a linha atual' : trocaLineOption === 'selecionar_outra_linha' ? 'Outra linha selecionada' : 'Sem linha'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Acessórios do Antigo: </span>
                    <strong>{trocaOldAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Acessórios do Novo: </span>
                    <strong>{trocaNewAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-muted">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="px-3 py-1.5 text-xs font-medium bg-surface border border-line-strong hover:bg-subtle text-text rounded-lg"
                >
                  Voltar e Corrigir
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOperation}
                  disabled={isApprovalSubmitting || isAttachingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-ok-fg hover:opacity-90 text-ok-bg rounded-lg shadow-xs transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isAttachingPdf ? 'Anexando PDF...' : isApprovalSubmitting ? 'Aprovando...' : approvalRequest ? 'Aprovar e Registrar Operação' : 'Confirmar e Registrar Operação Oficial'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
    <Modal isOpen={isTermPickerOpen} onClose={() => setIsTermPickerOpen(false)} title="Selecionar documentos" subtitle="Escolha um ou mais termos já cadastrados." maxWidth="2xl">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
          <input value={termSearch} onChange={(event) => setTermSearch(event.target.value)} placeholder="Pesquisar código, tipo, colaborador ou aparelho..." className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-xs text-text focus:outline-none focus:ring-2 focus:ring-focus/40" />
        </div>
        <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {availableTerms.filter((term) => [term.code, term.type, term.title, term.collaboratorName, term.deviceTag].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termSearch.toLocaleLowerCase('pt-BR'))).length ? availableTerms
            .filter((term) => [term.code, term.type, term.title, term.collaboratorName, term.deviceTag].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termSearch.toLocaleLowerCase('pt-BR')))
            .map((term) => {
              const selected = termDraftIds.includes(term.id);
              return (
                <button key={term.id} type="button" aria-pressed={selected} onClick={() => setTermDraftIds((current) => selected ? current.filter((id) => id !== term.id) : [...current, term.id])} className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${selected ? 'bg-info-bg' : 'bg-surface hover:bg-subtle'}`}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface'}`}>{selected && <CheckCircle2 className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-text"><span className="font-mono">{term.code}</span><span>{term.type}</span><span className="rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">{term.status}</span></span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">{term.collaboratorName || 'Sem colaborador'} · {term.deviceTag || 'Sem aparelho'} · {term.title}</span>
                  </span>
                </button>
              );
            }) : <p className="px-3 py-8 text-center text-xs text-muted">{availableTerms.length ? 'Nenhum termo corresponde à pesquisa.' : 'Nenhum termo cadastrado. Cadastre documentos na tela Termos e documentos.'}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11px] text-muted">{termDraftIds.length} termo(s) selecionado(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsTermPickerOpen(false)} className="rounded-lg bg-subtle px-4 py-2 text-xs font-medium text-text hover:bg-line">Cancelar</button>
            <button type="button" onClick={() => { setSelectedTermIds(termDraftIds); setIsTermPickerOpen(false); }} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent/90">Confirmar seleção</button>
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
};

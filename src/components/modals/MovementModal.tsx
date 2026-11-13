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
          <div className="rounded-lg border border-sun-300 bg-sun-50/70 p-3 text-xs text-gold-700">
            <strong className="block text-ink-900">Aprovação da solicitação · {approvalRequest.requesterName}</strong>
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
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. DIAGRAMA VISUAL DO FLUXO OPERACIONAL */}
        <div className="p-3 bg-iane-50/60 border border-iane-200 rounded-xl flex items-center justify-center gap-3 text-xs text-iane-800">
          {activeFlow === 'entrega' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-iane-600" />
                Estoque (Disponível)
              </span>
              <ArrowRight className="w-4 h-4 text-iane-500" />
              <span className="px-2.5 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-iane-600" />
                Colaborador Destinatário
              </span>
            </div>
          )}

          {activeFlow === 'devolucao' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-iane-600" />
                Colaborador Atual
              </span>
              <ArrowRight className="w-4 h-4 text-iane-500" />
              <span className="px-2.5 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-iane-600" />
                Estoque
              </span>
            </div>
          )}

          {activeFlow === 'transferencia' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-semibold">
                1. Colaborador A
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-iane-600 text-white rounded-md shadow-xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-white" />
                2. Estoque (Conferência)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-semibold">
                3. Colaborador B
              </span>
            </div>
          )}

          {activeFlow === 'troca' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-semibold">
                Aparelho Antigo
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-iane-600 text-white rounded-md shadow-xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-white" />
                Estoque
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-iane-500" />
              <span className="px-2 py-1 bg-white border border-iane-200 rounded-md shadow-2xs font-semibold">
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
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-iane-600" />
                  Seleção do Aparelho (Estoque)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho</label>
                    <SearchableSelect value={entregaDeviceId} onChange={setEntregaDeviceId} options={deviceOptions(availableStockDevices)} placeholder="Selecione o aparelho" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Linha Telefônica (opcional)</label>
                    <SearchableSelect value={entregaLineId} onChange={setEntregaLineId} options={lineOptions(lines.filter((line) => line.status === availableLineStatus))} placeholder="Selecione a linha" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Condição na entrega</label>
                    <select
                      value={entregaCondition}
                      onChange={(e) => setEntregaCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="Novo">Novo</option>
                      <option value="Excelente">Excelente</option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Danificado">Danificado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Data da movimentação *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-iane-600" />
                  Colaborador Destinatário
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador</label>
                    <SearchableSelect value={entregaCollabId} onChange={setEntregaCollabId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Motivo da entrega</label>
                    <input
                      type="text"
                      value={entregaReason}
                      onChange={(e) => setEntregaReason(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 px-3 py-2 text-ink-800"
                    />
                  </div>
                </div>

                {/* Acessórios */}
                <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-ink-700">Acessórios incluídos na entrega</span>
                  <SearchableMultiSelect values={entregaAccessories} onChange={setEntregaAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>
              </div>
            )}

            {/* --- DEVOLUÇÃO --- */}
            {activeFlow === 'devolucao' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-iane-600" />
                  Aparelho em Uso (será devolvido)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho</label>
                    <SearchableSelect value={devolucaoDeviceId} onChange={handleDevolucaoDeviceChange} options={deviceOptions(returnFlowDevices)} placeholder="Selecione o aparelho" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador Responsável</label>
                    <SearchableSelect value={devolucaoCollabId} onChange={setDevolucaoCollabId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Condição na devolução</label>
                    <select
                      value={devolucaoCondition}
                      onChange={(e) => setDevolucaoCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="Excelente">Excelente</option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Danificado">Danificado</option>
                    </select>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-iane-600" />
                  Destino no Estoque
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Status após devolução</label>
                    <select value={devolucaoDestinoEstoque} onChange={(e) => setDevolucaoDestinoEstoque(e.target.value)} className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800">
                      {deviceStatusOptions(['device-status-available', 'device-status-awaiting-evaluation', 'device-status-maintenance', 'device-status-reserved', 'device-status-awaiting-disposal'], devolucaoDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Destino da Linha Telefônica</label>
                    <select
                      value={devolucaoLineHandling}
                      onChange={(e) => setDevolucaoLineHandling(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="retornar_ao_estoque">Retornar ao estoque de linhas (Disponível)</option>
                      <option value="manter_com_colaborador">Manter com o colaborador (BYOD / aguardando novo aparelho)</option>
                      <option value="desassociar_e_suspender">Desassociar e liberar a linha (Disponível)</option>
                    </select>
                  </div>
                </div>

                {/* Acessórios */}
                <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-ink-700">Acessórios devolvidos</span>
                  <SearchableMultiSelect values={devolucaoAccessories} onChange={setDevolucaoAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Motivo / Observações da devolução</label>
                  <textarea
                    value={devolucaoReason}
                    onChange={(e) => setDevolucaoReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-ink-300 px-3 py-2 text-ink-800"
                  />
                </div>
              </div>
            )}

            {/* --- TRANSFERÊNCIA --- */}
            {activeFlow === 'transferencia' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-iane-600" />
                  Transferência entre Colaboradores (via Estoque)
                </h3>

                <div className="p-3 bg-iane-50/40 border border-iane-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-iane-700">Origem: Colaborador A (Atual)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador de Origem</label>
                      <SearchableSelect value={transfCollabAId} onChange={handleTransfCollabAChange} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho em uso pelo Colaborador A *</label>
                      <SearchableSelect value={transfDeviceId} onChange={setTransfDeviceId} options={deviceOptions(inUseDevices.filter((device) => device.currentCollaboratorId === transfCollabAId))} placeholder="Selecione o aparelho" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-emerald-700">Destino: Colaborador B (Novo Responsável)</span>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador de Destino</label>
                    <SearchableSelect value={transfCollabBId} onChange={setTransfCollabBId} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo' && item.id !== transfCollabAId))} placeholder="Selecione o colaborador" />
                  </div>
                </div>

                <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-ink-700">Etapa Intermediária: Estoque</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Status do aparelho ao entrar no Estoque</label>
                      <select
                        value={transfDestinoEstoque}
                        onChange={(e) => setTransfDestinoEstoque(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        {deviceStatusOptions(['device-status-available', 'device-status-awaiting-evaluation', 'device-status-maintenance'], transfDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Tratamento da Linha Telefônica</label>
                      <select
                        value={transfLineHandling}
                        onChange={(e) => setTransfLineHandling(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        <option value="transferir_linha_junto">Transferir a linha junto com o aparelho</option>
                        <option value="manter_linha_com_origem">Manter a linha com o Colaborador A</option>
                        <option value="retornar_linha_ao_estoque">Retornar a linha ao estoque (Disponível)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-ink-700">Acessórios inclusos</span>
                  <SearchableMultiSelect values={transfAccessories} onChange={setTransfAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Motivo da transferência</label>
                  <textarea
                    value={transfReason}
                    onChange={(e) => setTransfReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-ink-300 px-3 py-2 text-ink-800"
                  />
                </div>
              </div>
            )}

            {/* --- TROCA --- */}
            {activeFlow === 'troca' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-iane-600" />
                  Troca de Aparelho do Mesmo Colaborador
                </h3>

                <div className="p-3 bg-iane-50/40 border border-iane-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-iane-700">Colaborador que fará a troca</span>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador</label>
                    <SearchableSelect value={trocaCollabId} onChange={handleTrocaCollabChange} options={collaboratorOptions(collaborators.filter((item) => item.status === 'Ativo'))} placeholder="Selecione o colaborador" />
                  </div>
                </div>

                {/* Sub-bloco Aparelho Antigo */}
                <div className="p-3 bg-sun-50/40 border border-sun-300 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-gold-700">Aparelho Antigo (será devolvido ao Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho Antigo</label>
                      <SearchableSelect value={trocaOldDeviceId} onChange={setTrocaOldDeviceId} options={deviceOptions(inUseDevices.filter((device) => device.currentCollaboratorId === trocaCollabId))} placeholder="Selecione o aparelho" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Condição do antigo</label>
                      <select
                        value={trocaOldCondition}
                        onChange={(e) => setTrocaOldCondition(e.target.value as DeviceCondition)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        <option value="Excelente">Excelente</option>
                        <option value="Bom">Bom</option>
                        <option value="Regular">Regular</option>
                        <option value="Danificado">Danificado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Destino do Aparelho Antigo no Estoque</label>
                      <select
                        value={trocaOldDestinoEstoque}
                        onChange={(e) => setTrocaOldDestinoEstoque(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        {deviceStatusOptions(['device-status-awaiting-evaluation', 'device-status-maintenance', 'device-status-available', 'device-status-awaiting-disposal'], trocaOldDestinoEstoque).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-2 bg-white border border-ink-200 rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-ink-700">Acessórios do aparelho antigo</span>
                    <SearchableMultiSelect values={trocaOldAccessories} onChange={setTrocaOldAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                  </div>
                </div>

                {/* Sub-bloco Novo Aparelho */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-emerald-700">Novo Aparelho (será entregue do Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Novo Aparelho</label>
                      <SearchableSelect value={trocaNewDeviceId} onChange={setTrocaNewDeviceId} options={deviceOptions(availableStockDevices)} placeholder="Selecione o aparelho" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Condição do novo</label>
                      <select
                        value={trocaNewCondition}
                        onChange={(e) => setTrocaNewCondition(e.target.value as DeviceCondition)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        <option value="Novo">Novo</option>
                        <option value="Excelente">Excelente</option>
                        <option value="Bom">Bom</option>
                        <option value="Regular">Regular</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-ink-600 mb-1">Linha Telefônica no Novo Aparelho</label>
                      <select
                        value={trocaLineOption}
                        onChange={(e) => setTrocaLineOption(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      >
                        <option value="manter_linha_atual_no_novo">Manter linha telefônica atual do colaborador no novo aparelho</option>
                        <option value="selecionar_outra_linha">Selecionar outra linha do estoque</option>
                        <option value="sem_linha">Novo aparelho sem linha associada</option>
                      </select>
                    </div>
                    {trocaLineOption === 'selecionar_outra_linha' && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-ink-600 mb-1">Outra Linha do Estoque</label>
                        <SearchableSelect value={trocaCustomLineId} onChange={setTrocaCustomLineId} options={lineOptions(lines.filter((line) => line.status === availableLineStatus))} placeholder="Selecione a linha" />
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-white border border-ink-200 rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-ink-700">Acessórios do novo aparelho</span>
                    <SearchableMultiSelect values={trocaNewAccessories} onChange={setTrocaNewAccessories} options={accessoryOptions} placeholder="Selecionar acessórios" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Motivo da troca</label>
                  <textarea
                    value={trocaReason}
                    onChange={(e) => setTrocaReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border border-ink-300 px-3 py-2 text-ink-800"
                  />
                </div>
              </div>
            )}

            {activeFlow !== 'entrega' && <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Data da movimentação *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
              />
            </div>}

            {/* Observações Gerais */}
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Observações Gerais (opcional)</label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="w-full text-xs rounded-lg border border-ink-300 px-3 py-2 text-ink-800"
              />
            </div>

            {/* Botão Revisar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {selectedTerms.map((term) => (
                  <span key={term.id} className="inline-flex items-center gap-1 rounded-md border border-iane-200 bg-iane-50 px-2 py-1 text-[11px] font-medium text-iane-800">
                    {term.code}<button type="button" aria-label={`Remover termo ${term.code}`} onClick={() => setSelectedTermIds((current) => current.filter((id) => id !== term.id))} className="text-iane-600 hover:text-rose-600"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {termPdfFile && <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] text-ink-700"><span className="max-w-44 truncate">{termPdfFile.name}</span><button type="button" aria-label="Remover PDF anexado" onClick={() => { setTermPdfFile(null); setTermPdfError(''); }} className="text-ink-500 hover:text-rose-600"><X className="h-3 w-3" /></button></span>}
              </div>
              <div className="flex justify-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50">
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { void handleTermPdfSelect(event.target.files?.[0]); event.target.value = ''; }} />
                  <FileText className="h-4 w-4" />Anexar PDF
                </label>
                <button
                  type="button"
                  onClick={() => { setTermSearch(''); setTermDraftIds(selectedTermIds); setIsTermPickerOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white hover:bg-ink-50 text-ink-700 border border-ink-300 rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" />Documento
                </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-iane-600 hover:bg-iane-700 text-white rounded-lg shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Revisar e Confirmar Operação
              </button>
              </div>
            </div>
            {termPdfError && <p role="alert" className="text-xs text-rose-700">{termPdfError}</p>}
          </form>
        )}

        {/* 3. RESUMO DA OPERAÇÃO */}
        {showSummary && (
          <div className="space-y-4">
            <div className="p-4 bg-white border border-ink-200 rounded-xl">
              <h3 className="text-sm font-bold text-ink-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-iane-600" />
                Resumo da Operação Oficial
              </h3>

              {/* Flow-specific summary */}
              {activeFlow === 'entrega' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-ink-500">Tipo: </span>
                    <strong className="text-emerald-700">Entrega de Aparelho (Estoque → Colaborador)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Aparelho:</span>
                    <strong className="text-ink-900 font-mono">{selEntregaDev?.assetTag || '—'}</strong>
                    <span className="text-ink-500">{selEntregaDev ? `${selEntregaDev.model}` : ''}</span>
                    {selEntregaDev?.imei1 && <span className="text-ink-500">IMEI: {selEntregaDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Colaborador Destinatário:</span>
                    <strong className="text-ink-900">{selEntregaCollab?.fullName || '—'}</strong>
                    {selEntregaCollab?.registrationNumber && <span className="text-ink-500">({selEntregaCollab.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-ink-500">Linha Telefônica: </span>
                    <strong>{selEntregaDev?.associatedPhoneNumber ? `${selEntregaDev.associatedPhoneNumber} (selecionada)` : 'Sem linha / Não selecionada'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Condição: </span>
                    <strong>{entregaCondition}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Acessórios: </span>
                    <strong>{entregaAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-ink-500">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'devolucao' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-ink-500">Tipo: </span>
                    <strong className="text-gold-700">Devolução de Aparelho (Colaborador → Estoque)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Aparelho:</span>
                    <strong className="text-ink-900 font-mono">{selDevolucaoDev?.assetTag || '—'}</strong>
                    <span className="text-ink-500">{selDevolucaoDev ? `${selDevolucaoDev.model}` : ''}</span>
                    {selDevolucaoDev?.imei1 && <span className="text-ink-500">IMEI: {selDevolucaoDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Colaborador Atual:</span>
                    <strong className="text-ink-900">{selDevolucaoCollab?.fullName || '—'}</strong>
                    {selDevolucaoCollab?.registrationNumber && <span className="text-ink-500">({selDevolucaoCollab.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-ink-500">Destino no Estoque: </span>
                    <strong>{devolucaoDestinoEstoque}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Linha Telefônica: </span>
                    <strong>{devolucaoLineHandling === 'retornar_ao_estoque' ? 'Retorna ao estoque (Disponível)' : devolucaoLineHandling === 'manter_com_colaborador' ? 'Mantém com o colaborador' : 'Desassociada e liberada (Disponível)'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Condição: </span>
                    <strong>{devolucaoCondition}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Acessórios: </span>
                    <strong>{devolucaoAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-ink-500">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'transferencia' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-ink-500">Tipo: </span>
                    <strong className="text-iane-700">Transferência Patrimonial (Colaborador A → Estoque → Colaborador B)</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Aparelho:</span>
                    <strong className="text-ink-900 font-mono">{selTransfDev?.assetTag || '—'}</strong>
                    <span className="text-ink-500">{selTransfDev ? `${selTransfDev.model}` : ''}</span>
                    {selTransfDev?.imei1 && <span className="text-ink-500">IMEI: {selTransfDev.imei1}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Colaborador A (Origem):</span>
                    <strong className="text-ink-900">{selTransfCollabA?.fullName || '—'}</strong>
                    {selTransfCollabA?.registrationNumber && <span className="text-ink-500">({selTransfCollabA.registrationNumber})</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Colaborador B (Destino):</span>
                    <strong className="text-ink-900">{selTransfCollabB?.fullName || '—'}</strong>
                    {selTransfCollabB?.registrationNumber && <span className="text-ink-500">({selTransfCollabB.registrationNumber})</span>}
                  </div>
                  <div>
                    <span className="text-ink-500">Status no Estoque intermediário: </span>
                    <strong>{transfDestinoEstoque}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Tratamento da Linha: </span>
                    <strong>{transfLineHandling === 'transferir_linha_junto' ? 'Transferida junto' : transfLineHandling === 'manter_linha_com_origem' ? 'Mantida com A' : 'Retorna ao estoque'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Acessórios: </span>
                    <strong>{transfAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-ink-500">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {activeFlow === 'troca' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-ink-500">Tipo: </span>
                    <strong className="text-iane-700">Troca de Aparelho do Mesmo Colaborador</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Colaborador:</span>
                    <strong className="text-ink-900">{selTrocaCollab?.fullName || '—'}</strong>
                    {selTrocaCollab?.registrationNumber && <span className="text-ink-500">({selTrocaCollab.registrationNumber})</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Aparelho Antigo:</span>
                    <strong className="text-ink-900 font-mono">{selTrocaOldDev?.assetTag || '—'}</strong>
                    <span className="text-ink-500">{selTrocaOldDev ? `${selTrocaOldDev.model}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-ink-500">Destino do Antigo no Estoque: </span>
                    <strong>{trocaOldDestinoEstoque}</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-500">Novo Aparelho:</span>
                    <strong className="text-ink-900 font-mono">{selTrocaNewDev?.assetTag || '—'}</strong>
                    <span className="text-ink-500">{selTrocaNewDev ? `${selTrocaNewDev.model}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-ink-500">Linha no Novo: </span>
                    <strong>{trocaLineOption === 'manter_linha_atual_no_novo' ? 'Mantém a linha atual' : trocaLineOption === 'selecionar_outra_linha' ? 'Outra linha selecionada' : 'Sem linha'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Acessórios do Antigo: </span>
                    <strong>{trocaOldAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Acessórios do Novo: </span>
                    <strong>{trocaNewAccessories.join(', ') || 'Nenhum'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-500">Data: </span>
                    <strong>{date}</strong>
                  </div>
                  <div><span className="text-ink-500">Documentos: </span><strong>{selectedTerms.map((term) => term.code).join(', ') || 'Nenhum (opcional)'}</strong></div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-ink-300 hover:bg-ink-50 text-ink-700 rounded-lg"
                >
                  Voltar e Corrigir
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOperation}
                  disabled={isApprovalSubmitting || isAttachingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-60"
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
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-400" />
          <input value={termSearch} onChange={(event) => setTermSearch(event.target.value)} placeholder="Pesquisar código, tipo, colaborador ou aparelho..." className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-xs text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500" />
        </div>
        <div className="max-h-72 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
          {availableTerms.filter((term) => [term.code, term.type, term.title, term.collaboratorName, term.deviceTag].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termSearch.toLocaleLowerCase('pt-BR'))).length ? availableTerms
            .filter((term) => [term.code, term.type, term.title, term.collaboratorName, term.deviceTag].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termSearch.toLocaleLowerCase('pt-BR')))
            .map((term) => {
              const selected = termDraftIds.includes(term.id);
              return (
                <button key={term.id} type="button" aria-pressed={selected} onClick={() => setTermDraftIds((current) => selected ? current.filter((id) => id !== term.id) : [...current, term.id])} className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${selected ? 'bg-iane-50' : 'bg-white hover:bg-ink-50'}`}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-iane-600 bg-iane-600 text-white' : 'border-ink-300 bg-white'}`}>{selected && <CheckCircle2 className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-900"><span className="font-mono">{term.code}</span><span>{term.type}</span><span className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">{term.status}</span></span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-500">{term.collaboratorName || 'Sem colaborador'} · {term.deviceTag || 'Sem aparelho'} · {term.title}</span>
                  </span>
                </button>
              );
            }) : <p className="px-3 py-8 text-center text-xs text-ink-400">{availableTerms.length ? 'Nenhum termo corresponde à pesquisa.' : 'Nenhum termo cadastrado. Cadastre documentos na tela Termos e documentos.'}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
          <span className="text-[11px] text-ink-500">{termDraftIds.length} termo(s) selecionado(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsTermPickerOpen(false)} className="rounded-lg bg-ink-100 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-200">Cancelar</button>
            <button type="button" onClick={() => { setSelectedTermIds(termDraftIds); setIsTermPickerOpen(false); }} className="rounded-lg bg-iane-600 px-4 py-2 text-xs font-semibold text-white hover:bg-iane-700">Confirmar seleção</button>
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
};

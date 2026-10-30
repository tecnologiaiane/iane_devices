import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Device, PhoneLine, Collaborator, DeviceCondition, DocumentTerm, RequestRecord } from '../../types';
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
} from 'lucide-react';

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

const COMMON_ACCESSORIES = [
  'Carregador Original',
  'Cabo USB-C / Lightning',
  'Capa Protetora Anti-Impacto',
  'Película de Vidro Aplicada',
  'Chave Ejetora de Chip (SIM)',
  'Embalagem / Caixa Original',
  'Fone de Ouvido Corporativo',
];

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

  // Lists
  const [devices, setDevices] = useState<Device[]>([]);
  const [lines, setLines] = useState<PhoneLine[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // --- State for ENTREGA (Estoque -> Colaborador) ---
  const [entregaDeviceId, setEntregaDeviceId] = useState('');
  const [entregaCollabId, setEntregaCollabId] = useState('');
  const [entregaLineId, setEntregaLineId] = useState('');
  const [entregaCondition, setEntregaCondition] = useState<DeviceCondition>('Novo');
  const [entregaAccessories, setEntregaAccessories] = useState<string[]>([
    'Carregador Original',
    'Cabo USB-C / Lightning',
    'Capa Protetora Anti-Impacto',
  ]);
  const [entregaReason, setEntregaReason] = useState('Entrega de ativo do estoque para exercício funcional.');

  // --- State for DEVOLUÇÃO (Colaborador -> Estoque) ---
  const [devolucaoDeviceId, setDevolucaoDeviceId] = useState('');
  const [devolucaoCollabId, setDevolucaoCollabId] = useState('');
  const [devolucaoCondition, setDevolucaoCondition] = useState<DeviceCondition>('Excelente');
  const [devolucaoDestinoEstoque, setDevolucaoDestinoEstoque] = useState<'Disponível' | 'Aguardando avaliação' | 'Em manutenção' | 'Reservado' | 'Aguardando baixa patrimonial'>('Disponível');
  const [devolucaoLineHandling, setDevolucaoLineHandling] = useState<'retornar_ao_estoque' | 'manter_com_colaborador' | 'desassociar_e_suspender'>('retornar_ao_estoque');
  const [devolucaoAccessories, setDevolucaoAccessories] = useState<string[]>([
    'Carregador Original',
    'Cabo USB-C / Lightning',
    'Capa Protetora Anti-Impacto',
  ]);
  const [devolucaoReason, setDevolucaoReason] = useState('Devolução de aparelho para o Estoque.');

  // --- State for TRANSFERÊNCIA (Colaborador A -> Estoque -> Colaborador B) ---
  const [transfCollabAId, setTransfCollabAId] = useState('');
  const [transfDeviceId, setTransfDeviceId] = useState('');
  const [transfCollabBId, setTransfCollabBId] = useState('');
  const [transfCondition, setTransfCondition] = useState<DeviceCondition>('Excelente');
  const [transfDestinoEstoque, setTransfDestinoEstoque] = useState<'Disponível' | 'Aguardando avaliação' | 'Em manutenção'>('Disponível');
  const [transfLineHandling, setTransfLineHandling] = useState<'transferir_linha_junto' | 'manter_linha_com_origem' | 'retornar_linha_ao_estoque'>('transferir_linha_junto');
  const [transfAccessories, setTransfAccessories] = useState<string[]>([
    'Carregador Original',
    'Cabo USB-C / Lightning',
  ]);
  const [transfReason, setTransfReason] = useState('Readequação de equipe e transferência patrimonial.');

  // --- State for TROCA (Colaborador A [Antigo] -> Estoque | Estoque [Novo] -> Colaborador A) ---
  const [trocaCollabId, setTrocaCollabId] = useState('');
  const [trocaOldDeviceId, setTrocaOldDeviceId] = useState('');
  const [trocaOldCondition, setTrocaOldCondition] = useState<DeviceCondition>('Bom');
  const [trocaOldDestinoEstoque, setTrocaOldDestinoEstoque] = useState<'Disponível' | 'Aguardando avaliação' | 'Em manutenção' | 'Aguardando baixa patrimonial'>('Aguardando avaliação');
  const [trocaOldAccessories, setTrocaOldAccessories] = useState<string[]>([
    'Carregador Original',
    'Cabo USB-C / Lightning',
  ]);
  const [trocaNewDeviceId, setTrocaNewDeviceId] = useState('');
  const [trocaNewCondition, setTrocaNewCondition] = useState<DeviceCondition>('Novo');
  const [trocaNewAccessories, setTrocaNewAccessories] = useState<string[]>([
    'Carregador Original',
    'Cabo USB-C / Lightning',
    'Capa Protetora Anti-Impacto',
  ]);
  const [trocaLineOption, setTrocaLineOption] = useState<'manter_linha_atual_no_novo' | 'sem_linha' | 'selecionar_outra_linha'>('manter_linha_atual_no_novo');
  const [trocaCustomLineId, setTrocaCustomLineId] = useState('');
  const [trocaReason, setTrocaReason] = useState('Atualização de modelo e substituição periódica.');

  const [observations, setObservations] = useState('');

  // Documento do termo: apenas vincular a um termo já existente (PDF já anexado)
  const [existingTermId, setExistingTermId] = useState('');
  const [availableTerms, setAvailableTerms] = useState<DocumentTerm[]>([]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      const devList = dataService.getDevices();
      const lineList = dataService.getLines();
      const collabList = dataService.getCollaborators();
      setDevices(devList);
      setLines(lineList);
      setCollaborators(collabList);
      setAvailableTerms(dataService.getTerms());
      setExistingTermId('');
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
      const firstAvailable = devList.find(d => d.status === 'Disponível');
      const firstInUse = devList.find(d => d.status === 'Em uso');

      if (defaultFlow === 'entrega') {
        const dev = selectedDevice?.status === 'Disponível' ? selectedDevice : firstAvailable;
        if (dev) setEntregaDeviceId(dev.id);
      } else if (defaultFlow === 'devolucao') {
        const dev = selectedDevice?.status === 'Em uso' ? selectedDevice : firstInUse;
        if (dev) {
          setDevolucaoDeviceId(dev.id);
          if (dev.currentCollaboratorId) setDevolucaoCollabId(dev.currentCollaboratorId);
        }
      } else if (defaultFlow === 'transferencia') {
        const dev = selectedDevice?.status === 'Em uso' ? selectedDevice : firstInUse;
        if (dev) {
          setTransfDeviceId(dev.id);
          if (dev.currentCollaboratorId) setTransfCollabAId(dev.currentCollaboratorId);
        }
      } else if (defaultFlow === 'troca') {
        const dev = selectedDevice?.status === 'Em uso' ? selectedDevice : firstInUse;
        if (dev) {
          setTrocaOldDeviceId(dev.id);
          if (dev.currentCollaboratorId) setTrocaCollabId(dev.currentCollaboratorId);
        }
        if (firstAvailable) setTrocaNewDeviceId(firstAvailable.id);
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
          const requestedDevice = devList.find((device) => device.id === requestedDeviceId && device.status === 'Em uso');
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
    }
  }, [isOpen, preselectedDeviceId, preselectedCollaboratorId, defaultFlow, approvalRequest]);

  // Helpers
  const availableStockDevices = devices.filter(d => d.status === 'Disponível');
  const inUseDevices = devices.filter(d => d.status === 'Em uso');
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
    const dev = devices.find(d => d.currentCollaboratorId === collabId && d.status === 'Em uso');
    if (dev) {
      setTransfDeviceId(dev.id);
    } else {
      setTransfDeviceId('');
    }
  };

  // Handle Troca Colaborador Change
  const handleTrocaCollabChange = (collabId: string) => {
    setTrocaCollabId(collabId);
    const dev = devices.find(d => d.currentCollaboratorId === collabId && d.status === 'Em uso');
    if (dev) {
      setTrocaOldDeviceId(dev.id);
    } else {
      setTrocaOldDeviceId('');
    }
  };

  const toggleAccessoryList = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Validation before opening summary
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (activeFlow === 'entrega') {
      if (!entregaDeviceId) return setErrorMessage('Selecione um aparelho disponível no estoque.');
      if (!entregaCollabId) return setErrorMessage('Selecione o colaborador destinatário.');
      const dev = devices.find(d => d.id === entregaDeviceId);
      if (dev?.status !== 'Disponível') {
        return setErrorMessage('O aparelho selecionado não consta como "Disponível" no estoque.');
      }
    } else if (activeFlow === 'devolucao') {
      if (!devolucaoDeviceId) return setErrorMessage('Selecione o aparelho em uso que está sendo devolvido.');
      if (!devolucaoCollabId) return setErrorMessage('Identifique o colaborador responsável atual.');
    } else if (activeFlow === 'transferencia') {
      if (!transfCollabAId) return setErrorMessage('Selecione o colaborador de origem.');
      if (!transfDeviceId) return setErrorMessage('Nenhum aparelho em uso vinculado ao colaborador de origem.');
      if (!transfCollabBId) return setErrorMessage('Selecione o novo colaborador destinatário.');
      if (transfCollabAId === transfCollabBId) return setErrorMessage('O colaborador de origem e destino devem ser diferentes.');
    } else if (activeFlow === 'troca') {
      if (!trocaCollabId) return setErrorMessage('Selecione o colaborador que realizará a troca.');
      if (!trocaOldDeviceId) return setErrorMessage('O colaborador não possui aparelho vinculado para troca.');
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
        existingTermId: existingTermId || undefined,
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
        existingTermId: existingTermId || undefined,
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
        existingTermId: existingTermId || undefined,
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
        existingTermId: existingTermId || undefined,
      };
    }

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
    } else if (activeFlow === 'entrega') {
      const result = dataService.executeDelivery({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
    } else if (activeFlow === 'devolucao') {
      const result = dataService.executeReturn({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
    } else if (activeFlow === 'transferencia') {
      const result = dataService.executeTransfer({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
    } else {
      const result = dataService.executeSwap({ ...(params as any), registeredBy: 'Gestor de Telefonia' });
      if (!result.success) return setErrorMessage(result.message);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
                    <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho *</label>
                    <select
                      value={entregaDeviceId}
                      onChange={(e) => setEntregaDeviceId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      required
                    >
                      <option value="">-- Selecione um aparelho disponível --</option>
                      {availableStockDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.assetTag} · {d.model} · {d.imei1 ? `IMEI: ${d.imei1}` : 'Sem IMEI'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Linha Telefônica (opcional)</label>
                    <select
                      value={entregaLineId}
                      onChange={(e) => setEntregaLineId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="">-- Sem linha / Selecione --</option>
                      {lines
                        .filter(l => l.status === 'Disponível')
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.phoneNumber} · {l.carrier || 'Sem operadora'}
                          </option>
                        ))}
                    </select>
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
                </div>

                <h3 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-iane-600" />
                  Colaborador Destinatário
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador *</label>
                    <select
                      value={entregaCollabId}
                      onChange={(e) => setEntregaCollabId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      required
                    >
                      <option value="">-- Selecione o colaborador --</option>
                      {collaborators
                        .filter(c => c.status === 'Ativo')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} · {c.registrationNumber || 'Sem matrícula'} · {c.department || 'Sem depto'}
                          </option>
                        ))}
                    </select>
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
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ACCESSORIES.map((acc) => (
                      <label key={acc} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={entregaAccessories.includes(acc)}
                          onChange={() => toggleAccessoryList(entregaAccessories, setEntregaAccessories, acc)}
                          className="mt-0.5 text-iane-600 focus:ring-iane-500 rounded border-ink-300"
                        />
                        <span className="text-ink-700">{acc}</span>
                      </label>
                    ))}
                  </div>
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
                    <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho *</label>
                    <select
                      value={devolucaoDeviceId}
                      onChange={(e) => handleDevolucaoDeviceChange(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      required
                    >
                      <option value="">-- Selecione um aparelho em uso --</option>
                      {returnFlowDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.assetTag} · {d.model} · {d.currentCollaboratorName || 'Sem colaborador'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador Responsável</label>
                    <select
                      value={devolucaoCollabId}
                      onChange={(e) => setDevolucaoCollabId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="">-- Selecione --</option>
                      {collaborators
                        .filter(c => c.status === 'Ativo')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} · {c.registrationNumber || 'Sem matrícula'}
                          </option>
                        ))}
                    </select>
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
                    <select
                      value={devolucaoDestinoEstoque}
                      onChange={(e) => setDevolucaoDestinoEstoque(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                    >
                      <option value="Disponível">Disponível em estoque</option>
                      <option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option>
                      <option value="Em manutenção">Em manutenção (Assistência técnica)</option>
                      <option value="Reservado">Reservado para entrega futura</option>
                      <option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial</option>
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
                      <option value="desassociar_e_suspender">Desassociar e suspender a linha</option>
                    </select>
                  </div>
                </div>

                {/* Acessórios */}
                <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
                  <span className="block text-xs font-semibold text-ink-700">Acessórios devolvidos</span>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ACCESSORIES.map((acc) => (
                      <label key={acc} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={devolucaoAccessories.includes(acc)}
                          onChange={() => toggleAccessoryList(devolucaoAccessories, setDevolucaoAccessories, acc)}
                          className="mt-0.5 text-iane-600 focus:ring-iane-500 rounded border-ink-300"
                        />
                        <span className="text-ink-700">{acc}</span>
                      </label>
                    ))}
                  </div>
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
                      <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador de Origem *</label>
                      <select
                        value={transfCollabAId}
                        onChange={(e) => handleTransfCollabAChange(e.target.value)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                        required
                      >
                        <option value="">-- Selecione --</option>
                        {collaborators
                          .filter(c => c.status === 'Ativo')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName} · {c.registrationNumber || 'Sem matrícula'}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho em uso pelo Colaborador A *</label>
                      <select
                        value={transfDeviceId}
                        onChange={(e) => setTransfDeviceId(e.target.value)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                        required
                      >
                        <option value="">-- Selecione o colaborador primeiro --</option>
                        {inUseDevices
                          .filter(d => d.currentCollaboratorId === transfCollabAId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.assetTag} · {d.model}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-emerald-700">Destino: Colaborador B (Novo Responsável)</span>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador de Destino *</label>
                    <select
                      value={transfCollabBId}
                      onChange={(e) => setTransfCollabBId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      required
                    >
                      <option value="">-- Selecione o novo responsável --</option>
                      {collaborators
                        .filter(c => c.status === 'Ativo' && c.id !== transfCollabAId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} · {c.registrationNumber || 'Sem matrícula'} · {c.department || 'Sem depto'}
                          </option>
                        ))}
                    </select>
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
                        <option value="Disponível">Disponível para nova entrega</option>
                        <option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option>
                        <option value="Em manutenção">Em manutenção (Assistência técnica)</option>
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
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ACCESSORIES.map((acc) => (
                      <label key={acc} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={transfAccessories.includes(acc)}
                          onChange={() => toggleAccessoryList(transfAccessories, setTransfAccessories, acc)}
                          className="mt-0.5 text-iane-600 focus:ring-iane-500 rounded border-ink-300"
                        />
                        <span className="text-ink-700">{acc}</span>
                      </label>
                    ))}
                  </div>
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
                    <label className="block text-xs font-medium text-ink-600 mb-1">Colaborador *</label>
                    <select
                      value={trocaCollabId}
                      onChange={(e) => handleTrocaCollabChange(e.target.value)}
                      className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                      required
                    >
                      <option value="">-- Selecione o colaborador --</option>
                      {collaborators
                        .filter(c => c.status === 'Ativo')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} · {c.registrationNumber || 'Sem matrícula'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Sub-bloco Aparelho Antigo */}
                <div className="p-3 bg-sun-50/40 border border-sun-300 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-gold-700">Aparelho Antigo (será devolvido ao Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Aparelho Antigo *</label>
                      <select
                        value={trocaOldDeviceId}
                        onChange={(e) => setTrocaOldDeviceId(e.target.value)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                        required
                      >
                        <option value="">-- Selecione --</option>
                        {inUseDevices
                          .filter(d => d.currentCollaboratorId === trocaCollabId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.assetTag} · {d.model}
                            </option>
                          ))}
                      </select>
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
                        <option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option>
                        <option value="Em manutenção">Em manutenção (Assistência técnica)</option>
                        <option value="Disponível">Disponível em estoque</option>
                        <option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2 bg-white border border-ink-200 rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-ink-700">Acessórios do aparelho antigo</span>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_ACCESSORIES.map((acc) => (
                        <label key={acc} className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={trocaOldAccessories.includes(acc)}
                            onChange={() => toggleAccessoryList(trocaOldAccessories, setTrocaOldAccessories, acc)}
                            className="mt-0.5 text-iane-600 focus:ring-iane-500 rounded border-ink-300"
                          />
                          <span className="text-ink-700">{acc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-bloco Novo Aparelho */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold text-emerald-700">Novo Aparelho (será entregue do Estoque)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-600 mb-1">Novo Aparelho *</label>
                      <select
                        value={trocaNewDeviceId}
                        onChange={(e) => setTrocaNewDeviceId(e.target.value)}
                        className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                        required
                      >
                        <option value="">-- Selecione um aparelho disponível --</option>
                        {availableStockDevices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.assetTag} · {d.model} · {d.imei1 ? `IMEI: ${d.imei1}` : 'Sem IMEI'}
                          </option>
                        ))}
                      </select>
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
                        <select
                          value={trocaCustomLineId}
                          onChange={(e) => setTrocaCustomLineId(e.target.value)}
                          className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                        >
                          <option value="">-- Selecione --</option>
                          {lines
                            .filter(l => l.status === 'Disponível')
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.phoneNumber} · {l.carrier || 'Sem operadora'}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-white border border-ink-200 rounded-lg space-y-1">
                    <span className="block text-xs font-semibold text-ink-700">Acessórios do novo aparelho</span>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_ACCESSORIES.map((acc) => (
                        <label key={acc} className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={trocaNewAccessories.includes(acc)}
                            onChange={() => toggleAccessoryList(trocaNewAccessories, setTrocaNewAccessories, acc)}
                            className="mt-0.5 text-iane-600 focus:ring-iane-500 rounded border-ink-300"
                          />
                          <span className="text-ink-700">{acc}</span>
                        </label>
                      ))}
                    </div>
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

            {/* Documento do Termo: vincular termo já existente (opcional) */}
            <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
              <span className="block text-xs font-semibold text-ink-700">
                Documento / Termo desta movimentação (opcional)
              </span>
              <div className="pt-1">
                <select
                  value={existingTermId}
                  onChange={(e) => setExistingTermId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                >
                  <option value="">-- Nenhum / Selecione um termo já existente --</option>
                  {availableTerms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {t.type} · {t.collaboratorName || 'Sem colaborador'} · {t.deviceTag || 'Sem TAG'} ({t.status})
                    </option>
                  ))}
                </select>
                {availableTerms.length === 0 && (
                  <p className="text-[11px] text-ink-500 mt-1">
                    Nenhum termo cadastrado. Cadastre termos na tela "Termos e documentos" anexando o PDF.
                  </p>
                )}
              </div>
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
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-iane-600 hover:bg-iane-700 text-white rounded-lg shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Revisar e Confirmar Operação
              </button>
            </div>
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
                  <div>
                    <span className="text-ink-500">Documento / Termo: </span>
                    {existingTermId ? (() => {
                      const t = availableTerms.find((x) => x.id === existingTermId);
                      return <strong className="text-emerald-700">Vincular termo já existente — {t ? `${t.code} (${t.type})` : ''}</strong>;
                    })() : (
                      <span className="text-ink-500">Nenhum (opcional)</span>
                    )}
                  </div>
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
                    <strong>{devolucaoLineHandling === 'retornar_ao_estoque' ? 'Retorna ao estoque (Disponível)' : devolucaoLineHandling === 'manter_com_colaborador' ? 'Mantém com o colaborador' : 'Desassociada e suspensa'}</strong>
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
                  <div>
                    <span className="text-ink-500">Documento / Termo: </span>
                    {existingTermId ? (() => {
                      const t = availableTerms.find((x) => x.id === existingTermId);
                      return <strong className="text-emerald-700">Vincular termo já existente — {t ? `${t.code} (${t.type})` : ''}</strong>;
                    })() : (
                      <span className="text-ink-500">Nenhum (opcional)</span>
                    )}
                  </div>
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
                  <div>
                    <span className="text-ink-500">Documento / Termo: </span>
                    {existingTermId ? (() => {
                      const t = availableTerms.find((x) => x.id === existingTermId);
                      return <strong className="text-emerald-700">Vincular termo já existente — {t ? `${t.code} (${t.type})` : ''}</strong>;
                    })() : (
                      <span className="text-ink-500">Nenhum (opcional)</span>
                    )}
                  </div>
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
                  <div>
                    <span className="text-ink-500">Documento / Termo: </span>
                    {existingTermId ? (() => {
                      const t = availableTerms.find((x) => x.id === existingTermId);
                      return <strong className="text-emerald-700">Vincular termo já existente — {t ? `${t.code} (${t.type})` : ''}</strong>;
                    })() : (
                      <span className="text-ink-500">Nenhum (opcional)</span>
                    )}
                  </div>
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
                  disabled={isApprovalSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isApprovalSubmitting ? 'Aprovando...' : approvalRequest ? 'Aprovar e Registrar Operação' : 'Confirmar e Registrar Operação Oficial'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

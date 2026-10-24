import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Device, PhoneLine, Collaborator, DeviceCondition } from '../../types';
import { dataService, STOCK_LABEL } from '../../services/dataStorage';
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
  Info
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

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedDeviceId,
  preselectedCollaboratorId,
  defaultFlow = 'entrega',
}) => {
  const [activeFlow, setActiveFlow] = useState<OfficialFlowType>(defaultFlow);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showSummary, setShowSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
  const [devolucaoReason, setDevolucaoReason] = useState('Devolução de aparelho para o estoque do Gestor.');

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

  // Initial load
  useEffect(() => {
    if (isOpen) {
      const devList = dataService.getDevices();
      const lineList = dataService.getLines();
      const collabList = dataService.getCollaborators();
      setDevices(devList);
      setLines(lineList);
      setCollaborators(collabList);
      setErrorMessage('');
      setShowSummary(false);
      setActiveFlow(defaultFlow);
      setDate(new Date().toISOString().split('T')[0]);

      // Preselection logic
      if (preselectedDeviceId) {
        const dev = devList.find(d => d.id === preselectedDeviceId);
        if (dev) {
          if (dev.status === 'Disponível') {
            setActiveFlow('entrega');
            setEntregaDeviceId(dev.id);
          } else if (dev.status === 'Em uso') {
            setActiveFlow('devolucao');
            setDevolucaoDeviceId(dev.id);
            if (dev.currentCollaboratorId) {
              setDevolucaoCollabId(dev.currentCollaboratorId);
              setTransfCollabAId(dev.currentCollaboratorId);
              setTransfDeviceId(dev.id);
              setTrocaCollabId(dev.currentCollaboratorId);
              setTrocaOldDeviceId(dev.id);
            }
          }
        }
      } else {
        const firstAvail = devList.find(d => d.status === 'Disponível');
        if (firstAvail) {
          setEntregaDeviceId(firstAvail.id);
          setTrocaNewDeviceId(firstAvail.id);
        }
        const firstInUse = devList.find(d => d.status === 'Em uso');
        if (firstInUse) {
          setDevolucaoDeviceId(firstInUse.id);
          if (firstInUse.currentCollaboratorId) {
            setDevolucaoCollabId(firstInUse.currentCollaboratorId);
            setTransfCollabAId(firstInUse.currentCollaboratorId);
            setTransfDeviceId(firstInUse.id);
            setTrocaCollabId(firstInUse.currentCollaboratorId);
            setTrocaOldDeviceId(firstInUse.id);
          }
        }
      }

      if (preselectedCollaboratorId) {
        setEntregaCollabId(preselectedCollaboratorId);
        setTransfCollabBId(preselectedCollaboratorId);
      }
    }
  }, [isOpen, preselectedDeviceId, preselectedCollaboratorId, defaultFlow]);

  // Helpers
  const availableStockDevices = devices.filter(d => d.status === 'Disponível');
  const inUseDevices = devices.filter(d => d.status === 'Em uso');

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
  const handleConfirmOperation = () => {
    setErrorMessage('');

    if (activeFlow === 'entrega') {
      const res = dataService.executeDelivery({
        deviceId: entregaDeviceId,
        collaboratorId: entregaCollabId,
        lineId: entregaLineId || undefined,
        date,
        condition: entregaCondition,
        accessories: entregaAccessories,
        reason: entregaReason,
        observations,
        registeredBy: 'Gestor de Telefonia',
      });
      if (!res.success) return setErrorMessage(res.message);
    } else if (activeFlow === 'devolucao') {
      const res = dataService.executeReturn({
        deviceId: devolucaoDeviceId,
        collaboratorId: devolucaoCollabId,
        date,
        condition: devolucaoCondition,
        nextDeviceStatus: devolucaoDestinoEstoque,
        lineHandling: devolucaoLineHandling,
        accessoriesReturned: devolucaoAccessories,
        reason: devolucaoReason,
        observations,
        registeredBy: 'Gestor de Telefonia',
      });
      if (!res.success) return setErrorMessage(res.message);
    } else if (activeFlow === 'transferencia') {
      const res = dataService.executeTransfer({
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
        registeredBy: 'Gestor de Telefonia',
      });
      if (!res.success) return setErrorMessage(res.message);
    } else if (activeFlow === 'troca') {
      const res = dataService.executeSwap({
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
        registeredBy: 'Gestor de Telefonia',
      });
      if (!res.success) return setErrorMessage(res.message);
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
      title="Fluxo Oficial de Movimentação de Aparelhos"
      subtitle="Controle patrimonial com passagem obrigatória pelo Estoque do Gestor de Telefonia"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. SELETOR DOS 4 FLUXOS OFICIAIS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveFlow('entrega');
              setShowSummary(false);
              setErrorMessage('');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center gap-1 ${
              activeFlow === 'entrega'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-bold">Entrega</span>
            <span className="text-[10px] text-slate-400 font-normal">Estoque → Colaborador</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFlow('devolucao');
              setShowSummary(false);
              setErrorMessage('');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center gap-1 ${
              activeFlow === 'devolucao'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-bold">Devolução</span>
            <span className="text-[10px] text-slate-400 font-normal">Colaborador → Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFlow('transferencia');
              setShowSummary(false);
              setErrorMessage('');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center gap-1 ${
              activeFlow === 'transferencia'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-bold">Transferência</span>
            <span className="text-[10px] text-slate-400 font-normal">A → Estoque → B</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFlow('troca');
              setShowSummary(false);
              setErrorMessage('');
            }}
            className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition-all text-center flex flex-col items-center gap-1 ${
              activeFlow === 'troca'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-bold">Troca de Aparelho</span>
            <span className="text-[10px] text-slate-400 font-normal">Antigo → Estoque | Novo ← Estoque</span>
          </button>
        </div>

        {/* 2. DIAGRAMA VISUAL DO FLUXO OPERACIONAL */}
        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-center gap-3 text-xs text-blue-900">
          {activeFlow === 'entrega' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Estoque do Gestor (Disponível)
              </span>
              <ArrowRight className="w-4 h-4 text-blue-500" />
              <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Colaborador Destinatário
              </span>
            </div>
          )}

          {activeFlow === 'devolucao' && (
            <div className="flex items-center gap-2 font-medium">
              <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Colaborador Atual
              </span>
              <ArrowRight className="w-4 h-4 text-blue-500" />
              <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Estoque do Gestor de Telefonia
              </span>
            </div>
          )}

          {activeFlow === 'transferencia' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-semibold">
                1. Colaborador A
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
              <span className="px-2 py-1 bg-blue-600 text-white rounded-md shadow-xs font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-white" />
                2. Estoque (Conferência)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
              <span className="px-2 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-semibold">
                3. Colaborador B
              </span>
            </div>
          )}

          {activeFlow === 'troca' && (
            <div className="flex items-center gap-2 font-medium flex-wrap justify-center">
              <span className="px-2 py-1 bg-white border border-blue-200 rounded-md shadow-2xs font-semibold">
                Aparelho Antigo → Estoque
              </span>
              <span className="text-blue-400 font-bold">|</span>
              <span className="px-2 py-1 bg-emerald-600 text-white rounded-md shadow-xs font-bold flex items-center gap-1">
                Novo Aparelho ← Estoque
              </span>
            </div>
          )}
        </div>

        {/* 3. FORMULÁRIOS ESPECÍFICOS */}
        {!showSummary ? (
          <form onSubmit={handleReview} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Data da Operação *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Responsável pelo Estoque & Controle
                </label>
                <input
                  type="text"
                  value="Gestor de Telefonia / TI"
                  disabled
                  className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 font-medium"
                />
              </div>
            </div>

            {/* FLUXO 1: ENTREGA */}
            {activeFlow === 'entrega' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aparelho Disponível no Estoque *
                  </label>
                  <select
                    value={entregaDeviceId}
                    onChange={(e) => setEntregaDeviceId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o aparelho disponível em estoque --</option>
                    {availableStockDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.assetTag} - {d.brand} {d.model} (S/N: {d.serialNumber} | IMEI: {d.imei1}) [{d.condition}]
                      </option>
                    ))}
                  </select>
                  {availableStockDevices.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Atenção: Não há nenhum aparelho com status "Disponível" no estoque no momento.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Colaborador Destinatário *
                  </label>
                  <select
                    value={entregaCollabId}
                    onChange={(e) => setEntregaCollabId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o colaborador --</option>
                    {collaborators.filter(c => c.status !== 'Desligado').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.registrationNumber}) · {c.department} - {c.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Linha Telefônica a Associar (Opcional)
                  </label>
                  <select
                    value={entregaLineId}
                    onChange={(e) => setEntregaLineId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-mono"
                  >
                    <option value="">Sem linha telefônica (apenas aparelho físico)</option>
                    {lines.filter(l => l.status === 'Disponível' || l.id === entregaLineId).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.phoneNumber} - {l.carrier} ({l.planName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Estado de Conservação Conferido na Entrega
                  </label>
                  <select
                    value={entregaCondition}
                    onChange={(e) => setEntregaCondition(e.target.value as DeviceCondition)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                  >
                    <option value="Novo">Novo (Na embalagem lacrada)</option>
                    <option value="Excelente">Excelente (Sem marcas de uso)</option>
                    <option value="Bom">Bom (Sinais leves)</option>
                    <option value="Regular">Regular (Desgaste aceitável)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Acessórios Inclusos no Kit
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    {COMMON_ACCESSORIES.map((acc) => (
                      <label key={acc} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={entregaAccessories.includes(acc)}
                          onChange={() => toggleAccessoryList(entregaAccessories, setEntregaAccessories, acc)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{acc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FLUXO 2: DEVOLUÇÃO */}
            {activeFlow === 'devolucao' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aparelho em Uso a ser Devolvido *
                  </label>
                  <select
                    value={devolucaoDeviceId}
                    onChange={(e) => handleDevolucaoDeviceChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o aparelho atualmente em uso --</option>
                    {inUseDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.assetTag} - {d.brand} {d.model} (Responsável: {d.currentCollaboratorName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Colaborador Responsável Identificado *
                  </label>
                  <select
                    value={devolucaoCollabId}
                    onChange={(e) => setDevolucaoCollabId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o colaborador --</option>
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.registrationNumber}) · {c.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Estado de Conservação na Devolução *
                    </label>
                    <select
                      value={devolucaoCondition}
                      onChange={(e) => setDevolucaoCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    >
                      <option value="Excelente">Excelente (Sem avarias)</option>
                      <option value="Bom">Bom (Sinais de uso normal)</option>
                      <option value="Regular">Regular (Desgaste acentuado)</option>
                      <option value="Danificado">Danificado (Necessita assistência técnica)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destino Operacional no Estoque *
                    </label>
                    <select
                      value={devolucaoDestinoEstoque}
                      onChange={(e) => setDevolucaoDestinoEstoque(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium"
                    >
                      <option value="Disponível">Disponível em estoque (Apto p/ nova entrega)</option>
                      <option value="Aguardando avaliação">Aguardando avaliação (Higienização/Vistoria)</option>
                      <option value="Em manutenção">Em manutenção (Encaminhar para assistência)</option>
                      <option value="Reservado">Reservado no estoque</option>
                      <option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial (Inutilizado)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tratamento da Linha Telefônica Vinculada
                  </label>
                  <select
                    value={devolucaoLineHandling}
                    onChange={(e) => setDevolucaoLineHandling(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                  >
                    <option value="retornar_ao_estoque">Desvincular e retornar linha ao estoque (Disponível)</option>
                    <option value="manter_com_colaborador">Manter a linha com o colaborador (BYOD / Linha ativa)</option>
                    <option value="desassociar_e_suspender">Desvincular e suspender a linha na operadora</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Acessórios Devolvidos ao Estoque
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    {COMMON_ACCESSORIES.map((acc) => (
                      <label key={acc} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={devolucaoAccessories.includes(acc)}
                          onChange={() => toggleAccessoryList(devolucaoAccessories, setDevolucaoAccessories, acc)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{acc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FLUXO 3: TRANSFERÊNCIA ENTRE COLABORADORES */}
            {activeFlow === 'transferencia' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p>
                    <strong>Regra Operacional Obrigatória:</strong> O aparelho será devolvido pelo Colaborador A ao Estoque do Gestor de Telefonia, passará por conferência e, caso esteja apto ("Disponível"), será entregue ao Colaborador B gerando ambos os termos formalmente relacionados.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. Colaborador de Origem (Cedente) *
                  </label>
                  <select
                    value={transfCollabAId}
                    onChange={(e) => handleTransfCollabAChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o colaborador cedente --</option>
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.registrationNumber}) · {c.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aparelho Identificado para Passagem por Estoque *
                  </label>
                  <select
                    value={transfDeviceId}
                    onChange={(e) => setTransfDeviceId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o aparelho --</option>
                    {inUseDevices.filter(d => !transfCollabAId || d.currentCollaboratorId === transfCollabAId).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.assetTag} - {d.brand} {d.model} (Responsável: {d.currentCollaboratorName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Estado de Conservação Conferido
                    </label>
                    <select
                      value={transfCondition}
                      onChange={(e) => setTransfCondition(e.target.value as DeviceCondition)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    >
                      <option value="Excelente">Excelente</option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Danificado">Danificado (Requer Manutenção)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Avaliação no Estoque do Gestor *
                    </label>
                    <select
                      value={transfDestinoEstoque}
                      onChange={(e) => setTransfDestinoEstoque(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium"
                    >
                      <option value="Disponível">Apto para entrega imediata ao Colaborador B</option>
                      <option value="Aguardando avaliação">Requer avaliação prévia (Interromper entrega ao Colab B)</option>
                      <option value="Em manutenção">Encaminhar para manutenção (Interromper entrega ao Colab B)</option>
                    </select>
                  </div>
                </div>

                {transfDestinoEstoque === 'Disponível' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. Colaborador de Destino (Novo Responsável) *
                    </label>
                    <select
                      value={transfCollabBId}
                      onChange={(e) => setTransfCollabBId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                      required
                    >
                      <option value="">-- Selecione o novo colaborador receptor --</option>
                      {collaborators.filter(c => c.id !== transfCollabAId && c.status !== 'Desligado').map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.registrationNumber}) · {c.department} - {c.position}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <strong>Atenção:</strong> Como o aparelho não foi considerado "Disponível", a segunda etapa (entrega ao colaborador B) será interrompida. O ativo retornará ao Estoque do Gestor de Telefonia com status <strong>{transfDestinoEstoque}</strong> para providências de TI.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Destinação da Linha Telefônica
                  </label>
                  <select
                    value={transfLineHandling}
                    onChange={(e) => setTransfLineHandling(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                  >
                    <option value="transferir_linha_junto">Transferir linha telefônica junto para o Colaborador B</option>
                    <option value="manter_linha_com_origem">Manter linha telefônica com o Colaborador A (origem)</option>
                    <option value="retornar_linha_ao_estoque">Desassociar linha e disponibilizá-la no estoque</option>
                  </select>
                </div>
              </div>
            )}

            {/* FLUXO 4: TROCA DE APARELHO */}
            {activeFlow === 'troca' && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <p>
                    <strong>Processo de Troca Patrimonial:</strong> O colaborador devolverá o aparelho antigo ao Estoque do Gestor de Telefonia e retirará um novo aparelho disponível em estoque.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Colaborador que Realizará a Troca *
                  </label>
                  <select
                    value={trocaCollabId}
                    onChange={(e) => handleTrocaCollabChange(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o colaborador --</option>
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.registrationNumber}) · {c.department}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-bloco Aparelho Antigo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Etapa 1: Aparelho Antigo (Devolução ao Estoque)
                  </span>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Aparelho Antigo Atual *
                    </label>
                    <select
                      value={trocaOldDeviceId}
                      onChange={(e) => setTrocaOldDeviceId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                      required
                    >
                      <option value="">-- Selecione o aparelho em uso --</option>
                      {inUseDevices.filter(d => !trocaCollabId || d.currentCollaboratorId === trocaCollabId).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.assetTag} - {d.brand} {d.model} (Responsável: {d.currentCollaboratorName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Estado do Aparelho Antigo
                      </label>
                      <select
                        value={trocaOldCondition}
                        onChange={(e) => setTrocaOldCondition(e.target.value as DeviceCondition)}
                        className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800"
                      >
                        <option value="Bom">Bom</option>
                        <option value="Regular">Regular</option>
                        <option value="Danificado">Danificado</option>
                        <option value="Excelente">Excelente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Destino do Aparelho Antigo no Estoque
                      </label>
                      <select
                        value={trocaOldDestinoEstoque}
                        onChange={(e) => setTrocaOldDestinoEstoque(e.target.value as any)}
                        className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800"
                      >
                        <option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option>
                        <option value="Em manutenção">Em manutenção (Assistência técnica)</option>
                        <option value="Disponível">Disponível em estoque</option>
                        <option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sub-bloco Novo Aparelho */}
                <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-lg space-y-2">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Etapa 2: Novo Aparelho (Entrega do Estoque Disponível)
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Novo Aparelho a ser Entregue *
                    </label>
                    <select
                      value={trocaNewDeviceId}
                      onChange={(e) => setTrocaNewDeviceId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                      required
                    >
                      <option value="">-- Selecione um aparelho disponível em estoque --</option>
                      {availableStockDevices.filter(d => d.id !== trocaOldDeviceId).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.assetTag} - {d.brand} {d.model} (S/N: {d.serialNumber} | IMEI: {d.imei1}) [{d.condition}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Destinação da Linha Telefônica
                    </label>
                    <select
                      value={trocaLineOption}
                      onChange={(e) => setTrocaLineOption(e.target.value as any)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    >
                      <option value="manter_linha_atual_no_novo">Manter linha telefônica atual do colaborador no novo aparelho</option>
                      <option value="selecionar_outra_linha">Selecionar outra linha do estoque</option>
                      <option value="sem_linha">Novo aparelho sem linha associada</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Observações Técnicas / Motivação Adicional
              </label>
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Detalhes adicionais para registro no histórico patrimonial..."
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <span>Revisar Operação</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          /* 4. TELA DE RESUMO PARA CONFERÊNCIA OBRIGATÓRIA ANTES DE CONFIRMAR */
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Conferência do Fluxo Patrimonial
                </h4>
              </div>

              {activeFlow === 'entrega' && selEntregaDev && selEntregaCollab && (
                <div className="space-y-2 text-xs">
                  <p><span className="text-slate-500">Operação:</span> <strong className="text-slate-900">Entrega de Dispositivo</strong></p>
                  <p><span className="text-slate-500">Origem:</span> <strong>{STOCK_LABEL} (Disponível)</strong></p>
                  <p><span className="text-slate-500">Destino:</span> <strong className="text-blue-700">{selEntregaCollab.fullName}</strong> ({selEntregaCollab.department} - Mat: {selEntregaCollab.registrationNumber})</p>
                  <p><span className="text-slate-500">Aparelho:</span> <strong className="font-mono">{selEntregaDev.assetTag}</strong> - {selEntregaDev.brand} {selEntregaDev.model} (IMEI: {selEntregaDev.imei1})</p>
                  <p><span className="text-slate-500">Estado de Conservação:</span> <strong>{entregaCondition}</strong></p>
                  <p><span className="text-slate-500">Documento a Gerar:</span> <strong className="text-teal-700 font-mono">Termo de Entrega Oficial</strong></p>
                </div>
              )}

              {activeFlow === 'devolucao' && selDevolucaoDev && selDevolucaoCollab && (
                <div className="space-y-2 text-xs">
                  <p><span className="text-slate-500">Operação:</span> <strong className="text-slate-900">Devolução de Dispositivo</strong></p>
                  <p><span className="text-slate-500">Origem:</span> <strong className="text-blue-700">{selDevolucaoCollab.fullName}</strong> ({selDevolucaoCollab.department})</p>
                  <p><span className="text-slate-500">Destino:</span> <strong className="text-slate-900">{STOCK_LABEL}</strong> (Status no estoque: <strong>{devolucaoDestinoEstoque}</strong>)</p>
                  <p><span className="text-slate-500">Aparelho:</span> <strong className="font-mono">{selDevolucaoDev.assetTag}</strong> - {selDevolucaoDev.brand} {selDevolucaoDev.model}</p>
                  <p><span className="text-slate-500">Estado na Devolução:</span> <strong>{devolucaoCondition}</strong></p>
                  <p><span className="text-slate-500">Documento a Gerar:</span> <strong className="text-teal-700 font-mono">Termo de Devolução e Quitação de Guarda</strong></p>
                </div>
              )}

              {activeFlow === 'transferencia' && selTransfCollabA && selTransfDev && (
                <div className="space-y-2 text-xs">
                  <p><span className="text-slate-500">Operação:</span> <strong className="text-slate-900">Transferência entre Colaboradores</strong></p>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                    <p className="font-semibold text-slate-800">Etapa 1 (Devolução ao Estoque):</p>
                    <p className="text-[11px] text-slate-600">Devolução de <strong>{selTransfCollabA.fullName}</strong> para <strong>{STOCK_LABEL}</strong> com status <strong>{transfDestinoEstoque}</strong>.</p>
                  </div>
                  {transfDestinoEstoque === 'Disponível' && selTransfCollabB ? (
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                      <p className="font-semibold text-slate-800">Etapa 2 (Entrega do Estoque):</p>
                      <p className="text-[11px] text-slate-600">Entrega liberada do <strong>{STOCK_LABEL}</strong> para <strong>{selTransfCollabB.fullName}</strong>.</p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                      O aparelho requer avaliação/reparo e ficará no Estoque do Gestor. A entrega subsequente não será executada de imediato.
                    </div>
                  )}
                  <p><span className="text-slate-500">Aparelho:</span> <strong className="font-mono">{selTransfDev.assetTag}</strong> ({selTransfDev.brand} {selTransfDev.model})</p>
                </div>
              )}

              {activeFlow === 'troca' && selTrocaCollab && selTrocaOldDev && selTrocaNewDev && (
                <div className="space-y-2 text-xs">
                  <p><span className="text-slate-500">Operação:</span> <strong className="text-slate-900">Troca de Dispositivo</strong></p>
                  <p><span className="text-slate-500">Colaborador:</span> <strong>{selTrocaCollab.fullName}</strong> ({selTrocaCollab.department})</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 bg-white border border-slate-200 rounded text-[11px]">
                      <span className="font-bold text-rose-800 block">Devolve ao Estoque:</span>
                      <span className="font-mono">{selTrocaOldDev.assetTag}</span> ({selTrocaOldDev.model})
                      <span className="block text-slate-500">Destino: {trocaOldDestinoEstoque}</span>
                    </div>
                    <div className="p-2 bg-white border border-slate-200 rounded text-[11px]">
                      <span className="font-bold text-emerald-800 block">Recebe do Estoque:</span>
                      <span className="font-mono">{selTrocaNewDev.assetTag}</span> ({selTrocaNewDev.model})
                      <span className="block text-slate-500">Condição: {trocaNewCondition}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmOperation}
                className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar e Registrar Operação Oficial</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { PhoneLine, Carrier, LineStatus } from '../../types';
import { dataService } from '../../services/dataStorage';
import { todayISO } from '../../utils/dates';
import { AlertTriangle, PhoneCall } from 'lucide-react';

interface LineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lineToEdit?: PhoneLine | null;
}

const CARRIERS: Carrier[] = ['Vivo', 'Claro', 'TIM', 'Outra'];
const DEPARTMENTS = ['Comercial', 'Operações', 'Logística', 'TI', 'Diretoria', 'Financeiro', 'RH', 'Engenharia', 'Geral'];

export const LineModal: React.FC<LineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lineToEdit,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carrier, setCarrier] = useState<Carrier>('Vivo');
  const [planName, setPlanName] = useState('Vivo Empresa Smart 50GB');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [status, setStatus] = useState<LineStatus>('Disponível');
  const [department, setDepartment] = useState('');
  const [activationDate, setActivationDate] = useState('');
  const [iccid, setIccid] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      if (lineToEdit) {
        setPhoneNumber(lineToEdit.phoneNumber);
        setCarrier(lineToEdit.carrier);
        setPlanName(lineToEdit.planName);
        setMonthlyCost(lineToEdit.monthlyCost ? String(lineToEdit.monthlyCost) : '');
        setStatus(lineToEdit.status);
        setDepartment(lineToEdit.department || '');
        setActivationDate(lineToEdit.activationDate || '');
        setIccid(lineToEdit.iccid || '');
        setNotes(lineToEdit.notes || '');
      } else {
        setPhoneNumber('');
        setCarrier('Vivo');
        setPlanName('Plano Corporativo 40GB');
        setMonthlyCost('69.90');
        setStatus('Disponível');
        setDepartment('');
        setActivationDate(todayISO());
        setIccid('');
        setNotes('');
      }
    }
  }, [isOpen, lineToEdit]);

  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 2) {
      formatted = `(${clean.slice(0, 2)}) ` + clean.slice(2);
    }
    if (clean.length > 7) {
      formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
    }
    setPhoneNumber(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, '').length < 10) {
      setErrorMessage('Informe um número de telefone válido com DDD (mínimo 10 a 11 dígitos).');
      return;
    }
    if (!planName.trim()) {
      setErrorMessage('Informe o nome do plano contratado com a operadora.');
      return;
    }

    const payload: Partial<PhoneLine> & { id?: string } = {
      id: lineToEdit?.id,
      phoneNumber: phoneNumber.trim(),
      carrier,
      planName: planName.trim(),
      monthlyCost: monthlyCost ? parseFloat(monthlyCost) : undefined,
      status,
      department: department || undefined,
      activationDate: activationDate || undefined,
      iccid: iccid.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const res = dataService.saveLine(payload);
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lineToEdit ? `Editar Linha: ${lineToEdit.phoneNumber}` : 'Cadastrar Nova Linha Telefônica'}
      subtitle="Gerenciamento de chip SIM, plano de dados e operadora"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Número Telefônico *
            </label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(11) 98765-4321"
              maxLength={15}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Operadora *
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as Carrier)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Plano Corporativo Contratado *
            </label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Ex: Total 50GB + Voz Ilimitada"
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Custo Mensal Contratado (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={monthlyCost}
              onChange={(e) => setMonthlyCost(e.target.value)}
              placeholder="Ex: 79.90"
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Status da Linha *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LineStatus)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500 font-medium"
            >
              <option value="Disponível">Disponível (Pronta para uso)</option>
              <option value="Ativa">Ativa (Em uso por colaborador)</option>
              <option value="Suspensa">Suspensa (Temporária)</option>
              <option value="Em processo de cancelamento">Em processo de cancelamento</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Departamento
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            >
              <option value="">-- Não especificado / Pool --</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Data de Ativação
            </label>
            <input
              type="date"
              value={activationDate}
              onChange={(e) => setActivationDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              ICCID do Cartão SIM (Chip)
            </label>
            <input
              type="text"
              value={iccid}
              onChange={(e) => setIccid(e.target.value.replace(/\D/g, ''))}
              placeholder="20 dígitos numéricos do chip"
              maxLength={22}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">
            Observações
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações contratuais, franquias especiais, roaming..."
            className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{lineToEdit ? 'Salvar Linha' : 'Cadastrar Linha'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

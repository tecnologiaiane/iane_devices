import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Device, DeviceCondition, DeviceStatus } from '../../types';
import { dataService } from '../../services/dataStorage';
import { todayISO } from '../../utils/dates';
import { AlertTriangle, Smartphone } from 'lucide-react';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deviceToEdit?: Device | null;
}

const BRANDS = ['Samsung', 'Apple', 'Motorola', 'Xiaomi', 'Asus', 'Outra'];
const DEPARTMENTS = ['Comercial', 'Operações', 'Logística', 'TI', 'Diretoria', 'Financeiro', 'RH', 'Engenharia', 'Geral'];

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deviceToEdit,
}) => {
  const [assetTag, setAssetTag] = useState('');
  const [brand, setBrand] = useState('Samsung');
  const [model, setModel] = useState('');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseValue, setPurchaseValue] = useState('');
  const [condition, setCondition] = useState<DeviceCondition>('Excelente');
  const [status, setStatus] = useState<DeviceStatus>('Disponível');
  const [currentDepartment, setCurrentDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      if (deviceToEdit) {
        setAssetTag(deviceToEdit.assetTag);
        setBrand(deviceToEdit.brand);
        setModel(deviceToEdit.model);
        setImei1(deviceToEdit.imei1 || '');
        setImei2(deviceToEdit.imei2 || '');
        setSerialNumber(deviceToEdit.serialNumber || '');
        setPurchaseDate(deviceToEdit.purchaseDate || '');
        setPurchaseValue(deviceToEdit.purchaseValue ? String(deviceToEdit.purchaseValue) : '');
        setCondition(deviceToEdit.condition);
        setStatus(deviceToEdit.status);
        setCurrentDepartment(deviceToEdit.currentDepartment || '');
        setNotes(deviceToEdit.notes || '');
      } else {
        // Auto-generate tag suggestion
        const currentCount = dataService.getDevices().length;
        setAssetTag(`CEL-${String(currentCount + 1).padStart(3, '0')}`);
        setBrand('Samsung');
        setModel('');
        setImei1('');
        setImei2('');
        setSerialNumber('');
        setPurchaseDate(todayISO());
        setPurchaseValue('');
        setCondition('Novo');
        setStatus('Disponível');
        setCurrentDepartment('');
        setNotes('');
      }
    }
  }, [isOpen, deviceToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!assetTag.trim()) {
      setErrorMessage('Informe o identificador do ativo (ex: CEL-001).');
      return;
    }
    if (!model.trim()) {
      setErrorMessage('Informe o modelo do aparelho (ex: Galaxy S23 128GB).');
      return;
    }
    // IMEI e Número de Série não são obrigatórios conforme solicitado
    if (imei1.trim() && imei1.trim().length > 0 && !/^\d{14,17}$/.test(imei1.trim())) {
      setErrorMessage('Caso informado, o IMEI 1 deve conter apenas números com 14 a 17 dígitos.');
      return;
    }
    if (imei2.trim() && imei2.trim().length > 0 && !/^\d{14,17}$/.test(imei2.trim())) {
      setErrorMessage('Caso informado, o IMEI 2 deve conter apenas números com 14 a 17 dígitos.');
      return;
    }

    const payload: Partial<Device> & { id?: string } = {
      id: deviceToEdit?.id,
      assetTag: assetTag.trim().toUpperCase(),
      brand,
      model: model.trim(),
      imei1: imei1.trim() || '',
      imei2: imei2.trim() || undefined,
      serialNumber: serialNumber.trim().toUpperCase() || '',
      purchaseDate: purchaseDate || undefined,
      purchaseValue: purchaseValue ? parseFloat(purchaseValue) : undefined,
      condition,
      status: deviceToEdit ? status : (status || 'Disponível'),
      currentDepartment: currentDepartment || undefined,
      notes: notes.trim() || undefined,
    };

    const res = dataService.saveDevice(payload);
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
      title={deviceToEdit ? `Editar Aparelho: ${deviceToEdit.assetTag}` : 'Cadastrar Novo Aparelho Celular'}
      subtitle="Registro patrimonial de smartphone corporativo"
      maxWidth="xl"
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
              Identificador do Ativo (Tag) *
            </label>
            <input
              type="text"
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
              placeholder="Ex: CEL-015"
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500 uppercase"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Marca do Fabricante *
            </label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-700 mb-1">
            Modelo e Capacidade de Armazenamento *
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Ex: Galaxy A54 5G 128GB Grafite, iPhone 14 128GB"
            className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              IMEI 1 (Principal)
            </label>
            <input
              type="text"
              value={imei1}
              onChange={(e) => setImei1(e.target.value.replace(/\D/g, ''))}
              placeholder="Opcional - 14 a 17 dígitos"
              maxLength={17}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              IMEI 2 (Secundário / eSIM)
            </label>
            <input
              type="text"
              value={imei2}
              onChange={(e) => setImei2(e.target.value.replace(/\D/g, ''))}
              placeholder="Opcional"
              maxLength={17}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Número de Série (S/N)
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              placeholder="Opcional"
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Estado de Conservação
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as DeviceCondition)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            >
              <option value="Novo">Novo (Na caixa / Sem uso)</option>
              <option value="Excelente">Excelente (Sem arranhões)</option>
              <option value="Bom">Bom (Sinais leves)</option>
              <option value="Regular">Regular (Desgaste natural)</option>
              <option value="Danificado">Danificado (Avariado)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Data de Aquisição
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Valor de Aquisição (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={purchaseValue}
              onChange={(e) => setPurchaseValue(e.target.value)}
              placeholder="Ex: 2499.00"
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Status do Ativo
            </label>
            <select
              value={status}
              disabled={deviceToEdit?.status === 'Em uso'}
              onChange={(e) => setStatus(e.target.value as DeviceStatus)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500 disabled:bg-ink-100"
            >
              <option value="Disponível">Disponível em estoque</option>
              <option value="Aguardando avaliação">Aguardando avaliação (Estoque)</option>
              <option value="Em manutenção">Em manutenção</option>
              <option value="Reservado">Reservado no estoque</option>
              <option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial</option>
              <option value="Extraviado">Extraviado</option>
              <option value="Baixado">Baixado definitivamente</option>
              {deviceToEdit?.status === 'Em uso' && (
                <option value="Em uso">Em uso (Vínculo ativo com colaborador)</option>
              )}
            </select>
            {deviceToEdit?.status === 'Em uso' && (
              <p className="text-[10px] text-gold-700 mt-0.5">
                Para alterar status de aparelho "Em uso", realize a movimentação de Devolução.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Departamento Destinado
            </label>
            <select
              value={currentDepartment}
              onChange={(e) => setCurrentDepartment(e.target.value)}
              className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            >
              <option value="">-- Não especificado / Pool Geral --</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">
            Observações Técnicas / Patrimoniais
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Acessórios inclusos, histórico de notas fiscais, restrições operacionais..."
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
            <Smartphone className="w-3.5 h-3.5" />
            <span>{deviceToEdit ? 'Salvar Alterações' : 'Cadastrar Aparelho'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

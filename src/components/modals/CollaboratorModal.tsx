import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Collaborator, CollaboratorStatus } from '../../types';
import { dataService } from '../../services/dataStorage';
import { AlertTriangle, UserPlus } from 'lucide-react';

interface CollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  collaboratorToEdit?: Collaborator | null;
}

const DEPARTMENTS = ['Comercial', 'Operações', 'Logística', 'TI', 'Diretoria', 'Financeiro', 'RH', 'Engenharia', 'Jurídico', 'Suprimentos'];

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  collaboratorToEdit,
}) => {
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [department, setDepartment] = useState('Comercial');
  const [position, setPosition] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [status, setStatus] = useState<CollaboratorStatus>('Ativo');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      if (collaboratorToEdit) {
        setFullName(collaboratorToEdit.fullName);
        setRegistrationNumber(collaboratorToEdit.registrationNumber);
        setDepartment(collaboratorToEdit.department);
        setPosition(collaboratorToEdit.position);
        setCorporateEmail(collaboratorToEdit.corporateEmail);
        setContactPhone(collaboratorToEdit.contactPhone || '');
        setCpf(collaboratorToEdit.cpf || '');
        setStatus(collaboratorToEdit.status);
        setNotes(collaboratorToEdit.notes || '');
      } else {
        const count = dataService.getCollaborators().length;
        setFullName('');
        setRegistrationNumber(`MAT-${1000 + count * 15 + Math.floor(Math.random() * 10)}`);
        setDepartment('Comercial');
        setPosition('');
        setCorporateEmail('');
        setContactPhone('');
        setCpf('');
        setStatus('Ativo');
        setNotes('');
      }
    }
  }, [isOpen, collaboratorToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Informe o nome completo do colaborador.');
      return;
    }
    if (!registrationNumber.trim()) {
      setErrorMessage('Informe o número de matrícula ou identificador interno.');
      return;
    }
    if (!position.trim()) {
      setErrorMessage('Informe o cargo ou função do colaborador.');
      return;
    }
    if (!corporateEmail.trim() || !corporateEmail.includes('@')) {
      setErrorMessage('Informe um e-mail corporativo válido.');
      return;
    }

    const payload: Partial<Collaborator> & { id?: string } = {
      id: collaboratorToEdit?.id,
      fullName: fullName.trim(),
      registrationNumber: registrationNumber.trim().toUpperCase(),
      department,
      position: position.trim(),
      corporateEmail: corporateEmail.trim().toLowerCase(),
      contactPhone: contactPhone.trim() || undefined,
      cpf: cpf.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
    };

    const res = dataService.saveCollaborator(payload);
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
      title={collaboratorToEdit ? `Editar Colaborador: ${collaboratorToEdit.fullName}` : 'Cadastrar Novo Colaborador'}
      subtitle="Cadastro de colaboradores para custódia e uso de ativos corporativos"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Carlos Eduardo Mendes"
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Matrícula / ID Interno *
            </label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              placeholder="Ex: MAT-1024"
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Departamento / Área *
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cargo / Função *
            </label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex: Gerente Regional de Vendas"
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Corporativo *
            </label>
            <input
              type="email"
              value={corporateEmail}
              onChange={(e) => setCorporateEmail(e.target.value)}
              placeholder="nome.sobrenome@empresa.com.br"
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Telefone de Contato Alternativo
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(11) 99999-0000"
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              CPF (Para qualificação no Termo)
            </label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status do Colaborador *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CollaboratorStatus)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Ativo">Ativo (Em atividade regular)</option>
              <option value="Férias">Férias</option>
              <option value="Afastado">Afastado (Licença)</option>
              <option value="Desligado">Desligado da Empresa</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Observações
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações adicionais de lotação ou histórico..."
            className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{collaboratorToEdit ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

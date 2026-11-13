import React, { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { Catalogs, Collaborator, CollaboratorStatus } from '../../types'
import { dataService } from '../../services/dataStorage'
import { SearchableOption, SearchableSelect } from '../SearchableSelect'
import { AlertTriangle, UserPlus } from 'lucide-react'
import { Button } from '../button'

interface CollaboratorModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess: () => void
	collaboratorToEdit?: Collaborator | null
}

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
	isOpen,
	onClose,
	onSuccess,
	collaboratorToEdit,
}) => {
	const [fullName, setFullName] = useState('')
	const [registrationNumber, setRegistrationNumber] = useState('')
	const [department, setDepartment] = useState(dataService.getCatalogs().departments[0]?.name || '')
	const [sector, setSector] = useState(dataService.getCatalogs().sectors[0]?.name || '')
	const [unit, setUnit] = useState('')
	const [position, setPosition] = useState('')
	const [corporateEmail, setCorporateEmail] = useState('')
	const [contactPhone, setContactPhone] = useState('')
	const [cpf, setCpf] = useState('')
	const [status, setStatus] = useState<CollaboratorStatus>('Ativo')
	const [notes, setNotes] = useState('')
	const [errorMessage, setErrorMessage] = useState('')
	const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs())

	useEffect(() => {
		if (isOpen) void dataService.fetchCatalogs().then((loaded) => {
			setCatalogs(loaded)
			if (!collaboratorToEdit) {
				setDepartment(loaded.departments[0]?.name || '')
				setSector(loaded.sectors[0]?.name || '')
			}
		})
	}, [isOpen])

	useEffect(() => {
		if (isOpen) {
			setErrorMessage('')
			if (collaboratorToEdit) {
				setFullName(collaboratorToEdit.fullName)
				setRegistrationNumber(collaboratorToEdit.registrationNumber)
				setDepartment(collaboratorToEdit.department)
				setSector(collaboratorToEdit.sector || catalogs.sectors[0]?.name || '')
				setUnit(collaboratorToEdit.unit || '')
				setPosition(collaboratorToEdit.position)
				setCorporateEmail(collaboratorToEdit.corporateEmail)
				setContactPhone(collaboratorToEdit.contactPhone || '')
				setCpf(collaboratorToEdit.cpf || '')
				setStatus(collaboratorToEdit.status)
				setNotes(collaboratorToEdit.notes || '')
			} else {
				const count = dataService.getCollaborators().length
				setFullName('')
				setRegistrationNumber(`MAT-${1000 + count * 15 + Math.floor(Math.random() * 10)}`)
				setDepartment(catalogs.departments[0]?.name || '')
				setSector(catalogs.sectors[0]?.name || '')
				setUnit('')
				setPosition('')
				setCorporateEmail('')
				setContactPhone('')
				setCpf('')
				setStatus('Ativo')
				setNotes('')
			}
		}
	}, [isOpen, collaboratorToEdit])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		setErrorMessage('')

		if (!fullName.trim()) {
			setErrorMessage('Informe o nome completo do colaborador.')
			return
		}
		if (corporateEmail.trim() && !corporateEmail.includes('@')) {
			setErrorMessage('Informe um e-mail válido.')
			return
		}

		const payload: Partial<Collaborator> & { id?: string } = {
			id: collaboratorToEdit?.id,
			fullName: fullName.trim(),
			registrationNumber: registrationNumber.trim().toUpperCase(),
			department,
			sector,
			unit: unit || undefined,
			position: position.trim(),
			corporateEmail: corporateEmail.trim().toLowerCase(),
			contactPhone: contactPhone.trim() || undefined,
			cpf: cpf.trim() || undefined,
			status,
			notes: notes.trim() || undefined,
		}

		const res = dataService.saveCollaborator(payload)
		if (!res.success) {
			setErrorMessage(res.message)
			return
		}

		onSuccess()
		onClose()
	}

	const catalogOptions = (items: Catalogs['departments'], current: string): SearchableOption[] => {
		const values = [...items]
		if (current && !values.some((item) => item.name === current)) values.push({ id: `legacy-${current}`, name: current })
		return values.map((item) => ({ value: item.name, label: item.name }))
	}

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
					<div className="p-3 radius-base border border-status-danger-border bg-status-danger-bg text-xs text-status-danger-fg flex items-start gap-2">
						<AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0 mt-0.5" />
						<span>{errorMessage}</span>
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Nome Completo <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<input
							type="text"
							value={fullName}
							onChange={(e) => setFullName(e.target.value)}
							placeholder="Ex: Carlos Eduardo Mendes"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
							required
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Matrícula</label>
						<input
							type="text"
							value={registrationNumber}
							onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
							placeholder="Ex: MAT-1024"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 uppercase"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Departamento / Área <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<SearchableSelect value={department} onChange={setDepartment} options={catalogOptions(catalogs.departments, department)} placeholder="Selecione o departamento" />
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Setor <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<SearchableSelect value={sector} onChange={setSector} options={catalogOptions(catalogs.sectors, sector)} placeholder="Selecione o setor" />
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Unidade</label>
						<SearchableSelect value={unit} onChange={setUnit} options={catalogOptions(catalogs.units, unit)} placeholder="Selecione a unidade (opcional)" />
					</div>
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Status do Colaborador <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<select
							value={status}
							onChange={(e) => setStatus(e.target.value as CollaboratorStatus)}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						>
							<option value="Ativo">Ativo (Em atividade regular)</option>
							<option value="Férias">Férias</option>
							<option value="Afastado">Afastado (Licença)</option>
							<option value="Desligado">Desligado da Empresa</option>
						</select>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Cargo / Função</label>
						<input
							type="text"
							value={position}
							onChange={(e) => setPosition(e.target.value)}
							placeholder="Ex: Gerente Regional de Vendas"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">E-mail</label>
						<input
							type="email"
							value={corporateEmail}
							onChange={(e) => setCorporateEmail(e.target.value)}
							placeholder="nome.sobrenome@empresa.com.br"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Telefone de Contato Alternativo</label>
						<input
							type="text"
							value={contactPhone}
							onChange={(e) => setContactPhone(e.target.value)}
							placeholder="(11) 99999-0000"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">CPF</label>
						<input
							type="text"
							value={cpf}
							onChange={(e) => setCpf(e.target.value)}
							placeholder="000.000.000-00"
							maxLength={14}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>
				</div>

				<div>
					<label className="block text-xs font-medium text-text-muted mb-1.5">Observações</label>
					<textarea
						rows={2}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Informações adicionais de lotação ou histórico..."
						className="w-full h-24 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 resize-none"
					/>
				</div>

				<div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancelar
					</Button>
					<Button type="submit" size="sm" className="flex items-center gap-1.5">
						<UserPlus className="w-3.5 h-3.5" />
						<span>{collaboratorToEdit ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</span>
					</Button>
				</div>
			</form>
		</Modal>
	)
}

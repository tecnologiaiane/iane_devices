import React, { useState, useEffect } from 'react'
import { Modal } from '../Modal'
import { Catalogs, Device, DeviceCondition, DeviceStatus } from '../../types'
import { dataService } from '../../services/dataStorage'
import { todayISO } from '../../utils/dates'
import { SearchableOption, SearchableSelect } from '../SearchableSelect'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../button'
import { Badge } from '../badge'

interface DeviceModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess: () => void
	deviceToEdit?: Device | null
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
	isOpen,
	onClose,
	onSuccess,
	deviceToEdit,
}) => {
	const [assetTag, setAssetTag] = useState('')
	const [brand, setBrand] = useState('')
	const [model, setModel] = useState('')
	const [imei1, setImei1] = useState('')
	const [imei2, setImei2] = useState('')
	const [serialNumber, setSerialNumber] = useState('')
	const [purchaseDate, setPurchaseDate] = useState('')
	const [purchaseValue, setPurchaseValue] = useState('')
	const [condition, setCondition] = useState<DeviceCondition>('Excelente')
	const [status, setStatus] = useState<DeviceStatus>(() =>
		dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível')
	)
	const [sector, setSector] = useState('')
	const [unit, setUnit] = useState('')
	const [currentDepartment, setCurrentDepartment] = useState('')
	const [notes, setNotes] = useState('')
	const [errorMessage, setErrorMessage] = useState('')
	const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs())

	useEffect(() => {
		if (isOpen) void dataService.fetchCatalogs().then((loaded) => {
			setCatalogs(loaded)
			if (!deviceToEdit) {
				if (!brand) setBrand(loaded.brands[0]?.name || '')
				setStatus(loaded.deviceStatuses.find((item) => item.id === 'device-status-available')?.name || 'Disponível')
			}
		})
	}, [isOpen])

	useEffect(() => {
		if (isOpen) {
			setErrorMessage('')
			if (deviceToEdit) {
				setAssetTag(deviceToEdit.assetTag)
				setBrand(deviceToEdit.brand)
				setModel(deviceToEdit.model)
				setImei1(deviceToEdit.imei1 || '')
				setImei2(deviceToEdit.imei2 || '')
				setSerialNumber(deviceToEdit.serialNumber || '')
				setPurchaseDate(deviceToEdit.purchaseDate || '')
				setPurchaseValue(deviceToEdit.purchaseValue ? String(deviceToEdit.purchaseValue) : '')
				setCondition(deviceToEdit.condition)
				setStatus(deviceToEdit.status)
				setSector(deviceToEdit.sector || '')
				setUnit(deviceToEdit.unit || '')
				setCurrentDepartment(deviceToEdit.currentDepartment || '')
				setNotes(deviceToEdit.notes || '')
			} else {
				const currentCount = dataService.getDevices().length
				setAssetTag(`CEL-${String(currentCount + 1).padStart(3, '0')}`)
				setBrand('')
				setModel('')
				setImei1('')
				setImei2('')
				setSerialNumber('')
				setPurchaseDate(todayISO())
				setPurchaseValue('')
				setCondition('Novo')
				setStatus(dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível'))
				setSector('')
				setUnit('')
				setCurrentDepartment('')
				setNotes('')
			}
		}
	}, [isOpen, deviceToEdit])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		setErrorMessage('')

		if (!assetTag.trim()) {
			setErrorMessage('Informe o identificador do ativo (ex: CEL-001).')
			return
		}
		if (!model.trim()) {
			setErrorMessage('Informe o modelo do aparelho (ex: Galaxy S23 128GB).')
			return
		}
		if (!brand.trim()) {
			setErrorMessage('Selecione o fabricante do aparelho.')
			return
		}
		const imeiDigits = imei1.replace(/\D/g, '')
		if (imeiDigits && !/^\d{14,17}$/.test(imeiDigits)) {
			setErrorMessage('Caso informado, o IMEI deve conter apenas números com 14 a 17 dígitos.')
			return
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
			sector: sector || undefined,
			unit: unit || undefined,
			currentDepartment: currentDepartment || undefined,
			notes: notes.trim() || undefined,
		}

		const res = dataService.saveDevice(payload)
		if (!res.success) {
			setErrorMessage(res.message)
			return
		}

		onSuccess()
		onClose()
	}

	const catalogOptions = (items: Catalogs['brands'], current: string): SearchableOption[] => {
		const values = [...items]
		if (current && !values.some((item) => item.name === current)) values.push({ id: `legacy-${current}`, name: current })
		return values.map((item) => ({ value: item.name, label: item.name }))
	}
	const deviceStatusOptions = [...catalogs.deviceStatuses]
	if (status && !deviceStatusOptions.some((item) => item.name === status)) deviceStatusOptions.push({ id: `legacy-${status}`, name: status })
	const inUseStatus = dataService.getCatalogStatus('deviceStatuses', 'device-status-in-use', 'Em uso')

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
					<div className="p-3 radius-base border border-status-danger-border bg-status-danger-bg text-xs text-status-danger-fg flex items-start gap-2">
						<AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0 mt-0.5" />
						<span>{errorMessage}</span>
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Identificador do Ativo (Tag) <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<input
							type="text"
							value={assetTag}
							onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
							placeholder="Ex: CEL-015"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 uppercase"
							required
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">
							Fabricante <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
						</label>
						<SearchableSelect value={brand} onChange={setBrand} options={catalogOptions(catalogs.brands, brand)} placeholder="Selecione a marca" />
					</div>
				</div>

				<div>
					<label className="block text-xs font-medium text-text-muted mb-1.5">
						Modelo <span className="text-status-danger-fg font-semibold ml-0.5">*</span>
					</label>
					<SearchableSelect value={model} onChange={setModel} options={catalogOptions(catalogs.models, model)} placeholder="Selecione o modelo" />
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">IMEI</label>
						<input
							type="text"
							value={imei1}
							onChange={(e) => setImei1(e.target.value.replace(/\D/g, ''))}
							placeholder="Opcional - 14 a 17 dígitos"
							maxLength={17}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>
				</div>

				<div>
					<label className="block text-xs font-medium text-text-muted mb-1.5">Setor</label>
					<SearchableSelect value={sector} onChange={setSector} options={catalogOptions(catalogs.sectors, sector)} placeholder="Não especificado" />
				</div>

				<div>
					<label className="block text-xs font-medium text-text-muted mb-1.5">Unidade</label>
					<SearchableSelect value={unit} onChange={setUnit} options={catalogOptions(catalogs.units, unit)} placeholder="Selecione a unidade (opcional)" />
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Estado de Conservação</label>
						<select
							value={condition}
							onChange={(e) => setCondition(e.target.value as DeviceCondition)}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
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
						<label className="block text-xs font-medium text-text-muted mb-1.5">Data de Aquisição</label>
						<input
							type="date"
							value={purchaseDate}
							onChange={(e) => setPurchaseDate(e.target.value)}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Valor de Aquisição (R$)</label>
						<input
							type="number"
							step="0.01"
							value={purchaseValue}
							onChange={(e) => setPurchaseValue(e.target.value)}
							placeholder="Ex: 2499.00"
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Status do Ativo</label>
						<select
							value={status}
							disabled={deviceToEdit?.status === inUseStatus}
							onChange={(e) => setStatus(e.target.value as DeviceStatus)}
							className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 disabled:bg-surface-subtle"
						>
							{deviceStatusOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
						</select>
						{deviceToEdit?.status === inUseStatus && (
							<p className="text-[10px] text-status-warning-fg mt-1 font-medium">
								Para alterar status de aparelho "Em uso", realize a movimentação de Devolução.
							</p>
						)}
					</div>

					<div>
						<label className="block text-xs font-medium text-text-muted mb-1.5">Departamento Destinado</label>
						<SearchableSelect value={currentDepartment} onChange={setCurrentDepartment} options={catalogOptions(catalogs.departments, currentDepartment)} placeholder="Não especificado / Pool Geral" />
					</div>
				</div>

				<div>
					<label className="block text-xs font-medium text-text-muted mb-1.5">Observações Técnicas / Patrimoniais</label>
					<textarea
						rows={2}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Acessórios inclusos, histórico de notas fiscais, restrições operacionais..."
						className="w-full h-24 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 resize-none"
					/>
				</div>

				<div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancelar
					</Button>
					<Button type="submit" size="sm">
						{deviceToEdit ? 'Salvar Alterações' : 'Cadastrar'}
					</Button>
				</div>
			</form>
		</Modal>
	)
}

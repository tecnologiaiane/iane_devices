import React, { useEffect, useRef, useState } from 'react'
import {
	LayoutDashboard,
	Smartphone,
	PhoneCall,
	Users,
	ArrowLeftRight,
	ClipboardList,
	FileText,
	BarChart3,
	Settings,
	X,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	LogOut,
	UserRound,
	Search,
	Megaphone,
	Sparkles,
	Moon,
	Sun,
} from 'lucide-react'

export type NavTab =
	| 'dashboard'
	| 'dispositivos'
	| 'linhas'
	| 'colaboradores'
	| 'movimentacoes'
	| 'solicitacoes'
	| 'termos'
	| 'relatorios'
	| 'configuracoes'

import { User as UserType } from '../types'
import { canAccessRequests } from '../config/requestAccess'
import { Button } from './button'
import { cn } from '../lib/utils'

interface SidebarProps {
	activeTab: NavTab
	onSelectTab: (tab: NavTab) => void
	pendingTermsCount: number
	maintenanceCount: number
	currentUser?: UserType | null
	onLogout?: () => void
	isCollapsed: boolean
	onToggleCollapse: () => void
	theme: 'light' | 'dark'
	onToggleTheme: () => void
	isMobileViewport: boolean
	isMobileOpen: boolean
	onCloseMobile: () => void
}

interface NavItem {
	id: NavTab
	label: string
	icon: React.ElementType
	badge?: number
}

const ROLE_LABELS: Record<string, string> = {
	admin: 'Administrador',
	gestor: 'Gestor de Telefonia',
	operador: 'Operador de TI/RH',
	visualizador: 'Visualizador',
}

const NOVIDADES = [
	'Menu lateral fixo, com busca rápida entre os módulos.',
	'Configurações organizadas em seções recolhíveis.',
	'Backup automático do banco com cópias para download.',
]

/** Agrupamentos do menu. Rótulos e rotas continuam exatamente os mesmos. */
const NAV_SECTIONS: { title: string; ids: NavTab[] }[] = [
	{ title: 'Visão geral', ids: ['dashboard'] },
	{
		title: 'Gestão de ativos',
		ids: ['dispositivos', 'linhas', 'colaboradores', 'movimentacoes', 'solicitacoes', 'termos'],
	},
	{ title: 'Análise', ids: ['relatorios'] },
	{ title: 'Sistema', ids: ['configuracoes'] },
]

/** Remove acentos e caixa para a busca do menu */
const normalize = (value: string) =>
	value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()

export const Sidebar: React.FC<SidebarProps> = ({
	activeTab,
	onSelectTab,
	pendingTermsCount,
	maintenanceCount,
	currentUser,
	onLogout,
	isCollapsed,
	onToggleCollapse,
	theme,
	onToggleTheme,
	isMobileViewport,
	isMobileOpen,
	onCloseMobile,
}) => {
	const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
	const [isNewsOpen, setIsNewsOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')

	const userMenuRef = useRef<HTMLDivElement>(null)
	const newsRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const shouldFocusSearchRef = useRef(false)

	const isExpanded = !isCollapsed
	// No painel móvel os rótulos sempre aparecem; o recolhimento é só para desktop.
	const showLabels = isMobileViewport || isExpanded

	// Fecha os popovers ao clicar fora ou pressionar Esc
	useEffect(() => {
		if (!isUserMenuOpen && !isNewsOpen) return

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node
			if (userMenuRef.current && !userMenuRef.current.contains(target)) {
				setIsUserMenuOpen(false)
			}
			if (newsRef.current && !newsRef.current.contains(target)) {
				setIsNewsOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsUserMenuOpen(false)
				setIsNewsOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isUserMenuOpen, isNewsOpen])

	// Ao recolher a barra, fecha popovers e limpa a busca
	useEffect(() => {
		setIsUserMenuOpen(false)
		setIsNewsOpen(false)
		if (isCollapsed) setSearchTerm('')
	}, [isCollapsed])

	// Foca a busca depois que a barra é expandida pelo ícone de pesquisa
	useEffect(() => {
		if (isExpanded && shouldFocusSearchRef.current) {
			shouldFocusSearchRef.current = false
			searchInputRef.current?.focus()
		}
	}, [isExpanded])

	const navItems: NavItem[] = [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{
			id: 'dispositivos',
			label: 'Dispositivos',
			icon: Smartphone,
			badge: maintenanceCount,
		},
		{ id: 'linhas', label: 'Linhas telefônicas', icon: PhoneCall },
		{ id: 'colaboradores', label: 'Colaboradores', icon: Users },
		{ id: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
		{ id: 'solicitacoes', label: 'Solicitações', icon: ClipboardList },
		{
			id: 'termos',
			label: 'Termos e documentos',
			icon: FileText,
			badge: pendingTermsCount,
		},
		{ id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
		{ id: 'configuracoes', label: 'Configurações', icon: Settings },
	]

	const userPerms = currentUser?.permissions || []
	const isAdmin = currentUser?.role === 'admin' || userPerms.includes('all')

	const permittedItems = navItems.filter((item) =>
		item.id === 'solicitacoes'
			? canAccessRequests(currentUser?.role)
			: isAdmin || userPerms.includes(item.id)
	)

	const term = normalize(searchTerm)
	const itemsById = new Map(permittedItems.map((item) => [item.id, item]))
	const filteredSections = NAV_SECTIONS.map((section) => ({
		title: section.title,
		items: section.ids
			.flatMap((id) => {
				const item = itemsById.get(id)
				return item ? [item] : []
			})
			.filter((item) => !term || normalize(item.label).includes(term)),
	})).filter((section) => section.items.length > 0)
	const filteredItems = filteredSections.flatMap((section) => section.items)

	const handleSelect = (tab: NavTab) => {
		onSelectTab(tab)
		onCloseMobile()
		setIsUserMenuOpen(false)
		setIsNewsOpen(false)
	}

	const handleSearchSubmit = (event: React.FormEvent) => {
		event.preventDefault()
		if (filteredItems.length > 0) handleSelect(filteredItems[0].id)
	}

	const handleExpandForSearch = () => {
		shouldFocusSearchRef.current = true
		onToggleCollapse()
	}

	const userFullName = currentUser?.fullName || 'Gestor de Ativos'
	const userEmail = currentUser?.email || currentUser?.username || 'tecnologia@iane.ind.br'
	const userRole = ROLE_LABELS[currentUser?.role || ''] || currentUser?.role || 'Usuário'
	const initials = (currentUser?.username || 'TI').slice(0, 2).toUpperCase()

	return (
		<>
			{/* Sidebar fixa em desktop; painel deslizante em telas pequenas */}
			<aside
				className={cn(
					'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-text-strong transition-[transform,width] duration-200 ease-in-out md:z-40 md:w-[var(--sidebar-width)]',
					isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
				)}
			>
				{!isMobileViewport && (
					<Button
						variant="secondary"
						size="sm"
						onClick={onToggleCollapse}
						title={isExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
						aria-label={isExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
						aria-expanded={isExpanded}
						className="absolute -right-3 top-20 z-50 hidden h-8 w-8 rounded-full border-sidebar-control-border bg-sidebar-surface p-0 text-sidebar-text-strong shadow-sm hover:bg-sidebar-active hover:text-sidebar-text-strong md:inline-flex"
					>
						{isExpanded ? (
							<ChevronLeft className="w-3.5 h-3.5" />
						) : (
							<ChevronRight className="w-3.5 h-3.5" />
						)}
					</Button>
				)}

				{/* Cabeçalho: marca e tema */}
				<div
					className={cn(
						'flex h-16 shrink-0 items-center border-b border-sidebar-border',
						showLabels ? 'gap-2.5 px-4' : 'justify-between gap-1 px-1'
					)}
				>
					<img
						src={showLabels ? '/logo.png' : '/favicon.png'}
						alt="IANE"
						className={cn('shrink-0 object-contain', showLabels ? 'h-8 w-auto' : 'h-7 w-7')}
					/>
					{showLabels && (
						<div className="flex flex-col min-w-0">
							<span className="font-display font-semibold text-sm tracking-tight text-sidebar-text-strong leading-tight truncate">
								IANE
							</span>
							<span className="text-[9px] text-sidebar-icon-accent font-semibold uppercase tracking-[0.14em] truncate">
								Gestão de Dispositivos
							</span>
						</div>
					)}
					<div className={cn('flex items-center gap-1', showLabels && 'ml-auto')}>
						<Button
							variant="ghost"
							size="sm"
							onClick={onToggleTheme}
							aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
							aria-pressed={theme === 'dark'}
							title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
							className={cn(
								'rounded-full border-transparent p-0 text-sidebar-icon-accent hover:bg-sidebar-hover hover:text-sidebar-text-strong',
								showLabels ? 'h-8 w-8' : 'h-7 w-7'
							)}
						>
							{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
						</Button>
						{isMobileViewport && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onCloseMobile}
								aria-label="Fechar menu lateral"
								className="h-8 w-8 rounded-full border-transparent p-0 text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong"
							>
								<X className="w-4 h-4" />
							</Button>
						)}
					</div>
				</div>

				{/* Busca no menu */}
				<div className={cn('shrink-0 pb-2', showLabels ? 'px-4' : 'px-2')}>
					{showLabels ? (
						<form onSubmit={handleSearchSubmit} className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-text pointer-events-none" />
							<input
								ref={searchInputRef}
								type="search"
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
								placeholder="Buscar..."
								aria-label="Buscar item do menu"
								className="h-10 w-full radius-base bg-sidebar-surface pl-9 pr-3 text-xs text-sidebar-text-strong placeholder:text-sidebar-text outline-none border border-transparent focus:border-sidebar-focus focus:ring-2 focus:ring-sidebar-focus/15 transition [&::-webkit-search-cancel-button]:hidden"
							/>
							{searchTerm && (
								<button
									type="button"
									onClick={() => {
										setSearchTerm('')
										searchInputRef.current?.focus()
									}}
									aria-label="Limpar busca"
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-sidebar-text hover:text-sidebar-text-strong cursor-pointer"
								>
									<X className="w-3 h-3" />
								</button>
							)}
						</form>
					) : (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleExpandForSearch}
							title="Buscar no menu"
							aria-label="Buscar no menu"
							className="mx-auto h-10 w-10 rounded-full border-transparent p-0 text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong"
						>
							<Search className="w-4 h-4" />
						</Button>
					)}
				</div>

				{/* Navegação agrupada por seção */}
				<nav aria-label="Menu principal" className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3', showLabels ? 'px-3' : 'px-2')}>
					<div className="space-y-3">
						{filteredSections.map((section) => (
							<div key={section.title}>
								{showLabels ? (
									<p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-title opacity-70">
										{section.title}
									</p>
								) : (
									<div className="mx-auto my-2 h-px w-8 bg-sidebar-border" aria-hidden="true" />
								)}
								<div className="space-y-1">
									{section.items.map((item) => {
										const Icon = item.icon
										const isActive = activeTab === item.id
										const badge = item.badge && item.badge > 0 ? item.badge : null

										return (
											<button
												key={item.id}
												type="button"
												onClick={() => handleSelect(item.id)}
												aria-label={showLabels ? undefined : item.label}
												aria-describedby={showLabels ? undefined : `nav-tooltip-${item.id}`}
												aria-current={isActive ? 'page' : undefined}
												className={cn(
													'group relative flex h-11 w-full items-center rounded-base text-[13px] transition-colors cursor-pointer',
													showLabels ? 'gap-3 px-4' : 'justify-center px-0',
													isActive
														? 'bg-sidebar-active font-semibold text-sidebar-text-strong shadow-sm'
														: 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong'
												)}
											>
												{isActive && (
													<span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-indicator" aria-hidden="true" />
												)}
												<Icon
													className={cn(
														'w-[18px] h-[18px] shrink-0 transition-colors',
														isActive ? 'text-sidebar-icon-accent' : 'text-sidebar-icon group-hover:text-sidebar-icon-accent'
													)}
												/>

												{showLabels && (
													<>
														<span className="truncate flex-1 text-left">{item.label}</span>
														{badge !== null && (
															<span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-sidebar-badge-bg text-sidebar-badge-text">
																{badge}
															</span>
														)}
													</>
												)}

												{!showLabels && badge !== null && (
													<span className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-sidebar-indicator" aria-hidden="true" />
												)}

												{!showLabels && (
													<span
														id={`nav-tooltip-${item.id}`}
														role="tooltip"
														className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap radius-base border border-sidebar-control-border bg-sidebar-surface px-2 py-1 text-[11px] text-sidebar-text-strong opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
													>
														{item.label}
													</span>
												)}
											</button>
										)
									})}
								</div>
							</div>
						))}

						{filteredItems.length === 0 && showLabels && (
							<p className="px-4 py-3 text-[11px] text-sidebar-text">
								Nenhum item encontrado para “{searchTerm}”.
							</p>
						)}
					</div>
				</nav>

				{/* Rodapé: novidades + usuário */}
				<div className={cn('pb-3 pt-2 border-t border-sidebar-border', showLabels ? 'px-3' : 'px-2')}>
					{/* Novidades */}
					<div ref={newsRef} className="relative">
						{isNewsOpen && (
							<div
								role="dialog"
								aria-label="Novidades da versão"
								className={`absolute z-50 bottom-full mb-2 bg-sidebar-surface text-sidebar-text-strong rounded-lg border border-sidebar-control-border shadow-lg overflow-hidden ${
									showLabels ? 'left-0 right-0' : 'left-0 w-72'
								}`}
							>
								<div className="flex items-center gap-2 px-3.5 py-3 border-b border-sidebar-control-border bg-sidebar-subtle">
									<Sparkles className="w-4 h-4 text-sidebar-icon-accent" />
									<p className="text-xs font-semibold text-sidebar-text-strong">Novidades desta versão</p>
								</div>
								<ul className="px-3.5 py-3 space-y-2">
									{NOVIDADES.map((item) => (
										<li key={item} className="flex gap-2 text-[11px] text-sidebar-text leading-snug">
											<span className="mt-1.5 w-1 h-1 rounded-full bg-sidebar-indicator shrink-0" />
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						<button
							type="button"
							onClick={() => {
								setIsNewsOpen((open) => !open)
								setIsUserMenuOpen(false)
							}}
							aria-expanded={isNewsOpen}
							title={showLabels ? undefined : 'Novidades'}
							aria-label={showLabels ? undefined : 'Novidades'}
							aria-describedby={showLabels ? undefined : 'nav-tooltip-novidades'}
							className={cn(
								'group relative w-full h-11 flex items-center gap-3 rounded-base text-[13px] text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-strong transition-colors cursor-pointer',
								showLabels ? 'px-4' : 'justify-center px-0'
							)}
						>
							<span className="relative shrink-0">
								<Megaphone className="w-[18px] h-[18px] group-hover:text-sidebar-icon-accent transition-colors" />
								<span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sidebar-indicator" />
							</span>
							{showLabels && <span className="truncate">Novidades</span>}
							{!showLabels && (
								<span
									id="nav-tooltip-novidades"
									role="tooltip"
									className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap radius-base border border-sidebar-control-border bg-sidebar-surface px-2 py-1 text-[11px] text-sidebar-text-strong opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
								>
									Novidades
								</span>
							)}
						</button>
					</div>

					{/* Usuário */}
					<div ref={userMenuRef} className="relative">
						{isUserMenuOpen && (
							<div
								className={`absolute z-50 bottom-full mb-2 bg-sidebar-surface text-sidebar-text-strong rounded-lg border border-sidebar-control-border shadow-lg overflow-hidden ${
									showLabels ? 'left-0 right-0' : 'left-0 w-64'
								}`}
								role="menu"
								aria-label="Opções do usuário"
							>
								<div className="px-3.5 py-3 bg-sidebar-subtle border-b border-sidebar-control-border">
									<p className="text-xs font-semibold text-sidebar-text-strong truncate">{userFullName}</p>
									<p className="text-[11px] text-sidebar-text truncate mt-0.5">{userEmail}</p>
								</div>

								<button
									type="button"
									role="menuitem"
									onClick={() => setIsUserMenuOpen(false)}
									className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-sidebar-text hover:bg-sidebar-subtle transition-colors cursor-not-allowed"
									title="Disponível em uma próxima atualização"
								>
									<UserRound className="w-4 h-4 shrink-0" />
									<span className="flex-1 truncate">Alterar informações do perfil</span>
									<span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sidebar-subtle text-sidebar-text border border-sidebar-control-border">
										Em breve
									</span>
								</button>

								{onLogout && (
									<button
										type="button"
										role="menuitem"
										onClick={() => {
											setIsUserMenuOpen(false)
											onLogout()
										}}
										className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-sidebar-danger-text hover:bg-sidebar-danger-bg border-t border-sidebar-control-border transition-colors cursor-pointer"
									>
										<LogOut className="w-4 h-4 shrink-0" />
										<span>Sair</span>
									</button>
								)}
							</div>
						)}

						<button
							type="button"
							onClick={() => {
								setIsUserMenuOpen((open) => !open)
								setIsNewsOpen(false)
							}}
							aria-haspopup="menu"
							aria-expanded={isUserMenuOpen}
							title={showLabels ? 'Abrir opções do usuário' : userFullName}
							aria-label={showLabels ? undefined : 'Opções do usuário'}
							aria-describedby={showLabels ? undefined : 'nav-tooltip-usuario'}
							className={cn(
								'group relative w-full flex items-center rounded-base p-1.5 hover:bg-sidebar-hover transition-colors cursor-pointer',
								showLabels ? 'gap-2.5' : 'justify-center'
							)}
						>
							<div className="w-9 h-9 rounded-full bg-sidebar-avatar-bg border border-sidebar-avatar-border/50 flex items-center justify-center text-[11px] font-bold text-sidebar-avatar-text shrink-0">
								{initials}
							</div>
							{showLabels && (
								<>
									<div className="flex flex-col min-w-0 text-left flex-1">
										<span className="text-xs font-semibold text-sidebar-text-strong truncate">{userFullName}</span>
										<span className="text-[10px] text-sidebar-text truncate">{userRole}</span>
									</div>
									<ChevronUp
										className={`w-3.5 h-3.5 shrink-0 text-sidebar-text transition-transform ${
											isUserMenuOpen ? 'rotate-180' : ''
										}`}
									/>
								</>
							)}
							{!showLabels && (
								<span
									id="nav-tooltip-usuario"
									role="tooltip"
									className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap radius-base border border-sidebar-control-border bg-sidebar-surface px-2 py-1 text-[11px] text-sidebar-text-strong opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
								>
									Opções do usuário
								</span>
							)}
						</button>
					</div>
				</div>
			</aside>
		</>
	)
}

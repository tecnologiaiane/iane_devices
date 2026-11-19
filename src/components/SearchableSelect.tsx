import React, { useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { matchesPhoneSearch } from '../utils/formatters'
import { fieldClass } from './field'
import { cn } from '../lib/utils'

export interface SearchableOption {
	value: string
	label: string
	phoneSearch?: string
}

const fieldStyles = `${fieldClass} h-10 px-3`

interface SearchableSelectProps {
	value: string
	options: SearchableOption[]
	onChange: (value: string) => void
	placeholder: string
	disabled?: boolean
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
	value,
	options,
	onChange,
	placeholder,
	disabled,
}) => {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const searchInput = useRef<HTMLInputElement>(null)
	const selected = options.find((option) => option.value === value)
	const visible = useMemo(
		() =>
			options.filter(
				(option) =>
					option.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) ||
					(option.phoneSearch ? matchesPhoneSearch(option.phoneSearch, query) : false)
			),
		[options, query]
	)

	return (
		<Popover.Root
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen)
				if (nextOpen) setQuery('')
			}}
		>
			<Popover.Trigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						fieldStyles,
						'flex items-center justify-between gap-2 text-left disabled:bg-surface-subtle disabled:text-text-muted',
					)}
				>
					<span className={selected ? 'truncate' : 'truncate text-text-muted'}>
						{selected?.label || placeholder}
					</span>
					<ChevronDown
						className={cn(
							'h-3.5 w-3.5 shrink-0 text-text-muted transition-transform',
							open && 'rotate-180',
						)}
					/>
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					align="start"
					sideOffset={4}
					onOpenAutoFocus={(event) => {
						event.preventDefault()
						searchInput.current?.focus()
					}}
					style={{ width: 'var(--radix-popover-trigger-width)' }}
					className={cn(
						'z-[60] overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-md',
						'outline-none',
					)}
				>
					<div className="relative border-b border-border-subtle p-2">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
						<input
							ref={searchInput}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Pesquisar..."
							className={cn(fieldStyles, 'pl-8')}
						/>
					</div>
					<div role="listbox" className="max-h-52 overflow-y-auto py-1">
						{visible.length ? (
							visible.map((option) => (
								<button
									key={option.value}
									type="button"
									role="option"
									aria-selected={option.value === value}
									onClick={() => {
										onChange(option.value)
										setOpen(false)
									}}
									className={cn(
										'block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-surface-subtle',
										option.value === value
											? 'bg-surface-subtle font-semibold text-brand-navy-base'
											: 'text-text-primary',
									)}
								>
									{option.label}
								</button>
							))
						) : (
							<p className="px-3 py-3 text-center text-xs text-text-muted">
								Nenhuma opção encontrada.
							</p>
						)}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	)
}

interface SearchableMultiSelectProps {
	values: string[]
	options: SearchableOption[]
	onChange: (values: string[]) => void
	placeholder: string
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
	values,
	options,
	onChange,
	placeholder,
}) => {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const searchInput = useRef<HTMLInputElement>(null)
	const visible = options.filter((option) =>
		option.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
	)
	const toggle = (value: string) =>
		onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])

	return (
		<div className={cn(fieldStyles, 'flex min-h-[40px] flex-wrap items-center gap-1.5')}>
			{values.map((value) => (
				<span
					key={value}
					className="inline-flex items-center gap-1 radius-full border border-brand-blue-action/30 bg-brand-blue-action/10 px-2 py-0.5 text-[11px] font-medium text-brand-blue-action"
				>
					{value}
					<button
						type="button"
						aria-label={`Remover ${value}`}
						onClick={() => toggle(value)}
						className="text-brand-blue-action/70 hover:text-brand-navy-base"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}

			<Popover.Root
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen)
					if (nextOpen) setQuery('')
				}}
			>
				<Popover.Trigger asChild>
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center justify-between gap-2 py-0.5 text-left text-xs"
					>
						<span className={values.length ? 'text-text-primary' : 'text-text-muted'}>
							{placeholder}
						</span>
						<ChevronDown
							className={cn(
								'h-3.5 w-3.5 shrink-0 text-text-muted transition-transform',
								open && 'rotate-180',
							)}
						/>
					</button>
				</Popover.Trigger>

				<Popover.Portal>
					<Popover.Content
						align="start"
						sideOffset={4}
						onOpenAutoFocus={(event) => {
							event.preventDefault()
							searchInput.current?.focus()
						}}
						style={{ width: 'var(--radix-popover-trigger-width)' }}
						className={cn(
							'z-[60] overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-md',
							'outline-none',
						)}
					>
						<div className="relative border-b border-border-subtle p-2">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
							<input
								ref={searchInput}
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Pesquisar..."
								className={cn(fieldStyles, 'pl-8')}
							/>
						</div>
						<div
							role="listbox"
							aria-multiselectable="true"
							className="max-h-52 overflow-y-auto py-1"
						>
							{visible.length ? (
								visible.map((option) => (
									<button
										key={option.value}
										type="button"
										role="option"
										aria-selected={values.includes(option.value)}
										onClick={() => toggle(option.value)}
										className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-subtle"
									>
										{option.label}
										{values.includes(option.value) && (
											<Check className="h-3.5 w-3.5 text-brand-blue-action" />
										)}
									</button>
								))
							) : (
								<p className="px-3 py-3 text-center text-xs text-text-muted">
									Nenhuma opção encontrada.
								</p>
							)}
						</div>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>
	)
}

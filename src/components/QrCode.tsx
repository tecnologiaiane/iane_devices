/**
 * Gera o QR Code localmente (SVG), sem depender de serviços externos.
 * A CSP da aplicação permite apenas imagens da própria origem, `data:` e `blob:`,
 * por isso a geração acontece no navegador a partir do texto informado.
 */

import { useMemo } from 'react'
import { createQrMatrix } from '../utils/qr'

interface QrCodeProps {
	/** Texto ou URL a ser codificado no QR Code. */
	value: string
	/** Tamanho da imagem em pixels (quadrado). Padrão 200. */
	size?: number
	/** Texto alternativo de acessibilidade. */
	alt?: string
}

const MARGIN = 4

export function QrCode({ value, size = 200, alt = 'QR Code' }: QrCodeProps) {
	const qr = useMemo(() => {
		try {
			const matrix = createQrMatrix(value)
			const dimension = matrix.length + MARGIN * 2
			let path = ''
			matrix.forEach((row, y) => {
				row.forEach((dark, x) => {
					if (dark) path += `M${x + MARGIN} ${y + MARGIN}h1v1h-1z`
				})
			})
			return { path, dimension }
		} catch {
			return { path: '', dimension: 0 }
		}
	}, [value])

	if (!qr.path) {
		return (
			<p className="radius-base border border-dashed border-border-subtle px-3 py-6 text-center text-[11px] text-text-muted">
				Não foi possível gerar o QR Code.
			</p>
		)
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${qr.dimension} ${qr.dimension}`}
			role="img"
			aria-label={alt}
			shapeRendering="crispEdges"
			className="shrink-0 radius-base border border-border-subtle bg-surface-card p-1"
		>
			<title>{alt}</title>
			<rect width={qr.dimension} height={qr.dimension} fill="#ffffff" />
			<path d={qr.path} fill="#0F1238" />
		</svg>
	)
}

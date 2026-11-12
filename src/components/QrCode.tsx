/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Gera um QR Code sem instalar nenhuma dependência nova.
 * Utiliza a Google Charts API (chart.googleapis.com) apenas para renderizar
 * a imagem do QR Code a partir de uma URL. Não envia dados sensíveis: apenas
 * o texto informado (tipicamente a URL do relatório web do dispositivo).
 */

interface QrCodeProps {
	/** Texto ou URL a ser codificado no QR Code. */
	value: string
	/** Tamanho da imagem em pixels (quadrado). Padrão 256. */
	size?: number
	/** Texto alternativo de acessibilidade. */
	alt?: string
}

export function QrCode({ value, size = 200, alt = 'QR Code' }: QrCodeProps) {
	const encoded = encodeURIComponent(value)
	const src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encoded}&choe=UTF-8`

	return (
		<img
			src={src}
			alt={alt}
			width={size}
			height={size}
			loading="eager"
			decoding="async"
			className="rounded border border-border bg-white p-1"
			style={{
				imageRendering: 'pixelated',
				display: 'block',
			}}
			onError={(e) => {
				e.currentTarget.style.display = 'none'
			}}
		/>
	)
}

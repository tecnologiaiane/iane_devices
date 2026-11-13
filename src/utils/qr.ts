/**
 * Codificador de QR Code (Model 2) mínimo, sem dependências externas.
 *
 * Modo byte, nível de correção de erro M, máscara 0, versões 1 a 10.
 * Renderizado localmente pelo componente QrCode, sem chamadas a serviços
 * externos (a CSP da aplicação bloqueia imagens de terceiros).
 */

interface VersionInfo {
	/** Total de codewords (dados + correção). */
	totalCodewords: number
	/** Codewords de correção por bloco. */
	ecCodewordsPerBlock: number
	/** Blocos do grupo 1 e seus codewords de dados. */
	group1Blocks: number
	group1DataCodewords: number
	/** Blocos do grupo 2 e seus codewords de dados. */
	group2Blocks: number
	group2DataCodewords: number
}

// Índice 0 = versão 1. Nível M.
const VERSIONS: VersionInfo[] = [
	{ totalCodewords: 26, ecCodewordsPerBlock: 10, group1Blocks: 1, group1DataCodewords: 16, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 44, ecCodewordsPerBlock: 16, group1Blocks: 1, group1DataCodewords: 28, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 70, ecCodewordsPerBlock: 26, group1Blocks: 1, group1DataCodewords: 44, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 100, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 32, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 134, ecCodewordsPerBlock: 24, group1Blocks: 2, group1DataCodewords: 43, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 172, ecCodewordsPerBlock: 16, group1Blocks: 4, group1DataCodewords: 27, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 196, ecCodewordsPerBlock: 18, group1Blocks: 4, group1DataCodewords: 31, group2Blocks: 0, group2DataCodewords: 0 },
	{ totalCodewords: 242, ecCodewordsPerBlock: 22, group1Blocks: 2, group1DataCodewords: 38, group2Blocks: 2, group2DataCodewords: 39 },
	{ totalCodewords: 292, ecCodewordsPerBlock: 22, group1Blocks: 3, group1DataCodewords: 36, group2Blocks: 2, group2DataCodewords: 37 },
	{ totalCodewords: 346, ecCodewordsPerBlock: 26, group1Blocks: 4, group1DataCodewords: 43, group2Blocks: 1, group2DataCodewords: 44 },
]

const ALIGNMENT_POSITIONS: number[][] = [
	[],
	[6, 18],
	[6, 22],
	[6, 26],
	[6, 30],
	[6, 34],
	[6, 22, 38],
	[6, 24, 42],
	[6, 26, 46],
	[6, 28, 50],
]

// Bits restantes após os codewords, por versão (1 a 10).
const REMAINDER_BITS = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0]

function gfMul(x: number, y: number): number {
	let z = 0
	for (let i = 7; i >= 0; i--) {
		z = (z << 1) ^ ((z >>> 7) * 0x11d)
		z ^= ((y >>> i) & 1) * x
	}
	return z & 0xff
}

function rsDivisor(degree: number): Uint8Array {
	const result = new Uint8Array(degree)
	result[degree - 1] = 1
	let root = 1
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < degree; j++) {
			result[j] = gfMul(result[j], root)
			if (j + 1 < degree) result[j] ^= result[j + 1]
		}
		root = gfMul(root, 0x02)
	}
	return result
}

function rsRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
	const result = new Uint8Array(divisor.length)
	for (const byte of data) {
		const factor = byte ^ result[0]
		result.copyWithin(0, 1)
		result[result.length - 1] = 0
		for (let i = 0; i < divisor.length; i++) {
			result[i] ^= gfMul(divisor[i], factor)
		}
	}
	return result
}

function pushBits(bits: number[], value: number, length: number): void {
	for (let i = length - 1; i >= 0; i--) {
		bits.push((value >>> i) & 1)
	}
}

function dataCapacityBytes(info: VersionInfo): number {
	return info.group1Blocks * info.group1DataCodewords + info.group2Blocks * info.group2DataCodewords
}

function selectVersion(byteLength: number): { version: number; info: VersionInfo } {
	for (let version = 1; version <= VERSIONS.length; version++) {
		const info = VERSIONS[version - 1]
		const countBits = version <= 9 ? 8 : 16
		const capacityBits = dataCapacityBytes(info) * 8
		if (4 + countBits + byteLength * 8 <= capacityBits) {
			return { version, info }
		}
	}
	throw new Error('Conteúdo muito longo para o QR Code.')
}

function encodeData(bytes: number[], version: number, info: VersionInfo): Uint8Array {
	const capacityBytes = dataCapacityBytes(info)
	const capacityBits = capacityBytes * 8
	const bits: number[] = []

	pushBits(bits, 0b0100, 4)
	pushBits(bits, bytes.length, version <= 9 ? 8 : 16)
	for (const byte of bytes) pushBits(bits, byte, 8)

	const terminator = Math.min(4, capacityBits - bits.length)
	for (let i = 0; i < terminator; i++) bits.push(0)
	while (bits.length % 8 !== 0) bits.push(0)

	const data: number[] = []
	for (let i = 0; i < bits.length; i += 8) {
		let byte = 0
		for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
		data.push(byte)
	}
	for (let pad = 0xec; data.length < capacityBytes; pad ^= 0xec ^ 0x11) {
		data.push(pad)
	}
	return Uint8Array.from(data)
}

interface CodewordBlock {
	data: Uint8Array
	ec: Uint8Array
}

function interleave(data: Uint8Array, info: VersionInfo): Uint8Array {
	const blocks: CodewordBlock[] = []
	const divisor = rsDivisor(info.ecCodewordsPerBlock)
	let offset = 0

	const addBlock = (length: number) => {
		const blockData = data.slice(offset, offset + length)
		offset += length
		blocks.push({ data: blockData, ec: rsRemainder(blockData, divisor) })
	}

	for (let i = 0; i < info.group1Blocks; i++) addBlock(info.group1DataCodewords)
	for (let i = 0; i < info.group2Blocks; i++) addBlock(info.group2DataCodewords)

	const result: number[] = []
	const maxDataLength = Math.max(...blocks.map((block) => block.data.length))
	for (let i = 0; i < maxDataLength; i++) {
		for (const block of blocks) {
			if (i < block.data.length) result.push(block.data[i])
		}
	}
	for (let i = 0; i < info.ecCodewordsPerBlock; i++) {
		for (const block of blocks) result.push(block.ec[i])
	}
	return Uint8Array.from(result)
}

function formatBits(): number {
	// Nível M (00) + máscara 0 (000) => 5 bits de dados.
	const data = 0
	let rem = data
	for (let i = 0; i < 10; i++) {
		rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
	}
	return ((data << 10) | rem) ^ 0x5412
}

function versionBits(version: number): number {
	let rem = version
	for (let i = 0; i < 12; i++) {
		rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
	}
	return (version << 12) | rem
}

export function createQrMatrix(text: string): boolean[][] {
	const bytes = Array.from(new TextEncoder().encode(text))
	const { version, info } = selectVersion(bytes.length)
	const interleaved = interleave(encodeData(bytes, version, info), info)

	const size = 17 + 4 * version
	const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
	const isFunction: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

	const set = (x: number, y: number, dark: boolean) => {
		if (x < 0 || y < 0 || x >= size || y >= size) return
		modules[y][x] = dark
		isFunction[y][x] = true
	}

	// Padrões de sincronização (timing).
	for (let i = 0; i < size; i++) {
		set(6, i, i % 2 === 0)
		set(i, 6, i % 2 === 0)
	}

	// Marcadores de posição (finder) com separadores.
	const drawFinder = (cx: number, cy: number) => {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const dist = Math.max(Math.abs(dx), Math.abs(dy))
				set(cx + dx, cy + dy, dist !== 2 && dist !== 4)
			}
		}
	}
	drawFinder(3, 3)
	drawFinder(size - 4, 3)
	drawFinder(3, size - 4)

	// Padrões de alinhamento.
	const alignment = ALIGNMENT_POSITIONS[version - 1]
	for (let i = 0; i < alignment.length; i++) {
		for (let j = 0; j < alignment.length; j++) {
			if (
				(i === 0 && j === 0) ||
				(i === 0 && j === alignment.length - 1) ||
				(i === alignment.length - 1 && j === 0)
			) {
				continue
			}
			const cx = alignment[i]
			const cy = alignment[j]
			for (let dy = -2; dy <= 2; dy++) {
				for (let dx = -2; dx <= 2; dx++) {
					set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
				}
			}
		}
	}

	// Informações de formato (duas cópias).
	const fbits = formatBits()
	const getFormatBit = (index: number) => ((fbits >>> index) & 1) !== 0
	for (let i = 0; i <= 5; i++) set(8, i, getFormatBit(i))
	set(8, 7, getFormatBit(6))
	set(8, 8, getFormatBit(7))
	set(7, 8, getFormatBit(8))
	for (let i = 9; i < 15; i++) set(14 - i, 8, getFormatBit(i))

	for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getFormatBit(i))
	for (let i = 8; i < 15; i++) set(8, size - 15 + i, getFormatBit(i))
	set(8, size - 8, true)

	// Informações de versão (versões 7+).
	if (version >= 7) {
		const vbits = versionBits(version)
		const getVersionBit = (index: number) => ((vbits >>> index) & 1) !== 0
		for (let i = 0; i < 18; i++) {
			const a = size - 11 + (i % 3)
			const b = Math.floor(i / 3)
			set(a, b, getVersionBit(i))
			set(b, a, getVersionBit(i))
		}
	}

	// Posiciona os codewords em zigue-zague.
	const bitAt = (index: number) => {
		if (index >= interleaved.length * 8) return false
		return ((interleaved[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0
	}
	let bitIndex = 0
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) right = 5
		for (let vert = 0; vert < size; vert++) {
			for (let j = 0; j < 2; j++) {
				const x = right - j
				const upward = ((right + 1) & 2) === 0
				const y = upward ? size - 1 - vert : vert
				if (!isFunction[y][x] && bitIndex < interleaved.length * 8) {
					modules[y][x] = bitAt(bitIndex)
					bitIndex++
				}
			}
		}
	}

	// Máscara 0: (x + y) % 2 === 0.
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			if (!isFunction[y][x] && (x + y) % 2 === 0) {
				modules[y][x] = !modules[y][x]
			}
		}
	}

	return modules
}

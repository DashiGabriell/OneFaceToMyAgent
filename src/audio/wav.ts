export interface WavFormat {
  readonly sampleRate: number
  readonly channels: number
  readonly dataOffset: number
  readonly dataSize: number
}

const HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

export function parseWavHeader(bytes: Uint8Array): WavFormat | null {
  if (bytes.length < HEADER_BYTES) return null
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE') return null

  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let dataOffset = -1
  let dataSize = 0
  let cursor = HEADER_BYTES

  while (cursor + CHUNK_HEADER_BYTES <= bytes.length) {
    const id = readAscii(bytes, cursor, 4)
    const size = readUint32(bytes, cursor + 4)
    const body = cursor + CHUNK_HEADER_BYTES

    if (id === 'fmt ') {
      if (body + 16 > bytes.length) return null
      const audioFormat = readUint16(bytes, body)
      if (audioFormat !== 1) return null
      channels = readUint16(bytes, body + 2)
      sampleRate = readUint32(bytes, body + 4)
      bitsPerSample = readUint16(bytes, body + 14)
    } else if (id === 'data') {
      dataOffset = body
      dataSize = size
      break
    }

    const next = body + size + (size % 2)
    if (next <= cursor) return null
    cursor = next
  }

  if (dataOffset < 0 || sampleRate <= 0 || channels <= 0) return null
  if (bitsPerSample !== 16) return null

  return { sampleRate, channels, dataOffset, dataSize }
}

export function decodeWavSamples(bytes: Uint8Array, format: WavFormat): Float32Array {
  const available = Math.max(0, Math.min(bytes.length, format.dataOffset + format.dataSize))
  const frameBytes = format.channels * 2
  const availableBytes = Math.max(0, available - format.dataOffset)
  const frames = Math.floor(availableBytes / frameBytes)
  const samples = new Float32Array(frames)

  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0
    const frameOffset = format.dataOffset + frame * frameBytes
    for (let channel = 0; channel < format.channels; channel += 1) {
      const offset = frameOffset + channel * 2
      const low = bytes[offset] ?? 0
      const high = bytes[offset + 1] ?? 0
      const value = ((high << 8) | low) << 16 >> 16
      sum += value / 32768
    }
    samples[frame] = sum / format.channels
  }

  return samples
}

import type { FishStreamEvent } from './fish.ts'
import type { TtsSegment } from '../src/audio/protocol.ts'

const SAMPLE_RATE = 24000
const LEAD_SECONDS = 0.08
const GAP_SECONDS = 0.06
const TRAIL_SECONDS = 0.12
const CHUNK_BYTES = 4096

interface MockWord {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly startSample: number
  readonly endSample: number
}

function planWords(text: string): MockWord[] {
  const words = text.split(/\s+/).filter(Boolean).slice(0, 48)
  const planned: MockWord[] = []
  let cursor = LEAD_SECONDS

  for (const word of words) {
    const clean = word.replace(/[^\p{L}\p{N}]/gu, '')
    if (!clean) continue
    const duration = 0.22 + Math.min(clean.length, 12) * 0.03
    const start = cursor
    const end = cursor + duration
    planned.push({
      text: clean,
      start,
      end,
      startSample: Math.round(start * SAMPLE_RATE),
      endSample: Math.round(end * SAMPLE_RATE),
    })
    cursor = end + GAP_SECONDS
  }

  return planned
}

function renderPcm(words: readonly MockWord[]): Int16Array {
  const totalSeconds =
    (words.at(-1)?.end ?? LEAD_SECONDS) + GAP_SECONDS + TRAIL_SECONDS
  const samples = new Int16Array(Math.max(1, Math.ceil(totalSeconds * SAMPLE_RATE)))

  words.forEach((word, index) => {
    const frequency = 118 + (index % 5) * 17
    const duration = word.end - word.start
    const attack = Math.min(0.03, duration / 3)
    const release = Math.min(0.05, duration / 3)

    for (let sample = word.startSample; sample < Math.min(word.endSample, samples.length); sample += 1) {
      const time = sample / SAMPLE_RATE
      const local = time - word.start
      const envelope =
        local < attack
          ? local / attack
          : local > duration - release
            ? Math.max(0, (duration - local) / release)
            : 1
      const vibrato = 1 + Math.sin(2 * Math.PI * 4.5 * time) * 0.012
      const value =
        (Math.sin(2 * Math.PI * frequency * time * vibrato) * 0.34 +
          Math.sin(2 * Math.PI * frequency * 2 * time * vibrato) * 0.12 +
          Math.sin(2 * Math.PI * frequency * 3 * time * vibrato) * 0.05) *
        envelope
      samples[sample] = Math.max(-32767, Math.min(32767, Math.round(value * 32767)))
    }
  })

  return samples
}

function writeAscii(target: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    target[offset + index] = text.charCodeAt(index)
  }
}

function encodeWav(samples: Int16Array): Uint8Array {
  const dataSize = samples.length * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  writeAscii(bytes, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(bytes, 36, 'data')
  view.setUint32(40, dataSize, true)

  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0
    bytes[44 + index * 2] = value & 0xff
    bytes[44 + index * 2 + 1] = (value >> 8) & 0xff
  }

  return bytes
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
}

export function mockWav(text: string): {
  readonly bytes: Uint8Array
  readonly words: readonly MockWord[]
  readonly durationSec: number
} {
  const words = planWords(text)
  const pcm = renderPcm(words)
  return {
    bytes: encodeWav(pcm),
    words,
    durationSec: pcm.length / SAMPLE_RATE,
  }
}

export async function* mockFishEvents(text: string): AsyncGenerator<FishStreamEvent, void, void> {
  const { bytes, words } = mockWav(text)
  let sent = 0
  let emittedWords = 0

  while (sent < bytes.length) {
    const end = Math.min(bytes.length, sent + CHUNK_BYTES)
    yield {
      type: 'audio',
      audioBase64: toBase64(bytes.subarray(sent, end)),
      chunkSeq: 0,
      offsetSec: 0,
    }
    sent = end

    const sentDataBytes = Math.max(0, sent - 44)
    while (emittedWords < words.length) {
      const word = words[emittedWords]
      if (!word || word.endSample * 2 > sentDataBytes) break
      emittedWords += 1
      const segments: TtsSegment[] = words.slice(0, emittedWords).map((item) => ({
        text: item.text,
        start: item.start,
        end: item.end,
      }))
      yield {
        type: 'alignment',
        chunkSeq: 0,
        offsetSec: 0,
        content: segments.map((segment) => segment.text).join(' '),
        audioDuration: word.end,
        segments,
      }
    }
  }

  if (emittedWords < words.length) {
    const segments: TtsSegment[] = words.map((item) => ({
      text: item.text,
      start: item.start,
      end: item.end,
    }))
    const last = words.at(-1)
    yield {
      type: 'alignment',
      chunkSeq: 0,
      offsetSec: 0,
      content: segments.map((segment) => segment.text).join(' '),
      audioDuration: last?.end ?? 0,
      segments,
    }
  }
}

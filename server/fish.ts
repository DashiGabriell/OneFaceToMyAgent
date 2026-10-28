import type { TtsAlignmentEvent, TtsAudioEvent, TtsSegment } from '../src/audio/protocol.ts'

export const FISH_TTS_URL = 'https://api.fish.audio/v1/tts/stream/with-timestamp'

export interface FishTtsRequest {
  readonly text: string
  readonly voiceId: string
  readonly model: string
  readonly format: string
  readonly language: string
}

export interface FishPayload {
  readonly text: string
  readonly format: string
  readonly latency: 'balanced'
  readonly language: string
  readonly reference_id?: string
}

export type FishStreamEvent =
  | (TtsAudioEvent & { readonly type: 'audio' })
  | (TtsAlignmentEvent & { readonly type: 'alignment' })

export class FishApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function buildFishPayload(request: FishTtsRequest): FishPayload {
  const payload: FishPayload = {
    text: request.text,
    format: request.format,
    latency: 'balanced',
    language: request.language,
  }
  if (request.voiceId) return { ...payload, reference_id: request.voiceId }
  return payload
}

export function buildFishHeaders(apiKey: string, model: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    model,
  }
}

function readDataBlock(block: string): string | null {
  const lines: string[] = []
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trimStart()
    if (!line.startsWith('data:')) continue
    lines.push(line.slice(5).replace(/^ /, ''))
  }
  if (lines.length === 0) return null
  return lines.join('\n')
}

export async function* parseFishSse(
  chunks: AsyncIterable<Uint8Array>,
): AsyncGenerator<unknown, void, void> {
  const decoder = new TextDecoder()
  let buffer = ''

  const emit = async function* (block: string): AsyncGenerator<unknown> {
    const payload = readDataBlock(block)
    if (payload === null || payload === '[DONE]') return
    try {
      yield JSON.parse(payload)
    } catch {
      throw new Error('invalid SSE JSON payload')
    }
  }

  for await (const chunk of chunks) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      yield* emit(block)
      boundary = buffer.indexOf('\n\n')
    }
  }

  buffer = (buffer + decoder.decode()).replace(/\r\n/g, '\n')
  if (buffer.trim()) yield* emit(buffer)
}

function parseSegments(value: unknown): TtsSegment[] {
  if (!Array.isArray(value)) return []
  const segments: TtsSegment[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (typeof record.text !== 'string') continue
    if (typeof record.start !== 'number' || !Number.isFinite(record.start)) continue
    if (typeof record.end !== 'number' || !Number.isFinite(record.end)) continue
    if (record.end <= record.start) continue
    segments.push({ text: record.text, start: record.start, end: record.end })
  }
  segments.sort((left, right) => left.start - right.start)
  return segments
}

export function normalizeFishEvent(value: unknown): FishStreamEvent[] {
  if (typeof value !== 'object' || value === null) return []
  const record = value as Record<string, unknown>
  const chunkSeq = typeof record.chunk_seq === 'number' ? record.chunk_seq : 0
  const offsetSec =
    typeof record.chunk_audio_offset_sec === 'number' &&
    Number.isFinite(record.chunk_audio_offset_sec)
      ? record.chunk_audio_offset_sec
      : 0

  const events: FishStreamEvent[] = []
  if (typeof record.audio_base64 === 'string' && record.audio_base64.length > 0) {
    events.push({
      type: 'audio',
      audioBase64: record.audio_base64,
      chunkSeq,
      offsetSec,
    })
  }

  const alignment = record.alignment
  if (typeof alignment === 'object' && alignment !== null) {
    const alignmentRecord = alignment as Record<string, unknown>
    const segments = parseSegments(alignmentRecord.segments)
    if (segments.length > 0) {
      const declared =
        typeof alignmentRecord.audio_duration === 'number' &&
        Number.isFinite(alignmentRecord.audio_duration)
          ? alignmentRecord.audio_duration
          : 0
      const measured = segments.reduce((max, segment) => Math.max(max, segment.end), 0)
      events.push({
        type: 'alignment',
        chunkSeq,
        offsetSec,
        content: typeof record.content === 'string' ? record.content : '',
        audioDuration: Math.max(declared, measured),
        segments,
      })
    }
  }

  return events
}

export async function* normalizeFishStream(
  chunks: AsyncIterable<Uint8Array>,
): AsyncGenerator<FishStreamEvent, void, void> {
  for await (const raw of parseFishSse(chunks)) {
    yield* normalizeFishEvent(raw)
  }
}

async function* readStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array, void, void> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function openFishStream(
  fetchImpl: typeof fetch,
  apiKey: string,
  request: FishTtsRequest,
  signal?: AbortSignal,
): Promise<AsyncIterable<FishStreamEvent>> {
  let response: Response
  try {
    response = await fetchImpl(FISH_TTS_URL, {
      method: 'POST',
      headers: buildFishHeaders(apiKey, request.model),
      body: JSON.stringify(buildFishPayload(request)),
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    throw new FishApiError(502, error instanceof Error ? error.message : 'fish request failed')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new FishApiError(response.status, detail.slice(0, 1000) || 'fish request failed')
  }
  if (!response.body) throw new FishApiError(502, 'fish response has no body')

  return normalizeFishStream(readStream(response.body))
}

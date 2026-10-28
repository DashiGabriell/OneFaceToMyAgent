import { createHash } from 'node:crypto'
import type { CacheWriter, DiskCache } from './cache.ts'
import { readLines } from './cache.ts'
import type { FishStreamEvent } from './fish.ts'
import { FishApiError, openFishStream } from './fish.ts'
import { mockFishEvents } from './mock.ts'
import type {
  TtsAlignmentEvent,
  TtsAudioEvent,
  TtsDoneEvent,
  TtsEvent,
  TtsMetaEvent,
} from '../src/audio/protocol.ts'
import { parseTtsEvent } from '../src/audio/protocol.ts'
import type { EmotionName } from '../src/core/emotion.ts'
import type { Persona } from '../src/core/persona.ts'

export interface SpeechRequest {
  readonly text: string
  readonly emotion?: EmotionName
  readonly nocache?: boolean
  readonly signal?: AbortSignal
}

export interface SpeechServiceDeps {
  readonly apiKey: string
  readonly persona: Persona
  readonly cache: DiskCache
  readonly fetchImpl?: typeof fetch
  readonly mock?: boolean
}

export class VoiceUnavailableError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface SpeechCacheParts {
  readonly text: string
  readonly voiceId: string
  readonly model: string
  readonly format: string
  readonly language: string
  readonly emotion: EmotionName
}

export function speechCacheKey(parts: SpeechCacheParts): string {
  const payload = JSON.stringify([
    parts.text,
    parts.voiceId,
    parts.model,
    parts.format,
    parts.language,
    parts.emotion,
  ])
  return createHash('sha256').update(payload).digest('hex')
}

async function openSource(
  deps: SpeechServiceDeps,
  request: SpeechRequest,
  format: string,
): Promise<AsyncIterable<FishStreamEvent>> {
  if (deps.mock) return mockFishEvents(request.text)

  if (!deps.apiKey) {
    throw new VoiceUnavailableError(503, 'API_KEY_FISHAUDIO is not configured')
  }

  try {
    return await openFishStream(
      deps.fetchImpl ?? fetch,
      deps.apiKey,
      {
        text: request.text,
        voiceId: deps.persona.voiceId,
        model: deps.persona.model,
        format,
        language: deps.persona.language,
      },
      request.signal,
    )
  } catch (error) {
    if (error instanceof FishApiError) {
      throw new VoiceUnavailableError(502, `fish ${error.status}: ${error.message}`)
    }
    throw error
  }
}

function alignmentDuration(event: TtsAlignmentEvent): number {
  let duration = event.offsetSec + event.audioDuration
  for (const segment of event.segments) {
    duration = Math.max(duration, event.offsetSec + segment.end)
  }
  return duration
}

export async function* streamSpeech(
  deps: SpeechServiceDeps,
  request: SpeechRequest,
): AsyncGenerator<TtsEvent, void, void> {
  const emotion = request.emotion ?? deps.persona.defaultMood
  const format = deps.mock ? 'wav' : deps.persona.format
  const key = speechCacheKey({
    text: request.text,
    voiceId: deps.persona.voiceId,
    model: deps.persona.model,
    format,
    language: deps.persona.language,
    emotion,
  })
  const meta: TtsMetaEvent = {
    type: 'meta',
    cached: false,
    model: deps.persona.model,
    format,
    language: deps.persona.language,
    voiceId: deps.persona.voiceId,
    emotion,
  }

  if (!request.nocache) {
    const hit = await deps.cache.get(key)
    if (hit) {
      yield { ...meta, cached: true }
      for await (const line of readLines(hit)) {
        let raw: unknown
        try {
          raw = JSON.parse(line)
        } catch {
          throw new VoiceUnavailableError(500, 'corrupted cache entry')
        }
        const event = parseTtsEvent(raw)
        if (!event || event.type === 'meta') continue
        yield event
      }
      return
    }
  }

  const source = await openSource(deps, request, format)
  yield meta

  let writer: CacheWriter | null = null
  try {
    writer = await deps.cache.openWriter(key)
  } catch {
    writer = null
  }

  let duration = 0
  const write = (event: TtsEvent): void => {
    if (!writer) return
    try {
      writer.write(`${JSON.stringify(event)}\n`)
    } catch {
      writer = null
    }
  }

  try {
    for await (const event of source) {
      if (request.signal?.aborted) break
      if (event.type === 'audio') {
        const audio: TtsAudioEvent = {
          type: 'audio',
          audioBase64: event.audioBase64,
          chunkSeq: event.chunkSeq,
          offsetSec: event.offsetSec,
        }
        write(audio)
        yield audio
        continue
      }
      duration = Math.max(duration, alignmentDuration(event))
      const alignment: TtsAlignmentEvent = {
        type: 'alignment',
        chunkSeq: event.chunkSeq,
        offsetSec: event.offsetSec,
        content: event.content,
        audioDuration: event.audioDuration,
        segments: event.segments,
      }
      write(alignment)
      yield alignment
    }
  } catch (error) {
    await writer?.abort()
    if (error instanceof FishApiError) {
      throw new VoiceUnavailableError(502, `fish ${error.status}: ${error.message}`)
    }
    throw error
  }

  const done: TtsDoneEvent = {
    type: 'done',
    durationSec: Math.round(duration * 1000) / 1000,
  }
  write(done)
  try {
    await writer?.commit()
  } catch {
    await writer?.abort()
  }
  yield done
}

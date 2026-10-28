import { EMOTION_NAMES } from '../core/emotion.ts'
import type { EmotionName } from '../core/emotion.ts'

export interface TtsMetaEvent {
  readonly type: 'meta'
  readonly cached: boolean
  readonly model: string
  readonly format: string
  readonly language: string
  readonly voiceId: string
  readonly emotion: EmotionName
}

export interface TtsAudioEvent {
  readonly type: 'audio'
  readonly audioBase64: string
  readonly chunkSeq: number
  readonly offsetSec: number
}

export interface TtsSegment {
  readonly text: string
  readonly start: number
  readonly end: number
}

export interface TtsAlignmentEvent {
  readonly type: 'alignment'
  readonly chunkSeq: number
  readonly offsetSec: number
  readonly content: string
  readonly audioDuration: number
  readonly segments: readonly TtsSegment[]
}

export interface TtsDoneEvent {
  readonly type: 'done'
  readonly durationSec: number
}

export interface TtsErrorEvent {
  readonly type: 'error'
  readonly message: string
  readonly code?: string
}

export type TtsEvent =
  | TtsMetaEvent
  | TtsAudioEvent
  | TtsAlignmentEvent
  | TtsDoneEvent
  | TtsErrorEvent

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmotion(value: unknown): value is EmotionName {
  return typeof value === 'string' && (EMOTION_NAMES as readonly string[]).includes(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseSegments(value: unknown): TtsSegment[] | null {
  if (!Array.isArray(value)) return null
  const segments: TtsSegment[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    if (typeof item.text !== 'string') return null
    if (!isFiniteNumber(item.start) || !isFiniteNumber(item.end)) return null
    if (item.end <= item.start) continue
    segments.push({ text: item.text, start: item.start, end: item.end })
  }
  return segments
}

export function parseTtsEvent(value: unknown): TtsEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null

  switch (value.type) {
    case 'meta':
      if (!isEmotion(value.emotion)) return null
      return {
        type: 'meta',
        cached: value.cached === true,
        model: typeof value.model === 'string' ? value.model : '',
        format: typeof value.format === 'string' ? value.format : 'opus',
        language: typeof value.language === 'string' ? value.language : 'pt-BR',
        voiceId: typeof value.voiceId === 'string' ? value.voiceId : '',
        emotion: value.emotion,
      }
    case 'audio':
      if (typeof value.audioBase64 !== 'string' || value.audioBase64.length === 0) return null
      return {
        type: 'audio',
        audioBase64: value.audioBase64,
        chunkSeq: isFiniteNumber(value.chunkSeq) ? value.chunkSeq : 0,
        offsetSec: isFiniteNumber(value.offsetSec) ? value.offsetSec : 0,
      }
    case 'alignment': {
      const segments = parseSegments(value.segments)
      if (!segments) return null
      return {
        type: 'alignment',
        chunkSeq: isFiniteNumber(value.chunkSeq) ? value.chunkSeq : 0,
        offsetSec: isFiniteNumber(value.offsetSec) ? value.offsetSec : 0,
        content: typeof value.content === 'string' ? value.content : '',
        audioDuration: isFiniteNumber(value.audioDuration) ? value.audioDuration : 0,
        segments,
      }
    }
    case 'done':
      return {
        type: 'done',
        durationSec: isFiniteNumber(value.durationSec) ? value.durationSec : 0,
      }
    case 'error':
      return {
        type: 'error',
        message: typeof value.message === 'string' ? value.message : 'voz indisponível',
        ...(typeof value.code === 'string' ? { code: value.code } : {}),
      }
    default:
      return null
  }
}

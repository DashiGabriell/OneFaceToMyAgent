import { EMOTION_NAMES } from './emotion.ts'
import type { EmotionName } from './emotion.ts'

export const FISH_MODELS = ['s2.1-pro', 's2.1-pro-free', 's2-pro', 's1', 'drama-3'] as const
export const AUDIO_FORMATS = ['opus', 'wav', 'pcm', 'mp3'] as const

export type FishModel = (typeof FISH_MODELS)[number]
export type AudioFormat = (typeof AUDIO_FORMATS)[number]

export interface Persona {
  readonly voiceId: string
  readonly model: FishModel
  readonly format: AudioFormat
  readonly language: string
  readonly defaultMood: EmotionName
  readonly intensity: number
  readonly blinkRange: readonly [number, number]
  readonly headAccentRate: number
}

export class PersonaError extends Error {}

export const DEFAULT_PERSONA: Persona = {
  voiceId: '',
  model: 's2.1-pro',
  format: 'opus',
  language: 'pt-BR',
  defaultMood: 'neutral',
  intensity: 1,
  blinkRange: [2, 6],
  headAccentRate: 0.35,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = raw[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new PersonaError(`${key} must be a string`)
  return value
}

function readNumber(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = raw[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PersonaError(`${key} must be a finite number`)
  }
  if (value < min || value > max) {
    throw new PersonaError(`${key} must be between ${min} and ${max}`)
  }
  return value
}

function readBlinkRange(
  raw: Record<string, unknown>,
  fallback: readonly [number, number],
): readonly [number, number] {
  const value = raw.blinkRange
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.length !== 2) {
    throw new PersonaError('blinkRange must be a pair of seconds')
  }
  const [min, max] = value
  if (typeof min !== 'number' || typeof max !== 'number') {
    throw new PersonaError('blinkRange values must be numbers')
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new PersonaError('blinkRange values must be finite')
  }
  if (min < 0.5 || max > 30 || min >= max) {
    throw new PersonaError('blinkRange must satisfy 0.5 <= min < max <= 30')
  }
  return [min, max]
}

export function validatePersona(input: unknown): Persona {
  if (!isRecord(input)) throw new PersonaError('persona must be an object')

  const voiceId = readString(input, 'voiceId', DEFAULT_PERSONA.voiceId).trim()
  const model = readString(input, 'model', DEFAULT_PERSONA.model)
  if (!(FISH_MODELS as readonly string[]).includes(model)) {
    throw new PersonaError(`model must be one of ${FISH_MODELS.join(', ')}`)
  }

  const format = readString(input, 'format', DEFAULT_PERSONA.format)
  if (!(AUDIO_FORMATS as readonly string[]).includes(format)) {
    throw new PersonaError(`format must be one of ${AUDIO_FORMATS.join(', ')}`)
  }

  const language = readString(input, 'language', DEFAULT_PERSONA.language)
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(language)) {
    throw new PersonaError('language must be a BCP-47 tag such as pt-BR')
  }

  const defaultMood = readString(input, 'defaultMood', DEFAULT_PERSONA.defaultMood)
  if (!(EMOTION_NAMES as readonly string[]).includes(defaultMood)) {
    throw new PersonaError(`defaultMood must be one of ${EMOTION_NAMES.join(', ')}`)
  }

  return {
    voiceId,
    model: model as FishModel,
    format: format as AudioFormat,
    language,
    defaultMood: defaultMood as EmotionName,
    intensity: readNumber(input, 'intensity', DEFAULT_PERSONA.intensity, 0.5, 1.5),
    blinkRange: readBlinkRange(input, DEFAULT_PERSONA.blinkRange),
    headAccentRate: readNumber(input, 'headAccentRate', DEFAULT_PERSONA.headAccentRate, 0, 1),
  }
}

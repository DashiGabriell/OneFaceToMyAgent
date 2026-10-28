import type { EmotionName } from '../core/emotion.ts'
import { parseEmotionTags } from '../core/emotion-tags.ts'
import type { RigParams } from '../core/params.ts'
import { wordToUnits } from './phonemes.ts'
import { VISEME_CHANNELS, VISEME_NAMES, VISEMES } from './visemes.ts'
import type { VisemeName, VisemeShape } from './visemes.ts'

export interface WordSegment {
  readonly text: string
  readonly start: number
  readonly end: number
}

export interface VisemeEvent {
  readonly viseme: VisemeName
  readonly start: number
  readonly end: number
  readonly weight: number
  readonly text: string
}

const REST_SHAPE: VisemeShape = VISEMES.rest

export const REST_VISEME_PARAMS: Partial<RigParams> = VISEME_CHANNELS.reduce(
  (params, channel) => {
    params[channel] = REST_SHAPE[channel] ?? 0
    return params
  },
  {} as Partial<RigParams>,
)

export function buildWordTimeline(word: string, start: number, end: number): VisemeEvent[] {
  const units = wordToUnits(word)
  if (units.length === 0 || end <= start) return []
  const totalWeight = units.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return []

  let cursor = start
  return units.map((item, index) => {
    const duration = ((end - start) * item.weight) / totalWeight
    const eventStart = cursor
    const eventEnd = index === units.length - 1 ? end : Math.min(end, cursor + duration)
    cursor = eventEnd
    return {
      viseme: item.viseme,
      start: eventStart,
      end: eventEnd,
      weight: item.weight,
      text: item.text,
    }
  })
}

export function buildTimeline(segments: readonly WordSegment[]): VisemeEvent[] {
  return segments
    .flatMap((segment) => buildWordTimeline(segment.text, segment.start, segment.end))
    .sort((left, right) => left.start - right.start)
}

export function timelineDuration(events: readonly VisemeEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.end), 0)
}

export function buildMockSegments(
  text: string,
  start = 0,
  secondsPerWord = 0.42,
  gap = 0.06,
): WordSegment[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const segments: WordSegment[] = []
  let cursor = start

  for (const word of words) {
    const clean = word.replace(/[^\p{L}]/gu, '')
    if (!clean) {
      cursor += gap
      continue
    }
    const punctuationPause = /[,.;!?]$/.test(word) ? gap * 2 : 0
    const duration = secondsPerWord + Math.min(clean.length, 10) * 0.025
    segments.push({ text: clean, start: cursor, end: cursor + duration })
    cursor += duration + gap + punctuationPause
  }

  return segments
}

export function buildMockTimeline(text: string): VisemeEvent[] {
  return buildTimeline(buildMockSegments(text))
}

export interface EmotionCue {
  readonly emotion: EmotionName
  readonly at: number
}

export interface EmotionTimeline {
  readonly events: VisemeEvent[]
  readonly cues: EmotionCue[]
}

export const EMOTION_CUE_GAP = 0.22

export function buildEmotionTimeline(text: string, start = 0): EmotionTimeline {
  const { segments } = parseEmotionTags(text)
  const events: VisemeEvent[] = []
  const cues: EmotionCue[] = []
  let cursor = start

  for (const segment of segments) {
    const words = buildMockSegments(segment.text, cursor)
    const first = words[0]
    const last = words.at(-1)
    if (!first || !last) continue
    if (segment.emotion) cues.push({ emotion: segment.emotion, at: first.start })
    events.push(...buildTimeline(words))
    cursor = last.end + EMOTION_CUE_GAP
  }

  return { events, cues }
}

export function buildVisemeLoop(holdSeconds = 0.8): VisemeEvent[] {
  return VISEME_NAMES.map((viseme, index) => ({
    viseme,
    start: index * holdSeconds,
    end: (index + 1) * holdSeconds,
    weight: 1,
    text: viseme,
  }))
}

export function sampleTimeline(
  events: readonly VisemeEvent[],
  time: number,
  window = 0.12,
): Partial<RigParams> {
  if (events.length === 0) return { ...REST_VISEME_PARAMS }

  const influences: Array<{ viseme: VisemeName; weight: number }> = []
  for (const event of events) {
    const distance =
      time < event.start ? event.start - time : time > event.end ? time - event.end : 0
    if (distance > window) continue
    const weight = 1 - distance / window
    if (weight > 0) influences.push({ viseme: event.viseme, weight })
  }

  if (influences.length === 0) return { ...REST_VISEME_PARAMS }

  const totalWeight = influences.reduce((sum, influence) => sum + influence.weight, 0)
  const result: Partial<RigParams> = {}

  for (const channel of VISEME_CHANNELS) {
    let value = 0
    for (const influence of influences) {
      const shape: VisemeShape = VISEMES[influence.viseme]
      value += (shape[channel] ?? 0) * influence.weight
    }
    result[channel] = value / totalWeight
  }

  return result
}

import { EMOTION_NAMES } from './emotion.ts'
import type { EmotionName } from './emotion.ts'

export interface EmotionTextSegment {
  readonly text: string
  readonly emotion: EmotionName | null
}

export interface ParsedEmotionText {
  readonly segments: readonly EmotionTextSegment[]
  readonly plainText: string
}

const TAG_PATTERN = /\[\s*emo\s*:\s*([a-z-]+)\s*\]/gi

function isEmotionName(value: string): value is EmotionName {
  return (EMOTION_NAMES as readonly string[]).includes(value)
}

export function parseEmotionTags(text: string): ParsedEmotionText {
  const segments: EmotionTextSegment[] = []
  let current: EmotionName | null = null
  let cursor = 0
  let buffer = ''

  const flush = (): void => {
    const trimmed = buffer.replace(/\s+/g, ' ').trim()
    if (trimmed) segments.push({ text: trimmed, emotion: current })
    buffer = ''
  }

  for (const match of text.matchAll(TAG_PATTERN)) {
    const index = match.index ?? 0
    buffer += text.slice(cursor, index)
    const name = (match[1] ?? '').toLowerCase()
    if (isEmotionName(name)) {
      flush()
      current = name
    }
    cursor = index + match[0].length
  }

  buffer += text.slice(cursor)
  flush()

  return {
    segments,
    plainText: segments.map((segment) => segment.text).join(' '),
  }
}

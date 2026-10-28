import type { RigParams } from '../core/params.ts'
import type { VisemeEvent, VisemeName } from '../lipsync/index.ts'
import { buildWordTimeline, sampleTimeline } from '../lipsync/index.ts'

export interface SpeechSegment {
  readonly text: string
  readonly start: number
  readonly end: number
}

export interface SpeechChunk {
  readonly offsetSec: number
  readonly segments: readonly SpeechSegment[]
}

export interface SpeechTimeline {
  readonly events: readonly VisemeEvent[]
  readonly duration: number
  sample(time: number): Partial<RigParams>
  visemeAt(time: number): VisemeName | null
}

function normalizeSegments(chunk: SpeechChunk): SpeechSegment[] {
  const segments: SpeechSegment[] = []
  for (const segment of chunk.segments) {
    const text = segment.text.trim()
    if (!text) continue
    const start = chunk.offsetSec + segment.start
    const end = chunk.offsetSec + segment.end
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    segments.push({ text, start, end })
  }
  return segments
}

export function buildSpeechTimeline(chunks: Iterable<SpeechChunk>): SpeechTimeline {
  const events: VisemeEvent[] = []
  let duration = 0

  for (const chunk of chunks) {
    for (const segment of normalizeSegments(chunk)) {
      const wordEvents = buildWordTimeline(segment.text, segment.start, segment.end)
      if (wordEvents.length === 0) continue
      events.push(...wordEvents)
      duration = Math.max(duration, segment.end)
    }
  }

  events.sort((left, right) => left.start - right.start)

  return {
    events,
    duration,
    sample(time: number): Partial<RigParams> {
      return sampleTimeline(events, time)
    },
    visemeAt(time: number): VisemeName | null {
      for (const event of events) {
        if (time >= event.start && time <= event.end) return event.viseme
      }
      return null
    },
  }
}

export function alignmentToChunk(
  offsetSec: number,
  segments: readonly SpeechSegment[],
): SpeechChunk {
  return { offsetSec, segments }
}

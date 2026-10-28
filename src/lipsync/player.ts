import type { EmotionName } from '../core/emotion.ts'
import type { RigEngine } from '../core/engine.ts'
import type { RigParams } from '../core/params.ts'
import {
  REST_VISEME_PARAMS,
  buildEmotionTimeline,
  buildMockTimeline,
  buildVisemeLoop,
  sampleTimeline,
} from './timeline.ts'
import type { EmotionCue, VisemeEvent } from './timeline.ts'

export interface PlayOptions {
  readonly loop?: boolean
  readonly cues?: readonly EmotionCue[]
  readonly onEmotion?: (emotion: EmotionName) => void
}

export interface MockOptions {
  readonly emotionTags?: boolean
  readonly onEmotion?: (emotion: EmotionName) => void
}

export class LipSyncPlayer {
  private readonly engine: RigEngine
  private events: readonly VisemeEvent[] = []
  private cues: readonly EmotionCue[] = []
  private onEmotion: ((emotion: EmotionName) => void) | null = null
  private cueIndex = 0
  private lastTime = 0
  private duration = 0
  private startedAt = 0
  private playing = false
  private loop = false

  constructor(engine: RigEngine) {
    this.engine = engine
  }

  play(events: readonly VisemeEvent[], options: PlayOptions = {}): void {
    if (events.length === 0) return
    this.events = events
    this.duration = events.at(-1)?.end ?? 0
    this.loop = options.loop ?? false
    this.cues = options.cues ?? []
    this.onEmotion = options.onEmotion ?? null
    this.cueIndex = 0
    this.lastTime = 0
    this.startedAt = performance.now()
    this.playing = true
    this.engine.setDriver(this.driver)
  }

  playVisemeLoop(): void {
    this.play(buildVisemeLoop(), { loop: true })
  }

  playMock(text: string, options: MockOptions = {}): void {
    if (options.emotionTags) {
      const timeline = buildEmotionTimeline(text)
      this.play(
        timeline.events,
        options.onEmotion
          ? { cues: timeline.cues, onEmotion: options.onEmotion }
          : { cues: timeline.cues },
      )
      return
    }
    this.play(buildMockTimeline(text))
  }

  stop(): void {
    this.playing = false
    this.cueIndex = 0
    this.engine.setDriver(null)
    this.engine.setTarget(REST_VISEME_PARAMS)
  }

  isPlaying(): boolean {
    return this.playing
  }

  private emitCues(time: number): void {
    if (this.loop && time < this.lastTime) this.cueIndex = 0
    this.lastTime = time
    while (this.cueIndex < this.cues.length) {
      const cue = this.cues[this.cueIndex]
      if (!cue || cue.at > time) break
      this.onEmotion?.(cue.emotion)
      this.cueIndex += 1
    }
  }

  private driver = (now: number): Partial<RigParams> | null => {
    if (!this.playing) return null
    if (this.duration <= 0) return { ...REST_VISEME_PARAMS }
    const elapsed = (now - this.startedAt) / 1000
    if (!this.loop && elapsed >= this.duration) {
      this.playing = false
      this.engine.setDriver(null)
      return { ...REST_VISEME_PARAMS }
    }
    const time = this.loop ? elapsed % this.duration : elapsed
    this.emitCues(time)
    return sampleTimeline(this.events, time)
  }
}

import type { RigEngine } from '../core/engine.ts'
import type { RigParams } from '../core/params.ts'
import {
  REST_VISEME_PARAMS,
  buildMockTimeline,
  buildVisemeLoop,
  sampleTimeline,
} from './timeline.ts'
import type { VisemeEvent } from './timeline.ts'

export interface PlayOptions {
  readonly loop?: boolean
}

export class LipSyncPlayer {
  private readonly engine: RigEngine
  private events: readonly VisemeEvent[] = []
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
    this.startedAt = performance.now()
    this.playing = true
    this.engine.setDriver(this.driver)
  }

  playVisemeLoop(): void {
    this.play(buildVisemeLoop(), { loop: true })
  }

  playMock(text: string): void {
    this.play(buildMockTimeline(text))
  }

  stop(): void {
    this.playing = false
    this.engine.setDriver(null)
    this.engine.setTarget(REST_VISEME_PARAMS)
  }

  isPlaying(): boolean {
    return this.playing
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
    return sampleTimeline(this.events, time)
  }
}

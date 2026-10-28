import {
  EMOTIONS,
  EMOTION_NAMES,
  EMOTION_FLASHES,
  clampWeight,
  mixEmotionShapes,
  scaleEmotionShape,
  sumEmotionShapes,
} from './emotion.ts'
import type { EmotionMixEntry, EmotionName, EmotionShape } from './emotion.ts'

export const MOOD_DEFAULT_MS = 450
export const MOOD_MIN_MS = 300
export const MOOD_MAX_MS = 600
export const REACTION_DEFAULT_MS = 1800
export const REACTION_MIN_MS = 1000
export const REACTION_MAX_MS = 3000
export const FLASH_DEFAULT_MS = 110
export const FLASH_MIN_MS = 80
export const FLASH_MAX_MS = 150

const FLASH_ATTACK = 0.3
const REACTION_ATTACK = 0.06

export interface MoodOptions {
  readonly weight?: number
  readonly transitionMs?: number
  readonly flash?: boolean
  readonly flashMs?: number
}

export interface ClearMoodOptions {
  readonly transitionMs?: number
}

export interface ReactionOptions {
  readonly weight?: number
  readonly decayMs?: number
}

export interface MoodEntryState {
  readonly emotion: EmotionName
  readonly weight: number
  readonly target: number
}

export interface ReactionState {
  readonly emotion: EmotionName
  readonly weight: number
  readonly remainingMs: number
}

export interface FlashState {
  readonly emotion: EmotionName
  readonly remainingMs: number
}

export interface EmotionState {
  readonly mood: readonly MoodEntryState[]
  readonly reactions: readonly ReactionState[]
  readonly flash: FlashState | null
  readonly transition: number
  readonly delta: EmotionShape
}

interface MoodTrack {
  current: number
  from: number
  target: number
}

interface ReactionTrack {
  readonly emotion: EmotionName
  readonly weight: number
  readonly duration: number
  elapsed: number
}

interface FlashTrack {
  readonly emotion: EmotionName
  readonly weight: number
  readonly duration: number
  elapsed: number
}

function clampMs(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

function flashEnvelope(track: FlashTrack): number {
  const progress = track.elapsed / track.duration
  if (progress <= 0 || progress >= 1) return 0
  return progress < FLASH_ATTACK
    ? progress / FLASH_ATTACK
    : (1 - progress) / (1 - FLASH_ATTACK)
}

function reactionEnvelope(track: ReactionTrack): number {
  const progress = track.elapsed / track.duration
  if (progress >= 1) return 0
  const attack = Math.min(1, progress / REACTION_ATTACK)
  const remaining = 1 - progress
  return attack * remaining * remaining
}

export class EmotionMixer {
  private mood = new Map<EmotionName, MoodTrack>()
  private reactions: ReactionTrack[] = []
  private flashes: FlashTrack[] = []
  private transitionSeconds = MOOD_DEFAULT_MS / 1000
  private transitionElapsed = 0
  private delta: EmotionShape = {}

  setMood(emotion: EmotionName, options: MoodOptions = {}): void {
    this.setMoodMix([{ emotion, weight: options.weight ?? 1 }], options)
  }

  setMoodMix(entries: readonly EmotionMixEntry[], options: MoodOptions = {}): void {
    const targets = new Map<EmotionName, number>()
    for (const entry of entries) {
      if (!EMOTION_NAMES.includes(entry.emotion)) continue
      const weight = clampWeight(entry.weight)
      if (weight <= 0) continue
      targets.set(entry.emotion, Math.min(1, (targets.get(entry.emotion) ?? 0) + weight))
    }

    targets.delete('neutral')
    this.beginTransition(targets, options.transitionMs)

    if (options.flash !== false) {
      for (const [emotion, weight] of targets) {
        this.startFlash(emotion, weight, options.flashMs)
      }
    }
  }

  clearMood(options: ClearMoodOptions = {}): void {
    this.beginTransition(new Map(), options.transitionMs)
  }

  trigger(emotion: EmotionName, options: ReactionOptions = {}): void {
    const weight = clampWeight(options.weight ?? 1)
    if (weight <= 0 || emotion === 'neutral') return
    const duration = clampMs(options.decayMs, REACTION_MIN_MS, REACTION_MAX_MS, REACTION_DEFAULT_MS)
    this.reactions.push({
      emotion,
      weight,
      duration: duration / 1000,
      elapsed: 0,
    })
  }

  reset(): void {
    this.mood.clear()
    this.reactions = []
    this.flashes = []
    this.transitionElapsed = 0
    this.transitionSeconds = MOOD_DEFAULT_MS / 1000
    this.delta = {}
  }

  hasActivity(): boolean {
    return this.mood.size > 0 || this.reactions.length > 0 || this.flashes.length > 0
  }

  getDelta(): EmotionShape {
    return { ...this.delta }
  }

  getState(): EmotionState {
    return {
      mood: [...this.mood.entries()]
        .filter(([, track]) => track.current > 0)
        .map(([emotion, track]) => ({ emotion, weight: track.current, target: track.target })),
      reactions: this.reactions.map((track) => ({
        emotion: track.emotion,
        weight: track.weight * reactionEnvelope(track),
        remainingMs: Math.max(0, (track.duration - track.elapsed) * 1000),
      })),
      flash: this.flashState(),
      transition:
        this.transitionSeconds <= 0
          ? 1
          : Math.min(1, this.transitionElapsed / this.transitionSeconds),
      delta: { ...this.delta },
    }
  }

  update(dt: number): EmotionShape {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0
    this.advanceMood(step)
    this.advanceFlashes(step)
    this.advanceReactions(step)
    this.delta = this.compose()
    return { ...this.delta }
  }

  private beginTransition(
    targets: ReadonlyMap<EmotionName, number>,
    transitionMs: number | undefined,
  ): void {
    const names = new Set<EmotionName>([...this.mood.keys(), ...targets.keys()])
    const next = new Map<EmotionName, MoodTrack>()

    for (const name of names) {
      const current = this.mood.get(name)?.current ?? 0
      next.set(name, {
        current,
        from: current,
        target: targets.get(name) ?? 0,
      })
    }

    this.mood = next
    this.transitionSeconds =
      clampMs(transitionMs, MOOD_MIN_MS, MOOD_MAX_MS, MOOD_DEFAULT_MS) / 1000
    this.transitionElapsed = 0
  }

  private startFlash(emotion: EmotionName, weight: number, flashMs: number | undefined): void {
    const duration = clampMs(flashMs, FLASH_MIN_MS, FLASH_MAX_MS, FLASH_DEFAULT_MS)
    this.flashes = this.flashes.filter((track) => track.emotion !== emotion)
    this.flashes.push({
      emotion,
      weight,
      duration: duration / 1000,
      elapsed: 0,
    })
  }

  private advanceMood(dt: number): void {
    if (this.mood.size === 0) return

    if (this.transitionSeconds <= 0) {
      this.transitionElapsed = 0
    } else if (this.transitionElapsed < this.transitionSeconds) {
      this.transitionElapsed = Math.min(this.transitionSeconds, this.transitionElapsed + dt)
    }

    const progress =
      this.transitionSeconds <= 0 ? 1 : this.transitionElapsed / this.transitionSeconds
    const eased = smoothstep(progress)

    for (const [emotion, track] of this.mood) {
      track.current = track.from + (track.target - track.from) * eased
      if (progress >= 1) {
        track.current = track.target
        track.from = track.target
        if (track.target <= 0) this.mood.delete(emotion)
      }
    }
  }

  private advanceFlashes(dt: number): void {
    if (this.flashes.length === 0) return
    for (const track of this.flashes) track.elapsed += dt
    this.flashes = this.flashes.filter((track) => track.elapsed < track.duration)
  }

  private advanceReactions(dt: number): void {
    if (this.reactions.length === 0) return
    for (const track of this.reactions) track.elapsed += dt
    this.reactions = this.reactions.filter((track) => track.elapsed < track.duration)
  }

  private flashState(): FlashState | null {
    const track = this.flashes.at(-1)
    if (!track) return null
    return {
      emotion: track.emotion,
      remainingMs: Math.max(0, (track.duration - track.elapsed) * 1000),
    }
  }

  private compose(): EmotionShape {
    const shapes: EmotionShape[] = []

    const moodEntries: EmotionMixEntry[] = [...this.mood.entries()]
      .filter(([, track]) => track.current > 0)
      .map(([emotion, track]) => ({ emotion, weight: track.current }))
    if (moodEntries.length > 0) shapes.push(mixEmotionShapes(moodEntries))

    for (const flash of this.flashes) {
      shapes.push(
        scaleEmotionShape(EMOTION_FLASHES[flash.emotion], flash.weight * flashEnvelope(flash)),
      )
    }

    for (const reaction of this.reactions) {
      shapes.push(
        scaleEmotionShape(
          EMOTIONS[reaction.emotion],
          reaction.weight * reactionEnvelope(reaction),
        ),
      )
    }

    return sumEmotionShapes(shapes)
  }
}

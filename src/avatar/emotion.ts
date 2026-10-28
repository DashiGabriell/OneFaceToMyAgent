import type { EmotionLayer, EmotionMixEntry, EmotionName } from '../core/emotion.ts'
import type {
  ClearMoodOptions,
  MoodOptions,
  ReactionOptions,
} from '../core/emotion-mixer.ts'
import type { EmotionMixer } from '../core/emotion-mixer.ts'

export interface SetEmotionOptions extends MoodOptions {
  readonly layer?: EmotionLayer
  readonly decayMs?: number
}

export interface EmotionController {
  readonly mixer: EmotionMixer
  setEmotion(emotion: EmotionName, options?: SetEmotionOptions): void
  setEmotionMix(entries: readonly EmotionMixEntry[], options?: MoodOptions): void
  clearEmotion(options?: ClearMoodOptions): void
  react(emotion: EmotionName, options?: ReactionOptions): void
  reset(): void
}

export function createEmotionController(mixer: EmotionMixer): EmotionController {
  return {
    mixer,
    setEmotion: (emotion, options) => {
      if (options?.layer === 'reaction') {
        const weight = options.weight ?? 1
        mixer.trigger(
          emotion,
          options.decayMs === undefined ? { weight } : { weight, decayMs: options.decayMs },
        )
        return
      }
      mixer.setMood(emotion, options)
    },
    setEmotionMix: (entries, options) => mixer.setMoodMix(entries, options),
    clearEmotion: (options) => mixer.clearMood(options),
    react: (emotion, options) => mixer.trigger(emotion, options),
    reset: () => mixer.reset(),
  }
}

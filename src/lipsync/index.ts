export { VISEME_CHANNELS, VISEME_NAMES, VISEMES, visemeShape } from './visemes.ts'
export type { VisemeName, VisemeShape } from './visemes.ts'
export { normalizeWord, wordToUnits, wordToVisemes } from './phonemes.ts'
export type { SpokenUnit } from './phonemes.ts'
export {
  EMOTION_CUE_GAP,
  REST_VISEME_PARAMS,
  buildEmotionTimeline,
  buildMockSegments,
  buildMockTimeline,
  buildTimeline,
  buildVisemeLoop,
  buildWordTimeline,
  sampleTimeline,
  timelineDuration,
} from './timeline.ts'
export type { EmotionCue, EmotionTimeline, VisemeEvent, WordSegment } from './timeline.ts'
export { LipSyncPlayer } from './player.ts'
export type { MockOptions, PlayOptions } from './player.ts'
export { ResidualLips } from './residual.ts'

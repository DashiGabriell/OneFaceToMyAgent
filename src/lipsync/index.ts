export { VISEME_CHANNELS, VISEME_NAMES, VISEMES, visemeShape } from './visemes.ts'
export type { VisemeName, VisemeShape } from './visemes.ts'
export { normalizeWord, wordToUnits, wordToVisemes } from './phonemes.ts'
export type { SpokenUnit } from './phonemes.ts'
export {
  REST_VISEME_PARAMS,
  buildMockSegments,
  buildMockTimeline,
  buildTimeline,
  buildVisemeLoop,
  buildWordTimeline,
  sampleTimeline,
  timelineDuration,
} from './timeline.ts'
export type { VisemeEvent, WordSegment } from './timeline.ts'
export { LipSyncPlayer } from './player.ts'
export type { PlayOptions } from './player.ts'

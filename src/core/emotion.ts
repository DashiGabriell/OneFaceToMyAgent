import { RIG_CHANNEL_KEYS } from './params.ts'
import type { RigParams } from './params.ts'

export const EMOTION_NAMES = ['neutral', 'happy', 'sad', 'surprised', 'thinking'] as const

export type EmotionName = (typeof EMOTION_NAMES)[number]
export type EmotionLayer = 'mood' | 'reaction'
export type EmotionShape = Partial<RigParams>

export const EMOTION_LABELS: Record<EmotionName, string> = {
  neutral: 'Neutro',
  happy: 'Feliz',
  sad: 'Triste',
  surprised: 'Surpreso',
  thinking: 'Pensando',
}

export const EMOTIONS = {
  neutral: {},
  happy: {
    browRaiseL: 0.24,
    browRaiseR: 0.18,
    browAngleL: -0.2,
    browAngleR: -0.12,
    cheekRaise: 0.5,
    squintL: 0.34,
    squintR: 0.26,
    mouthCornerL: 0.62,
    mouthCornerR: 0.52,
    mouthWidth: 0.22,
    lipUpperRaise: 0.1,
    lipLowerDrop: 0.06,
    teethVisible: 0.08,
    headPitch: -1.2,
    headRoll: 0.7,
    headY: -1.2,
  },
  sad: {
    browRaiseL: 0.18,
    browRaiseR: 0.26,
    browAngleL: 0.62,
    browAngleR: 0.72,
    eyelidOpenL: -0.18,
    eyelidOpenR: -0.14,
    squintL: 0.12,
    squintR: 0.1,
    gazeY: -0.4,
    pupilDilate: 0.14,
    mouthWidth: -0.2,
    lipPress: 0.38,
    lipLowerDrop: 0.12,
    headPitch: 1.6,
    headRoll: -0.8,
    headY: 2.4,
  },
  surprised: {
    browRaiseL: 1,
    browRaiseR: 0.94,
    browAngleL: -0.1,
    browAngleR: -0.06,
    squintL: 0,
    squintR: 0,
    noseFlare: 0.26,
    cheekRaise: 0.08,
    jawOpen: 0.4,
    mouthWidth: -0.04,
    lipUpperRaise: 0.2,
    lipLowerDrop: 0.35,
    teethVisible: 0.35,
    pupilDilate: 0.6,
    headPitch: -2.4,
    headRoll: 0.2,
    headYaw: 0.4,
    headY: -4,
  },
  thinking: {
    browRaiseL: 0.34,
    browRaiseR: 0.08,
    browAngleL: -0.4,
    browAngleR: 0.5,
    squintL: 0.32,
    squintR: 0.12,
    gazeX: 0.55,
    gazeY: -0.3,
    pupilDilate: 0.22,
    cheekRaise: 0.06,
    mouthWidth: -0.22,
    lipPress: 0.45,
    mouthCornerL: 0.2,
    mouthCornerR: 0.06,
    headRoll: 1.8,
    headYaw: -3.2,
    headPitch: 0.8,
    headY: 0.6,
  },
} as const satisfies Record<EmotionName, EmotionShape>

export const EMOTION_FLASHES = {
  neutral: {},
  happy: {
    browRaiseL: 0.45,
    browRaiseR: 0.35,
    browAngleL: -0.25,
    browAngleR: -0.15,
    cheekRaise: 0.55,
    squintL: 0.4,
    squintR: 0.3,
    mouthCornerL: 0.35,
    mouthCornerR: 0.3,
    mouthWidth: 0.15,
  },
  sad: {
    browRaiseL: 0.3,
    browRaiseR: 0.4,
    browAngleL: 0.6,
    browAngleR: 0.7,
    eyelidOpenL: -0.22,
    eyelidOpenR: -0.18,
    lipPress: 0.3,
    headPitch: 1.2,
  },
  surprised: {
    browRaiseL: 1,
    browRaiseR: 0.95,
    pupilDilate: 0.7,
    jawOpen: 0.25,
    teethVisible: 0.3,
    headPitch: -1.5,
    headY: -2,
  },
  thinking: {
    browRaiseL: 0.5,
    browRaiseR: 0.1,
    browAngleR: 0.5,
    squintL: 0.4,
    gazeX: 0.35,
    gazeY: -0.25,
    lipPress: 0.35,
    headRoll: 1.2,
  },
} as const satisfies Record<EmotionName, EmotionShape>

export interface EmotionMixEntry {
  readonly emotion: EmotionName
  readonly weight: number
}

export function scaleEmotionShape(shape: EmotionShape, weight: number): EmotionShape {
  if (!Number.isFinite(weight) || weight <= 0) return {}
  const scaled: EmotionShape = {}
  for (const channel of RIG_CHANNEL_KEYS) {
    const value = shape[channel]
    if (value === undefined || value === 0) continue
    scaled[channel] = value * weight
  }
  return scaled
}

export function sumEmotionShapes(shapes: readonly EmotionShape[]): EmotionShape {
  const total: EmotionShape = {}
  for (const shape of shapes) {
    for (const channel of RIG_CHANNEL_KEYS) {
      const value = shape[channel]
      if (value === undefined) continue
      total[channel] = (total[channel] ?? 0) + value
    }
  }
  return total
}

export function mixEmotionShapes(entries: readonly EmotionMixEntry[]): EmotionShape {
  const active = entries.filter((entry) => entry.weight > 0 && Number.isFinite(entry.weight))
  if (active.length === 0) return {}

  const weightSum = active.reduce((sum, entry) => sum + entry.weight, 0)
  const scale = 1 / Math.max(1, weightSum)
  const mixed: EmotionShape = {}

  for (const channel of RIG_CHANNEL_KEYS) {
    let value = 0
    for (const entry of active) {
      const shape: EmotionShape = EMOTIONS[entry.emotion]
      value += (shape[channel] ?? 0) * entry.weight
    }
    if (value !== 0) mixed[channel] = value * scale
  }

  return mixed
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

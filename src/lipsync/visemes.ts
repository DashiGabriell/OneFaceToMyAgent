import type { RigChannel, RigParams } from '../core/params.ts'

export const VISEME_NAMES = [
  'rest',
  'mbp',
  'fv',
  'l',
  'a',
  'e',
  'i',
  'o',
  'u',
  'nasal',
  'sibilant',
  'dtn',
] as const

export type VisemeName = (typeof VISEME_NAMES)[number]
export type VisemeShape = Partial<RigParams>

export const VISEME_CHANNELS = [
  'jawOpen',
  'mouthWidth',
  'mouthCornerL',
  'mouthCornerR',
  'lipUpperRaise',
  'lipLowerDrop',
  'lipPress',
  'lipPucker',
  'tongueTip',
  'teethVisible',
] as const satisfies readonly RigChannel[]

export const VISEMES = {
  rest: {
    jawOpen: 0.03,
    mouthWidth: 0,
    lipPress: 0.12,
    teethVisible: 0.05,
  },
  mbp: {
    jawOpen: 0.02,
    mouthWidth: -0.08,
    lipPress: 0.95,
    lipUpperRaise: 0.02,
    lipLowerDrop: 0.02,
  },
  fv: {
    jawOpen: 0.1,
    mouthWidth: 0.02,
    lipLowerDrop: 0.18,
    teethVisible: 0.45,
    lipPress: 0.15,
  },
  l: {
    jawOpen: 0.28,
    mouthWidth: 0.05,
    lipUpperRaise: 0.08,
    tongueTip: 0.85,
    teethVisible: 0.25,
  },
  a: {
    jawOpen: 0.9,
    mouthWidth: 0.05,
    lipUpperRaise: 0.1,
    lipLowerDrop: 0.45,
    tongueTip: 0.1,
    teethVisible: 0.35,
  },
  e: {
    jawOpen: 0.45,
    mouthWidth: 0.5,
    lipUpperRaise: 0.15,
    lipLowerDrop: 0.1,
    teethVisible: 0.5,
  },
  i: {
    jawOpen: 0.24,
    mouthWidth: 0.6,
    lipUpperRaise: 0.22,
    lipLowerDrop: 0.05,
    teethVisible: 0.55,
  },
  o: {
    jawOpen: 0.55,
    mouthWidth: -0.35,
    lipLowerDrop: 0.25,
    lipPucker: 0.65,
    teethVisible: 0.15,
  },
  u: {
    jawOpen: 0.32,
    mouthWidth: -0.55,
    lipLowerDrop: 0.1,
    lipPucker: 0.9,
    teethVisible: 0.05,
  },
  nasal: {
    jawOpen: 0.28,
    mouthWidth: -0.08,
    lipLowerDrop: 0.1,
    lipPress: 0.2,
    tongueTip: 0.2,
    teethVisible: 0.15,
  },
  sibilant: {
    jawOpen: 0.18,
    mouthWidth: 0.45,
    lipUpperRaise: 0.12,
    lipLowerDrop: 0.12,
    teethVisible: 0.65,
  },
  dtn: {
    jawOpen: 0.22,
    mouthWidth: 0.12,
    lipUpperRaise: 0.08,
    lipLowerDrop: 0.08,
    tongueTip: 0.3,
    teethVisible: 0.45,
  },
} as const satisfies Record<VisemeName, VisemeShape>

export function visemeShape(name: VisemeName): VisemeShape {
  return { ...VISEMES[name] }
}

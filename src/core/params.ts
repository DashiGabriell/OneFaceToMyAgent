export type RigGroup = 'Cabeça' | 'Sobrancelhas' | 'Olhos' | 'Nariz' | 'Boca' | 'Pescoço'

export interface RigChannelSpec {
  readonly min: number
  readonly max: number
  readonly default: number
  readonly label: string
  readonly group: RigGroup
  readonly stiffness: number
  readonly damping: number
}

export const RIG_GROUPS: readonly RigGroup[] = [
  'Cabeça',
  'Sobrancelhas',
  'Olhos',
  'Nariz',
  'Boca',
  'Pescoço',
]

export const RIG_CHANNELS = {
  headYaw: {
    min: -8,
    max: 8,
    default: 0,
    label: 'Giro horizontal',
    group: 'Cabeça',
    stiffness: 55,
    damping: 13,
  },
  headPitch: {
    min: -5,
    max: 5,
    default: 0,
    label: 'Giro vertical',
    group: 'Cabeça',
    stiffness: 55,
    damping: 13,
  },
  headRoll: {
    min: -3,
    max: 3,
    default: 0,
    label: 'Inclinação lateral',
    group: 'Cabeça',
    stiffness: 55,
    damping: 13,
  },
  headX: {
    min: -20,
    max: 20,
    default: 0,
    label: 'Deslocamento X',
    group: 'Cabeça',
    stiffness: 70,
    damping: 15,
  },
  headY: {
    min: -16,
    max: 16,
    default: 0,
    label: 'Deslocamento Y',
    group: 'Cabeça',
    stiffness: 70,
    damping: 15,
  },
  browRaiseL: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Sobrancelha esquerda sobe',
    group: 'Sobrancelhas',
    stiffness: 190,
    damping: 22,
  },
  browRaiseR: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Sobrancelha direita sobe',
    group: 'Sobrancelhas',
    stiffness: 190,
    damping: 22,
  },
  browAngleL: {
    min: -1,
    max: 1,
    default: 0,
    label: 'Ângulo da sobrancelha esquerda',
    group: 'Sobrancelhas',
    stiffness: 190,
    damping: 22,
  },
  browAngleR: {
    min: -1,
    max: 1,
    default: 0,
    label: 'Ângulo da sobrancelha direita',
    group: 'Sobrancelhas',
    stiffness: 190,
    damping: 22,
  },
  eyelidOpenL: {
    min: 0,
    max: 1,
    default: 1,
    label: 'Abertura da pálpebra esquerda',
    group: 'Olhos',
    stiffness: 320,
    damping: 26,
  },
  eyelidOpenR: {
    min: 0,
    max: 1,
    default: 1,
    label: 'Abertura da pálpebra direita',
    group: 'Olhos',
    stiffness: 320,
    damping: 26,
  },
  squintL: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Apertar do olho esquerdo',
    group: 'Olhos',
    stiffness: 220,
    damping: 22,
  },
  squintR: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Apertar do olho direito',
    group: 'Olhos',
    stiffness: 220,
    damping: 22,
  },
  gazeX: {
    min: -1,
    max: 1,
    default: 0,
    label: 'Olhar horizontal',
    group: 'Olhos',
    stiffness: 260,
    damping: 24,
  },
  gazeY: {
    min: -1,
    max: 1,
    default: 0,
    label: 'Olhar vertical',
    group: 'Olhos',
    stiffness: 260,
    damping: 24,
  },
  pupilDilate: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Dilatação da pupila',
    group: 'Olhos',
    stiffness: 180,
    damping: 20,
  },
  noseFlare: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Dilatação do nariz',
    group: 'Nariz',
    stiffness: 220,
    damping: 22,
  },
  cheekRaise: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Elevação da maçã do rosto',
    group: 'Nariz',
    stiffness: 180,
    damping: 20,
  },
  jawOpen: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Abertura da mandíbula',
    group: 'Boca',
    stiffness: 300,
    damping: 26,
  },
  mouthWidth: {
    min: -1,
    max: 1,
    default: 0,
    label: 'Largura da boca',
    group: 'Boca',
    stiffness: 280,
    damping: 24,
  },
  mouthCornerL: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Canto esquerdo da boca',
    group: 'Boca',
    stiffness: 280,
    damping: 24,
  },
  mouthCornerR: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Canto direito da boca',
    group: 'Boca',
    stiffness: 280,
    damping: 24,
  },
  lipUpperRaise: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Elevação do lábio superior',
    group: 'Boca',
    stiffness: 300,
    damping: 26,
  },
  lipLowerDrop: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Queda do lábio inferior',
    group: 'Boca',
    stiffness: 300,
    damping: 26,
  },
  lipPress: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Pressão dos lábios',
    group: 'Boca',
    stiffness: 300,
    damping: 26,
  },
  lipPucker: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Bico dos lábios',
    group: 'Boca',
    stiffness: 300,
    damping: 26,
  },
  tongueTip: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Ponta da língua',
    group: 'Boca',
    stiffness: 260,
    damping: 22,
  },
  teethVisible: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Exposição dos dentes',
    group: 'Boca',
    stiffness: 260,
    damping: 24,
  },
  breath: {
    min: 0,
    max: 1,
    default: 0,
    label: 'Respiração',
    group: 'Pescoço',
    stiffness: 36,
    damping: 10,
  },
} as const satisfies Record<string, RigChannelSpec>

export type RigChannel = keyof typeof RIG_CHANNELS
export type RigParams = { [K in RigChannel]: number }

export const RIG_CHANNEL_KEYS = Object.keys(RIG_CHANNELS) as RigChannel[]
export const RIG_CHANNEL_COUNT = RIG_CHANNEL_KEYS.length

export const DEFAULT_RIG_PARAMS = RIG_CHANNEL_KEYS.reduce((params, channel) => {
  params[channel] = RIG_CHANNELS[channel].default
  return params
}, {} as RigParams)

export function clampChannel(channel: RigChannel, value: number): number {
  const spec = RIG_CHANNELS[channel]
  if (!Number.isFinite(value)) return spec.default
  return Math.min(spec.max, Math.max(spec.min, value))
}

export function clampParams(params: RigParams): RigParams {
  const clamped = {} as RigParams
  for (const channel of RIG_CHANNEL_KEYS) {
    clamped[channel] = clampChannel(channel, params[channel])
  }
  return clamped
}

export function resolveParams(
  partial: Partial<RigParams>,
  base: RigParams = DEFAULT_RIG_PARAMS,
): RigParams {
  const next = { ...base }
  for (const channel of RIG_CHANNEL_KEYS) {
    const value = partial[channel]
    if (value !== undefined) next[channel] = value
  }
  return clampParams(next)
}

export function mergeParams(base: RigParams, delta: Partial<RigParams>): RigParams {
  const next = { ...base }
  for (const channel of RIG_CHANNEL_KEYS) {
    const value = delta[channel]
    if (value !== undefined) next[channel] += value
  }
  return clampParams(next)
}

export function channelsInGroup(group: RigGroup): RigChannel[] {
  return RIG_CHANNEL_KEYS.filter((channel) => RIG_CHANNELS[channel].group === group)
}

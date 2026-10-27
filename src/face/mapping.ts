import type { RigChannel, RigParams } from '../core/params.ts'
import type { FacePart } from './parts.ts'

export interface PartStyle {
  readonly transform: string
  readonly opacity?: number
}

export type PartStyles = Partial<Record<FacePart, PartStyle>>

export const CHANNEL_TARGETS = {
  headYaw: ['head'],
  headPitch: ['head'],
  headRoll: ['head'],
  headX: ['head'],
  headY: ['head'],
  browRaiseL: ['browL'],
  browRaiseR: ['browR'],
  browAngleL: ['browL'],
  browAngleR: ['browR'],
  eyelidOpenL: ['eyelidUpperL', 'eyelidLowerL'],
  eyelidOpenR: ['eyelidUpperR', 'eyelidLowerR'],
  squintL: ['eyelidUpperL', 'eyelidLowerL'],
  squintR: ['eyelidUpperR', 'eyelidLowerR'],
  gazeX: ['irisL', 'irisR'],
  gazeY: ['irisL', 'irisR'],
  pupilDilate: ['pupilL', 'pupilR'],
  noseFlare: ['nose', 'nostrilL', 'nostrilR'],
  cheekRaise: ['cheekL', 'cheekR'],
  jawOpen: ['jaw', 'mouthCavity', 'teethUpper', 'teethLower', 'lipUpper', 'lipLower'],
  mouthWidth: ['mouth'],
  mouthCornerL: ['mouth'],
  mouthCornerR: ['mouth'],
  lipUpperRaise: ['lipUpper'],
  lipLowerDrop: ['lipLower'],
  lipPress: ['lipUpper', 'lipLower'],
  lipPucker: ['lipUpper', 'lipLower'],
  tongueTip: ['tongue', 'lipUpper', 'lipLower'],
  teethVisible: ['teethUpper', 'teethLower', 'lipUpper', 'lipLower'],
  breath: ['head', 'neck'],
} as const satisfies Record<RigChannel, readonly FacePart[]>

function format(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function px(value: number): string {
  return `${format(value)}px`
}

function deg(value: number): string {
  return `${format(value)}deg`
}

export function computePartStyles(params: RigParams): PartStyles {
  const styles: PartStyles = {}
  const headLift = -params.breath * 4

  styles.head = {
    transform: `perspective(1600px) translate(${px(params.headX)}, ${px(params.headY + headLift)}) rotateZ(${deg(params.headRoll)}) rotateY(${deg(params.headYaw)}) rotateX(${deg(params.headPitch)})`,
  }
  styles.neck = {
    transform: `scale(1, ${format(1 + params.breath * 0.04)})`,
  }

  styles.browL = {
    transform: `translateY(${px(-10 * params.browRaiseL)}) rotate(${deg(-6 * params.browAngleL)})`,
  }
  styles.browR = {
    transform: `translateY(${px(-10 * params.browRaiseR)}) rotate(${deg(6 * params.browAngleR)})`,
  }

  styles.irisL = {
    transform: `translate(${px(params.gazeX * 10)}, ${px(params.gazeY * 7)})`,
  }
  styles.irisR = {
    transform: `translate(${px(params.gazeX * 10)}, ${px(params.gazeY * 7)})`,
  }
  styles.pupilL = {
    transform: `scale(${format(1 + params.pupilDilate * 0.5)})`,
  }
  styles.pupilR = {
    transform: `scale(${format(1 + params.pupilDilate * 0.5)})`,
  }

  const lidUpperL = (1 - params.eyelidOpenL) * 46 + params.squintL * 10
  const lidUpperR = (1 - params.eyelidOpenR) * 46 + params.squintR * 10
  const lidLowerL = -((1 - params.eyelidOpenL) * 16 + params.squintL * 8)
  const lidLowerR = -((1 - params.eyelidOpenR) * 16 + params.squintR * 8)
  styles.eyelidUpperL = { transform: `translateY(${px(lidUpperL)})` }
  styles.eyelidUpperR = { transform: `translateY(${px(lidUpperR)})` }
  styles.eyelidLowerL = { transform: `translateY(${px(lidLowerL)})` }
  styles.eyelidLowerR = { transform: `translateY(${px(lidLowerR)})` }

  styles.cheekL = {
    transform: `translateY(${px(-8 * params.cheekRaise)}) scale(${format(1 + params.cheekRaise * 0.05)})`,
  }
  styles.cheekR = {
    transform: `translateY(${px(-8 * params.cheekRaise)}) scale(${format(1 + params.cheekRaise * 0.05)})`,
  }

  styles.nose = {
    transform: `scale(${format(1 + params.noseFlare * 0.07)}, ${format(1 + params.noseFlare * 0.04)})`,
  }
  styles.nostrilL = {
    transform: `scale(${format(1 + params.noseFlare * 0.35)}, ${format(1 + params.noseFlare * 0.18)})`,
  }
  styles.nostrilR = {
    transform: `scale(${format(1 + params.noseFlare * 0.35)}, ${format(1 + params.noseFlare * 0.18)})`,
  }

  styles.jaw = {
    transform: `translateY(${px(8 * params.jawOpen)}) scaleY(${format(1 + params.jawOpen * 0.05)})`,
  }
  styles.mouthCavity = {
    transform: `scaleY(${format(0.65 + params.jawOpen * 0.35)})`,
  }

  const mouthLift = -(params.mouthCornerL + params.mouthCornerR) * 3
  const mouthTilt = (params.mouthCornerL - params.mouthCornerR) * 3.2
  styles.mouth = {
    transform: `translateY(${px(mouthLift)}) rotate(${deg(mouthTilt)}) scaleX(${format(1 + params.mouthWidth * 0.14)})`,
  }

  styles.teethUpper = {
    transform: `translateY(${px(-5 * params.jawOpen - 5 * params.teethVisible)}) scaleY(${format(0.65 + params.teethVisible * 0.35)})`,
  }
  styles.teethLower = {
    transform: `translateY(${px(5 * params.jawOpen + 5 * params.teethVisible)}) scaleY(${format(0.65 + params.teethVisible * 0.35)})`,
  }
  styles.tongue = {
    transform: `translateY(${px(-16 * params.tongueTip)}) scale(${format(1 + params.tongueTip * 0.15)}, ${format(1 + params.tongueTip * 0.35)})`,
  }

  const lipUpperY =
    -18 * params.jawOpen -
    12 * params.lipUpperRaise -
    3 * params.teethVisible -
    3 * params.tongueTip +
    7 * params.lipPress
  const lipLowerY =
    20 * params.jawOpen +
    12 * params.lipLowerDrop +
    5 * params.teethVisible +
    12 * params.tongueTip -
    7 * params.lipPress
  const lipScaleX = format(1 - params.lipPucker * 0.12)
  const lipScaleY = format(1 - params.lipPress * 0.09)
  styles.lipUpper = {
    transform: `translateY(${px(lipUpperY)}) scale(${lipScaleX}, ${lipScaleY})`,
  }
  styles.lipLower = {
    transform: `translateY(${px(lipLowerY)}) scale(${lipScaleX}, ${lipScaleY})`,
  }

  return styles
}

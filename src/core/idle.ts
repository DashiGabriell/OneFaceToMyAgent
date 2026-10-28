import { createPrng, prngChance, prngRange } from './prng.ts'
import type { Prng } from './prng.ts'
import { RIG_CHANNEL_KEYS } from './params.ts'
import type { RigParams } from './params.ts'

export interface IdleOptions {
  readonly blinkRange?: readonly [number, number]
  readonly headAccentRate?: number
  readonly reducedMotion?: boolean
  readonly seed?: number
}

export interface IdleInput {
  readonly speaking: boolean
  readonly energy?: number
}

const BLINK_CLOSE_S = 0.045
const BLINK_HOLD_S = 0.035
const BLINK_OPEN_S = 0.09
const DOUBLE_BLINK_CHANCE = 0.1
const BREATH_HZ = 0.22
const GAZE_SACCADES_MIN_S = 0.45
const GAZE_SACCADES_MAX_S = 1.35

type BlinkPhase = 'idle' | 'close' | 'hold' | 'open'

export class IdleSimulator {
  private readonly random: Prng
  private blinkRange: readonly [number, number]
  private headAccentRate: number
  private reducedMotion: boolean
  private elapsed = 0
  private nextBlinkAt: number
  private blinkPhase: BlinkPhase = 'idle'
  private blinkElapsed = 0
  private blinkPendingDouble = false
  private blinkAsymmetry = 0.08
  private gazeNextAt = 0
  private gazeX = 0
  private gazeY = 0
  private gazeTargetX = 0
  private gazeTargetY = 0
  private readonly driftPhase: readonly [number, number, number, number, number]
  private energySmooth = 0
  private nod = 0
  private browPulse = 0

  constructor(options: IdleOptions = {}) {
    this.random = createPrng(options.seed ?? 0xface42)
    this.blinkRange = options.blinkRange ?? [2, 6]
    this.headAccentRate = options.headAccentRate ?? 0.35
    this.reducedMotion = options.reducedMotion ?? false
    this.nextBlinkAt = prngRange(this.random, this.blinkRange[0], this.blinkRange[1])
    this.gazeNextAt = prngRange(this.random, GAZE_SACCADES_MIN_S, GAZE_SACCADES_MAX_S)
    this.driftPhase = [
      this.random() * Math.PI * 2,
      this.random() * Math.PI * 2,
      this.random() * Math.PI * 2,
      this.random() * Math.PI * 2,
      this.random() * Math.PI * 2,
    ]
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value
    if (value) {
      this.nod = 0
      this.browPulse = 0
    }
  }

  setBlinkRange(range: readonly [number, number]): void {
    this.blinkRange = range
  }

  setHeadAccentRate(rate: number): void {
    this.headAccentRate = Math.min(1, Math.max(0, rate))
  }

  anticipateBlink(): void {
    if (this.blinkPhase !== 'idle') return
    this.nextBlinkAt = this.elapsed + prngRange(this.random, 0.12, 0.28)
  }

  update(dt: number, input: IdleInput): Partial<RigParams> {
    const step = Math.max(0, Math.min(dt, 0.05))
    this.elapsed += step

    const blink = this.stepBlink(step)
    const breath = this.stepBreath()
    const gaze = this.stepGaze(step)
    const drift = this.reducedMotion ? {} : this.stepDrift()
    const prosody = this.reducedMotion ? {} : this.stepProsody(step, input)

    return sumPartials(drift, gaze, breath, prosody, blink)
  }

  private stepBlink(dt: number): Partial<RigParams> {
    if (this.blinkPhase === 'idle') {
      if (this.elapsed < this.nextBlinkAt) return {}
      this.startBlink(prngChance(this.random, DOUBLE_BLINK_CHANCE))
    }

    this.blinkElapsed += dt
    const amount = this.blinkAmount()
    const left = Math.min(1, amount + this.blinkAsymmetry * 0.35)
    const right = Math.min(1, amount - this.blinkAsymmetry * 0.2)

    if (this.blinkPhase === 'close' && this.blinkElapsed >= BLINK_CLOSE_S) {
      this.blinkPhase = 'hold'
      this.blinkElapsed = 0
    } else if (this.blinkPhase === 'hold' && this.blinkElapsed >= BLINK_HOLD_S) {
      this.blinkPhase = 'open'
      this.blinkElapsed = 0
    } else if (this.blinkPhase === 'open' && this.blinkElapsed >= BLINK_OPEN_S) {
      if (this.blinkPendingDouble) {
        this.blinkPendingDouble = false
        this.startBlink(false)
      } else {
        this.blinkPhase = 'idle'
        this.blinkElapsed = 0
        this.nextBlinkAt =
          this.elapsed + prngRange(this.random, this.blinkRange[0], this.blinkRange[1])
      }
    }

    return {
      eyelidOpenL: -left,
      eyelidOpenR: -right,
    }
  }

  private startBlink(doubleBlink: boolean): void {
    this.blinkPhase = 'close'
    this.blinkElapsed = 0
    this.blinkPendingDouble = doubleBlink
    this.blinkAsymmetry = prngRange(this.random, 0.04, 0.16) * (this.random() < 0.5 ? -1 : 1)
  }

  private blinkAmount(): number {
    if (this.blinkPhase === 'close') {
      return Math.min(1, this.blinkElapsed / BLINK_CLOSE_S)
    }
    if (this.blinkPhase === 'hold') return 1
    if (this.blinkPhase === 'open') {
      return Math.max(0, 1 - this.blinkElapsed / BLINK_OPEN_S)
    }
    return 0
  }

  private stepBreath(): Partial<RigParams> {
    const wave = 0.5 + 0.5 * Math.sin(this.elapsed * Math.PI * 2 * BREATH_HZ)
    const soft = wave * wave
    return {
      breath: soft * 0.72,
      headPitch: soft * 0.35,
      noseFlare: soft * 0.04,
    }
  }

  private stepGaze(dt: number): Partial<RigParams> {
    if (this.elapsed >= this.gazeNextAt) {
      this.gazeNextAt =
        this.elapsed + prngRange(this.random, GAZE_SACCADES_MIN_S, GAZE_SACCADES_MAX_S)
      const amplitude = this.reducedMotion ? 0.03 : 0.09
      this.gazeTargetX = prngRange(this.random, -amplitude, amplitude)
      this.gazeTargetY = prngRange(this.random, -amplitude * 0.7, amplitude * 0.7)
    }

    const follow = 1 - Math.exp(-dt * 14)
    this.gazeX += (this.gazeTargetX - this.gazeX) * follow
    this.gazeY += (this.gazeTargetY - this.gazeY) * follow

    const tremorAmp = this.reducedMotion ? 0.004 : 0.012
    const tremorX = Math.sin(this.elapsed * 17.3) * tremorAmp
    const tremorY = Math.cos(this.elapsed * 21.1) * tremorAmp * 0.8

    return {
      gazeX: this.gazeX + tremorX,
      gazeY: this.gazeY + tremorY,
      pupilDilate: 0.04 + 0.03 * Math.sin(this.elapsed * 0.7),
    }
  }

  private stepDrift(): Partial<RigParams> {
    const t = this.elapsed
    const [p0, p1, p2, p3, p4] = this.driftPhase
    return {
      headYaw:
        Math.sin(t * 0.31 + p0) * 1.1 + Math.sin(t * 0.73 + p1) * 0.45,
      headPitch:
        Math.sin(t * 0.27 + p2) * 0.7 + Math.sin(t * 0.61 + p3) * 0.28,
      headRoll: Math.sin(t * 0.23 + p4) * 0.55 + Math.sin(t * 0.91 + p0) * 0.18,
      headX: Math.sin(t * 0.19 + p1) * 1.6 + Math.sin(t * 0.47 + p2) * 0.7,
      headY: Math.sin(t * 0.21 + p3) * 1.1 + Math.sin(t * 0.53 + p4) * 0.45,
    }
  }

  private stepProsody(dt: number, input: IdleInput): Partial<RigParams> {
    const energy = input.speaking ? Math.min(1, Math.max(0, input.energy ?? 0)) : 0
    const follow = 1 - Math.exp(-dt * 10)
    this.energySmooth += (energy - this.energySmooth) * follow

    const accent = this.headAccentRate
    const targetNod = this.energySmooth > 0.22 ? -this.energySmooth * 1.8 * accent : 0
    this.nod += (targetNod - this.nod) * (1 - Math.exp(-dt * 8))

    const targetBrow = this.energySmooth > 0.28 ? this.energySmooth * 0.35 * accent : 0
    this.browPulse += (targetBrow - this.browPulse) * (1 - Math.exp(-dt * 7))

    if (this.nod === 0 && this.browPulse === 0) return {}

    return {
      headPitch: this.nod,
      browRaiseL: this.browPulse * 1.15,
      browRaiseR: this.browPulse * 0.7,
      browAngleL: -this.browPulse * 0.35,
      browAngleR: -this.browPulse * 0.18,
    }
  }
}

export function prefersReducedMotion(
  matchMedia: ((query: string) => MediaQueryList) | undefined = globalThis.matchMedia?.bind(
    globalThis,
  ),
): boolean {
  if (!matchMedia) return false
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function sumPartials(
  ...shapes: readonly Partial<RigParams>[]
): Partial<RigParams> {
  const total: Partial<RigParams> = {}
  for (const shape of shapes) {
    for (const channel of RIG_CHANNEL_KEYS) {
      const value = shape[channel]
      if (value === undefined) continue
      total[channel] = ((total[channel] as number | undefined) ?? 0) + value
    }
  }
  return total
}


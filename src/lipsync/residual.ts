import type { RigParams } from '../core/params.ts'

const REST_LIP_PRESS = 0.14
const MAX_RESIDUAL = 0.34
const DECAY_PER_SECOND = 1.8

export class ResidualLips {
  private lipPress = REST_LIP_PRESS

  reset(): void {
    this.lipPress = REST_LIP_PRESS
  }

  apply(sample: Partial<RigParams>, dt: number): Partial<RigParams> {
    const jaw = sample.jawOpen ?? 0
    const width = Math.abs(sample.mouthWidth ?? 0)
    const press = sample.lipPress ?? 0
    const activity = jaw + width + press

    if (activity > 0.22) {
      this.lipPress = Math.min(MAX_RESIDUAL, Math.max(this.lipPress, press * 0.45 + 0.16))
    } else {
      const decay = 1 - Math.exp(-Math.max(0, dt) * DECAY_PER_SECOND)
      this.lipPress += (REST_LIP_PRESS - this.lipPress) * decay
    }

    if (jaw >= 0.12) return sample

    const next: Partial<RigParams> = { ...sample }
    next.lipPress = Math.max(press, this.lipPress)
    if (next.mouthWidth === undefined || Math.abs(next.mouthWidth) < 0.04) {
      next.mouthWidth = (next.mouthWidth ?? 0) * 0.4 - 0.03
    }
    return next
  }
}

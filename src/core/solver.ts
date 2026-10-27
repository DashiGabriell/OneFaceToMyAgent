import {
  DEFAULT_RIG_PARAMS,
  RIG_CHANNELS,
  RIG_CHANNEL_KEYS,
  clampChannel,
} from './params.ts'
import type { RigChannel, RigParams } from './params.ts'

const FIXED_DT = 1 / 60
const MAX_SUBSTEPS = 8

function zeroVelocities(): RigParams {
  return RIG_CHANNEL_KEYS.reduce((velocity, channel) => {
    velocity[channel] = 0
    return velocity
  }, {} as RigParams)
}

export class SpringSolver {
  private current: RigParams
  private target: RigParams
  private velocity: RigParams
  private accumulator = 0

  constructor(initial: RigParams = DEFAULT_RIG_PARAMS) {
    this.current = { ...initial }
    this.target = { ...initial }
    this.velocity = zeroVelocities()
  }

  setTarget(target: RigParams): void {
    this.target = { ...target }
  }

  setChannelTarget(channel: RigChannel, value: number): void {
    this.target[channel] = clampChannel(channel, value)
  }

  snap(params: RigParams): void {
    this.current = { ...params }
    this.target = { ...params }
    this.velocity = zeroVelocities()
    this.accumulator = 0
  }

  values(): RigParams {
    return { ...this.current }
  }

  targets(): RigParams {
    return { ...this.target }
  }

  update(dt: number): RigParams {
    if (!Number.isFinite(dt) || dt <= 0) return this.values()
    this.accumulator += Math.min(dt, 0.1)
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.step(FIXED_DT)
      this.accumulator -= FIXED_DT
      steps += 1
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0
    return this.values()
  }

  private step(dt: number): void {
    for (const channel of RIG_CHANNEL_KEYS) {
      const spec = RIG_CHANNELS[channel]
      let velocity = this.velocity[channel]
      const value = this.current[channel]
      const target = this.target[channel]
      const acceleration = spec.stiffness * (target - value) - spec.damping * velocity
      velocity += acceleration * dt
      let next = value + velocity * dt
      if (next < spec.min) {
        next = spec.min
        if (velocity < 0) velocity = 0
      } else if (next > spec.max) {
        next = spec.max
        if (velocity > 0) velocity = 0
      }
      this.current[channel] = next
      this.velocity[channel] = velocity
    }
  }
}

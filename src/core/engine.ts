import type { RigBackend, RigBounds } from './backend.ts'
import {
  DEFAULT_RIG_PARAMS,
  clampChannel,
  mergeParams,
  resolveParams,
} from './params.ts'
import type { RigChannel, RigParams } from './params.ts'
import { SpringSolver } from './solver.ts'

export interface FrameSnapshot {
  readonly params: RigParams
  readonly target: RigParams
  readonly frameMs: number
  readonly fps: number
}

export type FrameListener = (snapshot: FrameSnapshot) => void
export type RigDriver = (now: number, dt: number) => Partial<RigParams> | null

const MAX_FRAME_DT = 0.05
const NOTIFY_INTERVAL_MS = 33

export class RigEngine {
  private readonly solver = new SpringSolver()
  private target: RigParams = { ...DEFAULT_RIG_PARAMS }
  private readonly listeners = new Set<FrameListener>()
  private driver: RigDriver | null = null
  private raf = 0
  private running = false
  private lastTime = 0
  private lastNotify = 0
  private frameMs = 0
  private fps = 60

  constructor(private readonly backend: RigBackend) {
    this.backend.apply(this.solver.values())
    this.start()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  destroy(): void {
    this.stop()
    this.listeners.clear()
  }

  setTarget(partial: Partial<RigParams>): void {
    this.target = resolveParams(partial, this.target)
    this.solver.setTarget(this.target)
  }

  setChannelTarget(channel: RigChannel, value: number): void {
    this.target[channel] = clampChannel(channel, value)
    this.solver.setTarget(this.target)
  }

  addTarget(delta: Partial<RigParams>): void {
    this.target = mergeParams(this.target, delta)
    this.solver.setTarget(this.target)
  }

  setParams(partial: Partial<RigParams>): void {
    this.target = resolveParams(partial, this.target)
    this.solver.snap(this.target)
    this.backend.apply(this.target)
    this.notify(performance.now(), true)
  }

  setChannelParams(channel: RigChannel, value: number): void {
    this.target[channel] = clampChannel(channel, value)
    this.solver.snap(this.target)
    this.backend.apply(this.target)
    this.notify(performance.now(), true)
  }

  reset(): void {
    this.target = { ...DEFAULT_RIG_PARAMS }
    this.solver.snap(this.target)
    this.backend.reset()
    this.notify(performance.now(), true)
  }

  getTarget(): RigParams {
    return { ...this.target }
  }

  getParams(): RigParams {
    return this.solver.values()
  }

  getBounds(): RigBounds {
    return this.backend.getBounds()
  }

  snapshot(): FrameSnapshot {
    return {
      params: this.solver.values(),
      target: { ...this.target },
      frameMs: this.frameMs,
      fps: this.fps,
    }
  }

  subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  setDriver(driver: RigDriver | null): void {
    this.driver = driver
  }

  private tick = (now: number): void => {
    if (!this.running) return
    const rawDt = Math.max((now - this.lastTime) / 1000, 0)
    this.lastTime = now
    const dt = Math.min(rawDt, MAX_FRAME_DT)
    const started = performance.now()
    const driven = this.driver?.(now, dt)
    if (driven) {
      this.target = resolveParams(driven, this.target)
      this.solver.setTarget(this.target)
    }
    const params = this.solver.update(dt)
    this.backend.apply(params)
    const elapsed = performance.now() - started
    this.frameMs = this.frameMs * 0.88 + elapsed * 0.12
    if (rawDt > 0) {
      const instant = Math.min(1000 / rawDt, 240)
      this.fps = this.fps * 0.92 + instant * 0.08
    }
    if (now - this.lastNotify >= NOTIFY_INTERVAL_MS) {
      this.notify(now, false)
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private notify(now: number, force: boolean): void {
    if (!force && now - this.lastNotify < NOTIFY_INTERVAL_MS) return
    this.lastNotify = now
    if (this.listeners.size === 0) return
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

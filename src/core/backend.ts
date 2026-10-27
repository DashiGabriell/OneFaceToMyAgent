import type { RigParams } from './params.ts'

export interface RigBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface RigBackend {
  apply(params: RigParams): void
  reset(): void
  getBounds(): RigBounds
}

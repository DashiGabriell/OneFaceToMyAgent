import type { RigBackend, RigBounds } from '../core/backend.ts'
import { DEFAULT_RIG_PARAMS } from '../core/params.ts'
import type { RigParams } from '../core/params.ts'
import { computePartStyles } from './mapping.ts'
import { FACE_VIEWBOX } from './palette.ts'
import { FACE_PARTS } from './parts.ts'
import type { FacePart } from './parts.ts'

export class SvgRigBackend implements RigBackend {
  private readonly parts = new Map<FacePart, SVGGraphicsElement>()
  private readonly transformCache = new Map<FacePart, string>()
  private readonly opacityCache = new Map<FacePart, string>()

  constructor(private readonly root: SVGSVGElement) {
    for (const part of FACE_PARTS) {
      const element = root.querySelector<SVGGraphicsElement>(`[data-part="${part}"]`)
      if (!element) throw new Error(`missing rig part: ${part}`)
      this.parts.set(part, element)
    }
    this.apply(DEFAULT_RIG_PARAMS)
  }

  apply(params: RigParams): void {
    const styles = computePartStyles(params)
    for (const part of FACE_PARTS) {
      const element = this.parts.get(part)
      if (!element) continue
      const style = styles[part]
      const transform = style?.transform ?? ''
      const opacity = style?.opacity === undefined ? '' : String(style.opacity)
      if (this.transformCache.get(part) !== transform) {
        element.style.transform = transform
        this.transformCache.set(part, transform)
      }
      if (this.opacityCache.get(part) !== opacity) {
        element.style.opacity = opacity
        this.opacityCache.set(part, opacity)
      }
    }
  }

  reset(): void {
    this.apply(DEFAULT_RIG_PARAMS)
  }

  getBounds(): RigBounds {
    try {
      const box = this.root.getBBox()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    } catch {
      return { x: 0, y: 0, width: FACE_VIEWBOX.width, height: FACE_VIEWBOX.height }
    }
  }
}

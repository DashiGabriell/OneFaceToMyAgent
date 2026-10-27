import { RigEngine } from '../core/engine.ts'
import type { RigParams } from '../core/params.ts'
import { SvgRigBackend } from '../face/backend.ts'
import { buildFaceSvg } from '../face/face.ts'
import { createDebugPanel } from './debug.ts'
import type { DebugPanel } from './debug.ts'

export interface AvatarOptions {
  readonly container: HTMLElement
  readonly id?: string
  readonly debug?: boolean
}

export interface FaceAvatar {
  readonly element: SVGSVGElement
  readonly engine: RigEngine
  setTarget(partial: Partial<RigParams>): void
  setParams(partial: Partial<RigParams>): void
  reset(): void
  destroy(): void
}

export function mountAvatar(options: AvatarOptions): FaceAvatar {
  const id = options.id ?? 'face'
  options.container.innerHTML = buildFaceSvg({ id })
  const element = options.container.querySelector<SVGSVGElement>('svg')
  if (!element) throw new Error('failed to mount face svg')

  const backend = new SvgRigBackend(element)
  const engine = new RigEngine(backend)
  let panel: DebugPanel | undefined
  if (options.debug) panel = createDebugPanel(engine)

  return {
    element,
    engine,
    setTarget: (partial) => engine.setTarget(partial),
    setParams: (partial) => engine.setParams(partial),
    reset: () => engine.reset(),
    destroy() {
      panel?.destroy()
      engine.destroy()
      options.container.innerHTML = ''
    },
  }
}

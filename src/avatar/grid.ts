import { DEFAULT_RIG_PARAMS, RIG_CHANNELS, RIG_CHANNEL_KEYS, resolveParams } from '../core/params.ts'
import type { RigParams } from '../core/params.ts'
import { buildFaceSvg } from '../face/face.ts'
import { computePartStyles } from '../face/mapping.ts'
import { VISEME_NAMES, VISEMES } from '../lipsync/visemes.ts'

function createCell(id: string, params: RigParams, captionText: string): HTMLElement {
  const cell = document.createElement('figure')
  cell.className = 'rig-cell'

  const host = document.createElement('div')
  host.className = 'rig-cell__face'
  host.innerHTML = buildFaceSvg({ id })

  const svg = host.querySelector<SVGSVGElement>('svg')
  if (svg) {
    const styles = computePartStyles(params)
    for (const [part, style] of Object.entries(styles)) {
      if (!style) continue
      const element = svg.querySelector<SVGGraphicsElement>(`[data-part="${part}"]`)
      if (!element) continue
      element.style.transform = style.transform
      if (style.opacity !== undefined) element.style.opacity = String(style.opacity)
    }
  }

  const caption = document.createElement('figcaption')
  caption.textContent = captionText

  cell.append(host, caption)
  return cell
}

export function renderRigGrid(container: HTMLElement = document.body): HTMLElement {
  container.querySelector('#rig-grid')?.remove()

  const grid = document.createElement('div')
  grid.id = 'rig-grid'
  grid.dataset.rigGrid = ''

  let index = 0
  for (const channel of RIG_CHANNEL_KEYS) {
    const spec = RIG_CHANNELS[channel]
    const states = [
      { name: 'mín', value: spec.min },
      { name: 'máx', value: spec.max },
    ] as const

    for (const state of states) {
      const params: RigParams = { ...DEFAULT_RIG_PARAMS }
      params[channel] = state.value
      const cell = createCell(`rig-grid-${index}`, params, `${channel} · ${state.name}`)
      cell.dataset.gridChannel = channel
      cell.dataset.gridValue = String(state.value)
      grid.append(cell)
      index += 1
    }
  }

  container.append(grid)
  return grid
}

export function renderVisemeGrid(container: HTMLElement = document.body): HTMLElement {
  container.querySelector('#viseme-grid')?.remove()

  const grid = document.createElement('div')
  grid.id = 'viseme-grid'
  grid.dataset.visemeGrid = ''

  VISEME_NAMES.forEach((name, index) => {
    const params = resolveParams(VISEMES[name])
    const cell = createCell(`viseme-grid-${index}`, params, name)
    cell.dataset.viseme = name
    grid.append(cell)
  })

  container.append(grid)
  return grid
}

import {
  RIG_CHANNELS,
  RIG_CHANNEL_KEYS,
  RIG_GROUPS,
  channelsInGroup,
} from '../core/params.ts'
import type { RigChannel, RigParams } from '../core/params.ts'
import type { RigEngine } from '../core/engine.ts'
import { LipSyncPlayer } from '../lipsync/player.ts'

interface DebugRow {
  readonly input: HTMLInputElement
  readonly current: HTMLElement
  readonly target: HTMLElement
}

export interface DebugPanel {
  readonly element: HTMLElement
  destroy(): void
}

function maxParams(): RigParams {
  return RIG_CHANNEL_KEYS.reduce((params, channel) => {
    params[channel] = RIG_CHANNELS[channel].max
    return params
  }, {} as RigParams)
}

export function createDebugPanel(engine: RigEngine): DebugPanel {
  const panel = document.createElement('aside')
  panel.id = 'debug-panel'
  panel.dataset.debugPanel = ''
  panel.setAttribute('aria-label', 'Painel de debug do rig')

  const header = document.createElement('header')
  header.className = 'debug-header'
  header.innerHTML = `
    <div>
      <p class="debug-eyebrow">?debug=1</p>
      <h2>Canais do rig</h2>
    </div>
    <p class="debug-stats" data-debug-stats>0 fps</p>
  `
  panel.append(header)

  const actions = document.createElement('div')
  actions.className = 'debug-actions'
  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.textContent = 'Neutro'
  resetButton.dataset.debugReset = ''
  const extremesButton = document.createElement('button')
  extremesButton.type = 'button'
  extremesButton.textContent = 'Extremos'
  extremesButton.dataset.debugExtremes = ''
  actions.append(resetButton, extremesButton)
  panel.append(actions)

  const player = new LipSyncPlayer(engine)
  const lipsync = document.createElement('section')
  lipsync.className = 'debug-lipsync'
  const lipsyncHeading = document.createElement('h3')
  lipsyncHeading.textContent = 'Lip-sync'
  const lipsyncActions = document.createElement('div')
  lipsyncActions.className = 'debug-actions'
  const loopButton = document.createElement('button')
  loopButton.type = 'button'
  loopButton.textContent = 'Loop de visemes'
  loopButton.dataset.lipsyncLoop = ''
  const phraseButton = document.createElement('button')
  phraseButton.type = 'button'
  phraseButton.textContent = 'Frase mock'
  phraseButton.dataset.lipsyncPhrase = ''
  const stopButton = document.createElement('button')
  stopButton.type = 'button'
  stopButton.textContent = 'Parar'
  stopButton.dataset.lipsyncStop = ''
  lipsyncActions.append(loopButton, phraseButton, stopButton)
  const lipsyncStatus = document.createElement('p')
  lipsyncStatus.className = 'debug-lipsync__status'
  lipsyncStatus.dataset.lipsyncStatus = ''
  lipsyncStatus.textContent = 'parado'
  lipsync.append(lipsyncHeading, lipsyncActions, lipsyncStatus)
  panel.append(lipsync)

  const updateLipsyncStatus = (): void => {
    lipsyncStatus.textContent = player.isPlaying() ? 'tocando' : 'parado'
  }

  loopButton.addEventListener('click', () => {
    player.playVisemeLoop()
    updateLipsyncStatus()
  })
  phraseButton.addEventListener('click', () => {
    player.playMock('Olá, eu sou um rosto que fala português.')
    updateLipsyncStatus()
  })
  stopButton.addEventListener('click', () => {
    player.stop()
    updateLipsyncStatus()
  })

  const rows = new Map<RigChannel, DebugRow>()

  for (const group of RIG_GROUPS) {
    const section = document.createElement('section')
    section.className = 'debug-group'
    const heading = document.createElement('h3')
    heading.textContent = group
    section.append(heading)

    for (const channel of channelsInGroup(group)) {
      const spec = RIG_CHANNELS[channel]
      const row = document.createElement('label')
      row.className = 'debug-row'
      row.dataset.channel = channel

      const name = document.createElement('span')
      name.className = 'debug-row__name'
      name.textContent = spec.label

      const input = document.createElement('input')
      input.type = 'range'
      input.min = String(spec.min)
      input.max = String(spec.max)
      input.step = '0.01'
      input.value = String(spec.default)

      const value = document.createElement('span')
      value.className = 'debug-row__value'
      const current = document.createElement('span')
      current.dataset.current = ''
      const arrow = document.createElement('span')
      arrow.className = 'debug-row__arrow'
      arrow.textContent = '→'
      const target = document.createElement('span')
      target.dataset.target = ''
      value.append(current, arrow, target)

      input.addEventListener('input', () => {
        engine.setChannelTarget(channel, Number(input.value))
      })

      row.append(name, input, value)
      section.append(row)
      rows.set(channel, { input, current, target })
    }

    panel.append(section)
  }

  const stats = header.querySelector<HTMLElement>('[data-debug-stats]')
  if (!stats) throw new Error('missing debug stats')

  const syncSliders = (): void => {
    const target = engine.getTarget()
    for (const [channel, row] of rows) {
      row.input.value = String(target[channel])
    }
  }

  resetButton.addEventListener('click', () => {
    engine.reset()
    syncSliders()
  })

  extremesButton.addEventListener('click', () => {
    engine.setParams(maxParams())
    syncSliders()
  })

  const unsubscribe = engine.subscribe((snapshot) => {
    stats.textContent = `${snapshot.fps.toFixed(0)} fps · ${snapshot.frameMs.toFixed(2)} ms`
    stats.dataset.fps = snapshot.fps.toFixed(1)
    stats.dataset.frameMs = snapshot.frameMs.toFixed(2)
    updateLipsyncStatus()
    for (const [channel, row] of rows) {
      row.current.textContent = snapshot.params[channel].toFixed(2)
      row.target.textContent = snapshot.target[channel].toFixed(2)
    }
  })

  document.body.classList.add('debug-open')
  document.body.append(panel)
  syncSliders()

  return {
    element: panel,
    destroy() {
      player.stop()
      unsubscribe()
      panel.remove()
      document.body.classList.remove('debug-open')
    },
  }
}

import { EMOTION_LABELS, EMOTION_NAMES } from '../core/emotion.ts'
import type { EmotionName } from '../core/emotion.ts'
import type { RigEngine } from '../core/engine.ts'
import {
  RIG_CHANNELS,
  RIG_CHANNEL_KEYS,
  RIG_GROUPS,
  channelsInGroup,
} from '../core/params.ts'
import type { RigChannel, RigParams } from '../core/params.ts'
import { LipSyncPlayer } from '../lipsync/player.ts'
import type { EmotionController } from './emotion.ts'

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

export function createDebugPanel(
  engine: RigEngine,
  emotions: EmotionController,
): DebugPanel {
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

  const emotionSection = document.createElement('section')
  emotionSection.className = 'debug-emotion'
  const emotionHeading = document.createElement('h3')
  emotionHeading.textContent = 'Emoções'
  const presetRow = document.createElement('div')
  presetRow.className = 'debug-emotions'
  const presetButtons: HTMLButtonElement[] = []
  let activeMood: EmotionName | null = null

  for (const emotion of EMOTION_NAMES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = EMOTION_LABELS[emotion]
    button.dataset.emotion = emotion
    presetButtons.push(button)
    presetRow.append(button)
  }

  const weightRow = document.createElement('label')
  weightRow.className = 'debug-row'
  const weightName = document.createElement('span')
  weightName.className = 'debug-row__name'
  weightName.textContent = 'Peso da emoção'
  const weightInput = document.createElement('input')
  weightInput.type = 'range'
  weightInput.min = '0'
  weightInput.max = '1'
  weightInput.step = '0.05'
  weightInput.value = '1'
  weightInput.dataset.emotionWeight = ''
  const weightValue = document.createElement('span')
  weightValue.className = 'debug-row__value'
  weightValue.dataset.emotionWeightValue = ''
  weightValue.textContent = '1.00'
  weightRow.append(weightName, weightInput, weightValue)

  const layerActions = document.createElement('div')
  layerActions.className = 'debug-actions'
  const reactButton = document.createElement('button')
  reactButton.type = 'button'
  reactButton.textContent = 'Reação'
  reactButton.dataset.emotionReact = ''
  const clearButton = document.createElement('button')
  clearButton.type = 'button'
  clearButton.textContent = 'Limpar'
  clearButton.dataset.emotionClear = ''
  layerActions.append(reactButton, clearButton)

  const emotionStatus = document.createElement('p')
  emotionStatus.className = 'debug-emotion__status'
  emotionStatus.dataset.emotionStatus = ''
  emotionStatus.textContent = 'mood: neutro'

  const syncPresets = (): void => {
    for (const button of presetButtons) {
      const isNeutral = activeMood === null
      const active = isNeutral
        ? button.dataset.emotion === 'neutral'
        : button.dataset.emotion === activeMood
      button.setAttribute('aria-pressed', String(active))
    }
    reactButton.disabled = activeMood === null
  }

  const applyMood = (emotion: EmotionName): void => {
    if (emotion === 'neutral') {
      emotions.clearEmotion()
      activeMood = null
    } else {
      emotions.setEmotion(emotion, { weight: Number(weightInput.value) })
      activeMood = emotion
    }
    syncPresets()
  }

  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      const emotion = button.dataset.emotion as EmotionName | undefined
      if (emotion) applyMood(emotion)
    })
  }

  weightInput.addEventListener('input', () => {
    const weight = Number(weightInput.value)
    weightValue.textContent = weight.toFixed(2)
    if (activeMood) emotions.setEmotion(activeMood, { weight, flash: false })
  })

  reactButton.addEventListener('click', () => {
    if (!activeMood) return
    emotions.react(activeMood, { weight: Number(weightInput.value) })
  })

  clearButton.addEventListener('click', () => {
    emotions.clearEmotion()
    activeMood = null
    syncPresets()
  })

  emotionSection.append(
    emotionHeading,
    presetRow,
    weightRow,
    layerActions,
    emotionStatus,
  )
  panel.append(emotionSection)
  syncPresets()

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

  const taggedRow = document.createElement('div')
  taggedRow.className = 'debug-phrase-row'
  const taggedInput = document.createElement('input')
  taggedInput.type = 'text'
  taggedInput.className = 'debug-phrase'
  taggedInput.value = 'Olá! [EMO:happy] Eu falo português com naturalidade.'
  taggedInput.dataset.lipsyncTaggedInput = ''
  const taggedButton = document.createElement('button')
  taggedButton.type = 'button'
  taggedButton.textContent = 'Frase com [EMO]'
  taggedButton.dataset.lipsyncTagged = ''
  taggedRow.append(taggedInput, taggedButton)

  const lipsyncStatus = document.createElement('p')
  lipsyncStatus.className = 'debug-lipsync__status'
  lipsyncStatus.dataset.lipsyncStatus = ''
  lipsyncStatus.textContent = 'parado'
  lipsync.append(lipsyncHeading, lipsyncActions, taggedRow, lipsyncStatus)
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
  taggedButton.addEventListener('click', () => {
    player.playMock(taggedInput.value, {
      emotionTags: true,
      onEmotion: (emotion) => applyMood(emotion),
    })
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
    const target = engine.getBaseTarget()
    for (const [channel, row] of rows) {
      row.input.value = String(target[channel])
    }
  }

  const clearEmotions = (): void => {
    emotions.reset()
    activeMood = null
    syncPresets()
  }

  resetButton.addEventListener('click', () => {
    clearEmotions()
    engine.reset()
    syncSliders()
  })

  extremesButton.addEventListener('click', () => {
    clearEmotions()
    engine.setParams(maxParams())
    syncSliders()
  })

  const unsubscribe = engine.subscribe((snapshot) => {
    stats.textContent = `${snapshot.fps.toFixed(0)} fps · ${snapshot.frameMs.toFixed(2)} ms`
    stats.dataset.fps = snapshot.fps.toFixed(1)
    stats.dataset.frameMs = snapshot.frameMs.toFixed(2)
    updateLipsyncStatus()

    const state = emotions.mixer.getState()
    const summary: string[] = []
    summary.push(
      state.mood.length === 0
        ? 'mood: neutro'
        : `mood: ${state.mood
            .map((entry) => `${entry.emotion} ${entry.weight.toFixed(2)}`)
            .join(' + ')}`,
    )
    if (state.flash) {
      summary.push(`flash ${state.flash.emotion} ${Math.round(state.flash.remainingMs)}ms`)
    }
    for (const reaction of state.reactions) {
      summary.push(
        `reação ${reaction.emotion} ${reaction.weight.toFixed(2)} · ${(
          reaction.remainingMs / 1000
        ).toFixed(1)}s`,
      )
    }
    emotionStatus.textContent = summary.join(' · ')
    emotionStatus.dataset.layer =
      state.reactions.length > 0 ? 'reaction' : state.mood.length > 0 ? 'mood' : 'none'
    emotionStatus.dataset.ttl = String(
      Math.round(state.reactions.reduce((max, item) => Math.max(max, item.remainingMs), 0)),
    )
    emotionStatus.dataset.transition = state.transition.toFixed(2)
    emotionStatus.dataset.flash = state.flash ? '1' : '0'

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

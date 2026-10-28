import { mountAvatar, renderEmotionGrid, renderRigGrid, renderVisemeGrid } from '@/avatar/index.ts'
import type { FaceAvatar } from '@/avatar/index.ts'
import { EMOTION_LABELS, EMOTION_NAMES } from '@/core/emotion.ts'
import type { EmotionName } from '@/core/emotion.ts'
import { DEFAULT_PERSONA, validatePersona } from '@/core/persona.ts'
import type { Persona } from '@/core/persona.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('missing #app container')
}

let persona: Persona = DEFAULT_PERSONA
try {
  const response = await fetch('/api/persona')
  if (response.ok) persona = validatePersona(await response.json())
} catch {
  persona = DEFAULT_PERSONA
}

const emotionOptions = EMOTION_NAMES.map(
  (name) => `<option value="${name}">${EMOTION_LABELS[name]}</option>`,
).join('')

app.innerHTML = `
  <header>
    <p class="eyebrow">Fase 6</p>
    <h1>Rosto SVG</h1>
    <p class="subtitle">Fala, emoções e micro-movimentos naturais em pt-BR</p>
  </header>
  <button id="audio-gate" class="audio-gate" data-audio-gate type="button">clique para ouvir</button>
  <div id="face-stage"></div>
  <section class="speech" aria-label="Fala">
    <label class="speech-field">
      <span>Frase</span>
      <textarea data-speech-text rows="3">Olá! Eu sou um rosto que fala português com naturalidade.</textarea>
    </label>
    <div class="speech-row">
      <label class="speech-field speech-field--inline">
        <span>Emoção</span>
        <select data-speech-emotion>${emotionOptions}</select>
      </label>
      <button type="button" data-speak>Ouvir</button>
      <button type="button" data-speech-stop>Parar</button>
    </div>
    <p class="speech-status" data-speech-status data-state="idle">clique para ouvir</p>
  </section>
  <p class="hint">?debug=1 rig · ?emotions=1 emoções · ?grid=1 extremos · ?visemes=1 visemas · ?nocache=1 ignora o cache</p>
`

const stage = app.querySelector<HTMLDivElement>('#face-stage')
if (!stage) throw new Error('missing #face-stage container')

const search = new URLSearchParams(window.location.search)
const avatar = mountAvatar({
  container: stage,
  id: 'face',
  debug: search.get('debug') === '1',
  persona,
})

const gate = app.querySelector<HTMLButtonElement>('[data-audio-gate]')
const textInput = app.querySelector<HTMLTextAreaElement>('[data-speech-text]')
const emotionSelect = app.querySelector<HTMLSelectElement>('[data-speech-emotion]')
const speakButton = app.querySelector<HTMLButtonElement>('[data-speak]')
const stopButton = app.querySelector<HTMLButtonElement>('[data-speech-stop]')
const status = app.querySelector<HTMLElement>('[data-speech-status]')

if (emotionSelect) emotionSelect.value = persona.defaultMood

let speaking = false

const setStatus = (text: string, state: 'idle' | 'speaking' | 'error'): void => {
  if (!status) return
  status.textContent = text
  status.dataset.state = state
}

const unlockAudio = async (): Promise<void> => {
  try {
    await avatar.unlock()
    gate?.remove()
    if (!speaking) setStatus('pronto', 'idle')
  } catch {
    setStatus('áudio indisponível neste navegador', 'error')
  }
}

gate?.addEventListener('click', () => {
  void unlockAudio()
})

avatar.on('speechstart', (payload) => {
  speaking = true
  setStatus(payload.cached ? 'falando · cache' : 'falando', 'speaking')
})

avatar.on('speechend', () => {
  speaking = false
  setStatus('pronto', 'idle')
})

avatar.on('error', () => {
  speaking = false
  setStatus('voz indisponível', 'error')
})

avatar.on('syncwarn', (payload) => {
  document.documentElement.dataset.syncwarn = String(payload.lagMs)
})

avatar.on('viseme', (payload) => {
  document.documentElement.dataset.viseme = payload.viseme
})

speakButton?.addEventListener('click', () => {
  void (async () => {
    await unlockAudio()
    const text = textInput?.value.trim() ?? ''
    if (!text) {
      setStatus('digite uma frase', 'error')
      return
    }
    const emotion = (emotionSelect?.value ?? persona.defaultMood) as EmotionName
    delete document.documentElement.dataset.syncwarn
    setStatus('gerando…', 'speaking')
    await avatar.say({
      text,
      emotion,
      ...(search.get('nocache') === '1' ? { nocache: true } : {}),
    })
  })().catch(() => {
    speaking = false
    setStatus('voz indisponível', 'error')
  })
})

stopButton?.addEventListener('click', () => {
  avatar.interrupt()
  speaking = false
  setStatus('parado', 'idle')
})

if (search.get('grid') === '1') {
  renderRigGrid(document.body)
}

if (search.get('visemes') === '1') {
  renderVisemeGrid(document.body)
}

if (search.get('emotions') === '1') {
  renderEmotionGrid(document.body)
}

;(window as Window & { __avatar?: FaceAvatar }).__avatar = avatar

document.documentElement.dataset.ready = 'true'
document.documentElement.dataset.phase = '6'

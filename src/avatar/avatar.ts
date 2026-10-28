import { EmotionMixer } from '../core/emotion-mixer.ts'
import type { MoodOptions, ReactionOptions } from '../core/emotion-mixer.ts'
import type { EmotionMixEntry, EmotionName } from '../core/emotion.ts'
import { IdleSimulator, prefersReducedMotion, sumPartials } from '../core/idle.ts'
import { RigEngine } from '../core/engine.ts'
import type { RigParams } from '../core/params.ts'
import { DEFAULT_PERSONA } from '../core/persona.ts'
import type { Persona } from '../core/persona.ts'
import { SvgRigBackend } from '../face/backend.ts'
import { buildFaceSvg } from '../face/face.ts'
import { createDebugPanel } from './debug.ts'
import type { DebugPanel } from './debug.ts'
import { createEmotionController } from './emotion.ts'
import type { EmotionController, SetEmotionOptions } from './emotion.ts'
import { SpeechController } from './speech.ts'
import type { SpeechEventMap, SpeechEventName, SpeechOptions } from './speech.ts'

export interface AvatarOptions {
  readonly container: HTMLElement
  readonly id?: string
  readonly debug?: boolean
  readonly persona?: Persona
  readonly endpoint?: string
  readonly fetchImpl?: typeof fetch
}

export interface FaceAvatar {
  readonly element: SVGSVGElement
  readonly engine: RigEngine
  readonly emotions: EmotionController
  readonly persona: Persona
  readonly idle: IdleSimulator
  setTarget(partial: Partial<RigParams>): void
  setParams(partial: Partial<RigParams>): void
  setEmotion(emotion: EmotionName, options?: SetEmotionOptions): void
  setEmotionMix(entries: readonly EmotionMixEntry[], options?: MoodOptions): void
  clearEmotion(): void
  react(emotion: EmotionName, options?: ReactionOptions): void
  say(options: SpeechOptions): Promise<void>
  interrupt(): void
  unlock(): Promise<void>
  on<K extends SpeechEventName>(
    event: K,
    handler: (payload: SpeechEventMap[K]) => void,
  ): () => void
  reset(): void
  destroy(): void
}

function createLiveRegion(container: HTMLElement): HTMLElement {
  const live = document.createElement('div')
  live.dataset.avatarLive = '1'
  live.setAttribute('aria-live', 'polite')
  live.setAttribute('aria-atomic', 'true')
  live.setAttribute('role', 'status')
  live.style.cssText =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  container.appendChild(live)
  return live
}

export function mountAvatar(options: AvatarOptions): FaceAvatar {
  const id = options.id ?? 'face'
  options.container.innerHTML = buildFaceSvg({ id })
  const element = options.container.querySelector<SVGSVGElement>('svg')
  if (!element) throw new Error('failed to mount face svg')

  const live = createLiveRegion(options.container)
  const backend = new SvgRigBackend(element)
  const engine = new RigEngine(backend)
  const mixer = new EmotionMixer()
  const emotions = createEmotionController(mixer)
  const persona = options.persona ?? DEFAULT_PERSONA
  const idle = new IdleSimulator({
    blinkRange: persona.blinkRange,
    headAccentRate: persona.headAccentRate,
    reducedMotion: prefersReducedMotion(),
    seed: 0x7a5e_face,
  })

  const speech = new SpeechController({
    engine,
    emotions,
    idle,
    persona,
    onSpokenText: (text) => {
      live.textContent = text ?? ''
    },
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  })

  engine.setModifier((_now, dt) =>
    sumPartials(
      mixer.update(dt),
      idle.update(dt, {
        speaking: speech.isSpeaking(),
        energy: speech.getEnergy(),
      }),
    ),
  )

  const media =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  const onMotionChange = (): void => {
    idle.setReducedMotion(Boolean(media?.matches))
  }
  media?.addEventListener?.('change', onMotionChange)

  let panel: DebugPanel | undefined
  if (options.debug) panel = createDebugPanel(engine, emotions)

  return {
    element,
    engine,
    emotions,
    persona,
    idle,
    setTarget: (partial) => engine.setTarget(partial),
    setParams: (partial) => engine.setParams(partial),
    setEmotion: (emotion, emotionOptions) => emotions.setEmotion(emotion, emotionOptions),
    setEmotionMix: (entries, emotionOptions) => emotions.setEmotionMix(entries, emotionOptions),
    clearEmotion: () => emotions.clearEmotion(),
    react: (emotion, reactionOptions) => emotions.react(emotion, reactionOptions),
    say: (speechOptions) => speech.say(speechOptions),
    interrupt: () => speech.interrupt(),
    unlock: () => speech.unlock(),
    on: (event, handler) => speech.on(event, handler),
    reset() {
      emotions.reset()
      engine.reset()
    },
    destroy() {
      media?.removeEventListener?.('change', onMotionChange)
      speech.destroy()
      panel?.destroy()
      engine.destroy()
      options.container.innerHTML = ''
    },
  }
}

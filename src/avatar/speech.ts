import { AudioQueue, buildSpeechTimeline, parseNdjson, parseTtsEvent } from '../audio/index.ts'
import { alignmentToChunk } from '../audio/timeline.ts'
import type { SpeechSegment, SpeechTimeline } from '../audio/timeline.ts'
import type { RigEngine } from '../core/engine.ts'
import type { EmotionName } from '../core/emotion.ts'
import type { RigParams } from '../core/params.ts'
import type { Persona } from '../core/persona.ts'
import { REST_VISEME_PARAMS, ResidualLips } from '../lipsync/index.ts'
import type { VisemeName } from '../lipsync/index.ts'
import type { EmotionController } from './emotion.ts'
import type { IdleSimulator } from '../core/idle.ts'

export interface SpeechOptions {
  readonly text: string
  readonly emotion?: EmotionName
  readonly queue?: boolean
  readonly nocache?: boolean
}

export interface SpeechStartPayload {
  readonly text: string
  readonly cached: boolean
}

export interface SpeechVisemePayload {
  readonly viseme: VisemeName
  readonly at: number
}

export interface SpeechEndPayload {
  readonly text: string
  readonly interrupted: boolean
}

export interface SpeechErrorPayload {
  readonly message: string
  readonly code?: string
}

export interface SpeechSyncWarnPayload {
  readonly lagMs: number
}

export interface SpeechEventMap {
  readonly speechstart: SpeechStartPayload
  readonly viseme: SpeechVisemePayload
  readonly speechend: SpeechEndPayload
  readonly error: SpeechErrorPayload
  readonly syncwarn: SpeechSyncWarnPayload
}

export type SpeechEventName = keyof SpeechEventMap

export interface SpeechControllerOptions {
  readonly engine: RigEngine
  readonly emotions: EmotionController
  readonly persona: Persona
  readonly idle?: IdleSimulator
  readonly endpoint?: string
  readonly fetchImpl?: typeof fetch
  readonly createContext?: () => AudioContext
  readonly onSpokenText?: (text: string | null) => void
}

interface AlignmentRecord {
  readonly offsetSec: number
  readonly segments: readonly SpeechSegment[]
}

const DEFAULT_ENDPOINT = '/api/tts'
const SYNC_WARN_MS = 300
const SYNC_WARN_INTERVAL_MS = 1000
const END_PADDING_SECONDS = 0.12

export class SpeechController {
  private readonly engine: RigEngine
  private readonly emotions: EmotionController
  private readonly idle: IdleSimulator | null
  private readonly endpoint: string
  private readonly fetchImpl: typeof fetch
  private readonly createContext: () => AudioContext
  private readonly onSpokenText: ((text: string | null) => void) | null
  private readonly listeners = new Map<SpeechEventName, Set<(payload: unknown) => void>>()
  private readonly alignments = new Map<number, AlignmentRecord>()
  private readonly residual = new ResidualLips()
  private lastDriverAt = 0
  readonly persona: Persona
  private context: AudioContext | null = null
  private queue: AudioQueue | null = null
  private abort: AbortController | null = null
  private timeline: SpeechTimeline | null = null
  private pendingAudio: string[] = []
  private pendingSpeech: SpeechOptions[] = []
  private current: SpeechOptions | null = null
  private speaking = false
  private streamDone = false
  private cached = false
  private lastViseme: VisemeName | null = null
  private lastAlignmentEnd = 0
  private lastWarnAt = 0

  constructor(options: SpeechControllerOptions) {
    this.engine = options.engine
    this.emotions = options.emotions
    this.idle = options.idle ?? null
    this.persona = options.persona
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
    this.createContext =
      options.createContext ?? (() => new AudioContext({ latencyHint: 'interactive' }))
    this.onSpokenText = options.onSpokenText ?? null
  }

  getEnergy(): number {
    return this.queue?.energy ?? 0
  }

  on<K extends SpeechEventName>(
    event: K,
    handler: (payload: SpeechEventMap[K]) => void,
  ): () => void {
    const set = this.listeners.get(event) ?? new Set<(payload: unknown) => void>()
    this.listeners.set(event, set)
    const wrapped = handler as (payload: unknown) => void
    set.add(wrapped)
    return () => {
      set.delete(wrapped)
      if (set.size === 0) this.listeners.delete(event)
    }
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  isUnlocked(): boolean {
    return this.context !== null && this.context.state === 'running'
  }

  async unlock(): Promise<void> {
    if (!this.context) this.context = this.createContext()
    if (this.context.state === 'suspended') await this.context.resume()
  }

  async say(options: SpeechOptions): Promise<void> {
    const text = options.text.trim()
    if (!text) throw new Error('text is empty')
    await this.unlock()

    if (this.speaking) {
      if (options.queue) {
        this.pendingSpeech.push({ ...options, text })
        return
      }
      this.interrupt()
    }

    this.idle?.anticipateBlink()
    void this.run({ ...options, text })
  }

  interrupt(): void {
    const text = this.current?.text ?? ''
    if (!this.speaking && !this.queue) return
    this.speaking = false
    this.abort?.abort()
    this.abort = null
    this.pendingSpeech = []
    const queue = this.queue
    this.queue = null
    queue?.interrupt(150)
    if (queue) setTimeout(() => queue.dispose(), 220)
    this.engine.setDriver(null)
    this.engine.setTarget(REST_VISEME_PARAMS)
    this.residual.reset()
    this.current = null
    this.onSpokenText?.(null)
    if (text) this.emit('speechend', { text, interrupted: true })
  }

  destroy(): void {
    this.interrupt()
    this.abort?.abort()
    this.pendingSpeech = []
    void this.context?.close().catch(() => undefined)
    this.context = null
    this.listeners.clear()
    this.engine.setDriver(null)
  }

  private async run(options: SpeechOptions): Promise<void> {
    this.current = options
    this.speaking = true
    this.streamDone = false
    this.cached = false
    this.timeline = null
    this.alignments.clear()
    this.pendingAudio = []
    this.lastViseme = null
    this.lastAlignmentEnd = 0
    this.lastWarnAt = 0

    const emotion = options.emotion ?? this.persona.defaultMood
    if (emotion !== 'neutral') {
      this.emotions.setEmotion(emotion, {
        weight: Math.min(1, this.persona.intensity),
      })
    }

    const controller = new AbortController()
    this.abort = controller
    const body: Record<string, unknown> = { text: options.text, emotion }
    if (options.nocache) body.nocache = true

    let response: Response
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      this.fail('voz indisponível', error instanceof Error ? error.message : undefined)
      return
    }

    if (!response.ok || !response.body) {
      this.fail('voz indisponível', `http ${response.status}`)
      return
    }

    try {
      for await (const raw of parseNdjson(response.body)) {
        if (controller.signal.aborted) return
        const event = parseTtsEvent(raw)
        if (!event) continue

        switch (event.type) {
          case 'meta':
            this.cached = event.cached
            this.createQueue(event.format)
            break
          case 'audio':
            if (this.queue) {
              this.queue.appendBase64(event.audioBase64)
              await this.queue.drain()
            } else {
              this.pendingAudio.push(event.audioBase64)
            }
            break
          case 'alignment':
            this.alignments.set(event.chunkSeq, {
              offsetSec: event.offsetSec,
              segments: event.segments,
            })
            this.rebuildTimeline()
            break
          case 'done':
            this.streamDone = true
            await this.queue?.finish()
            break
          case 'error':
            this.fail('voz indisponível', event.code)
            return
        }
      }
      if (!this.streamDone && !controller.signal.aborted) {
        this.streamDone = true
        await this.queue?.finish()
      }
      if (!this.queue) this.fail('voz indisponível', 'missing audio')
    } catch (error) {
      if (controller.signal.aborted) return
      this.fail('voz indisponível', error instanceof Error ? error.message : undefined)
    }
  }

  private createQueue(format: string): void {
    if (!this.context || this.queue) return
    const queue = new AudioQueue({
      context: this.context,
      format,
      onStart: () => this.handleAudioStart(),
      onError: (error) => this.fail('voz indisponível', error.message),
    })
    this.queue = queue
    const pending = this.pendingAudio
    this.pendingAudio = []
    for (const audio of pending) queue.appendBase64(audio)
    if (pending.length > 0) void queue.drain()
  }

  private handleAudioStart(): void {
    if (!this.speaking) return
    const text = this.current?.text ?? ''
    this.onSpokenText?.(text)
    this.emit('speechstart', { text, cached: this.cached })
    this.lastDriverAt = performance.now()
    this.engine.setDriver(this.driver)
  }

  private rebuildTimeline(): void {
    const chunks = [...this.alignments.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, record]) => alignmentToChunk(record.offsetSec, record.segments))
    this.timeline = buildSpeechTimeline(chunks)
    let end = 0
    for (const record of this.alignments.values()) {
      for (const segment of record.segments) {
        end = Math.max(end, record.offsetSec + segment.end)
      }
    }
    this.lastAlignmentEnd = end
  }

  private driver = (now: number): Partial<RigParams> | null => {
    if (!this.speaking || !this.queue) return null
    const clock = this.queue.clock
    const dt = Math.min(0.05, Math.max(0, (now - this.lastDriverAt) / 1000))
    this.lastDriverAt = now
    if (clock === null) return this.residual.apply({ ...REST_VISEME_PARAMS }, dt)

    if (this.timeline) {
      const viseme = this.timeline.visemeAt(clock)
      if (viseme && viseme !== this.lastViseme) {
        this.lastViseme = viseme
        this.emit('viseme', { viseme, at: clock })
      }
    }

    if (
      !this.streamDone &&
      this.lastAlignmentEnd > 0 &&
      clock > this.lastAlignmentEnd + SYNC_WARN_MS / 1000
    ) {
      const audioNow = this.context?.currentTime ?? 0
      if (audioNow - this.lastWarnAt > SYNC_WARN_INTERVAL_MS / 1000) {
        this.lastWarnAt = audioNow
        this.emit('syncwarn', {
          lagMs: Math.round((clock - this.lastAlignmentEnd) * 1000),
        })
      }
    }

    const total = Math.max(this.queue.duration, this.timeline?.duration ?? 0)
    if (this.streamDone && total > 0 && clock >= total + END_PADDING_SECONDS) {
      this.complete(false)
      return null
    }

    const sample = this.timeline ? this.timeline.sample(clock) : { ...REST_VISEME_PARAMS }
    return this.residual.apply(sample, dt)
  }

  private complete(interrupted: boolean): void {
    const text = this.current?.text ?? ''
    this.speaking = false
    this.abort?.abort()
    this.abort = null
    const queue = this.queue
    this.queue = null
    queue?.dispose()
    this.engine.setDriver(null)
    this.engine.setTarget(REST_VISEME_PARAMS)
    this.residual.reset()
    this.current = null
    this.onSpokenText?.(null)
    this.emit('speechend', { text, interrupted })

    const next = this.pendingSpeech.shift()
    if (next) {
      this.idle?.anticipateBlink()
      void this.run(next)
    }
  }

  private fail(message: string, code?: string): void {
    if (!this.speaking) return
    this.speaking = false
    this.abort?.abort()
    this.abort = null
    const queue = this.queue
    this.queue = null
    queue?.dispose()
    this.engine.setDriver(null)
    this.engine.setTarget(REST_VISEME_PARAMS)
    this.residual.reset()
    this.current = null
    this.onSpokenText?.(null)
    this.emit('error', code === undefined ? { message } : { message, code })
  }

  private emit<K extends SpeechEventName>(event: K, payload: SpeechEventMap[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) handler(payload)
  }
}

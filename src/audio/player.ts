import { decodeWavSamples, parseWavHeader } from './wav.ts'
import type { WavFormat } from './wav.ts'

export interface AudioQueueOptions {
  readonly context: AudioContext
  readonly format: string
  readonly bufferSeconds?: number
  readonly onStart?: () => void
  readonly onError?: (error: Error) => void
}

const DEFAULT_BUFFER_SECONDS = 0.28
const START_LEAD_SECONDS = 0.05
const DECODE_RETRY_MS = 250

function concatBytes(parts: readonly Uint8Array[], total: number): Uint8Array {
  if (parts.length === 1) {
    const only = parts[0]
    if (only) return only
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export class AudioQueue {
  private readonly context: AudioContext
  private readonly format: string
  private readonly bufferSeconds: number
  private readonly onStart?: () => void
  private readonly onError?: (error: Error) => void
  private readonly gain: GainNode
  private readonly analyser: AnalyserNode
  private readonly timeDomain: Uint8Array<ArrayBuffer>
  private readonly parts: Uint8Array[] = []
  private byteLength = 0
  private wavFormat: WavFormat | null = null
  private wavDecodedSamples = 0
  private decodedBuffer: AudioBuffer | null = null
  private readonly pending: Float32Array[] = []
  private pendingSamples = 0
  private pendingRate = 48000
  private readonly sources = new Set<AudioBufferSourceNode>()
  private startAt = 0
  private scheduledSeconds = 0
  private started = false
  private finished = false
  private aborted = false
  private failed = false
  private decodingPromise: Promise<void> | null = null
  private lastDecodeAt = 0

  constructor(options: AudioQueueOptions) {
    this.context = options.context
    this.format = options.format
    this.bufferSeconds = options.bufferSeconds ?? DEFAULT_BUFFER_SECONDS
    if (options.onStart) this.onStart = options.onStart
    if (options.onError) this.onError = options.onError
    this.gain = this.context.createGain()
    this.gain.gain.value = 1
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.62
    this.timeDomain = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    this.gain.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  get energy(): number {
    if (!this.started || this.aborted) return 0
    this.analyser.getByteTimeDomainData(this.timeDomain)
    let sum = 0
    for (let index = 0; index < this.timeDomain.length; index += 1) {
      const sample = ((this.timeDomain[index] ?? 128) - 128) / 128
      sum += sample * sample
    }
    return Math.min(1, Math.sqrt(sum / this.timeDomain.length) * 4.5)
  }

  appendBase64(value: string): void {
    if (!value || this.aborted) return
    const bytes = base64ToBytes(value)
    if (bytes.length === 0) return
    this.parts.push(bytes)
    this.byteLength += bytes.length
  }

  get clock(): number | null {
    if (!this.started || this.aborted) return null
    return Math.max(0, this.context.currentTime - this.startAt)
  }

  get isStarted(): boolean {
    return this.started
  }

  get isFinished(): boolean {
    return this.finished
  }

  get duration(): number {
    if (this.format === 'wav') {
      const rate = this.wavFormat?.sampleRate ?? 0
      return rate > 0 ? this.wavDecodedSamples / rate : 0
    }
    return this.decodedBuffer?.duration ?? 0
  }

  async drain(force = false): Promise<void> {
    if (this.aborted || this.byteLength === 0) return
    if (this.format === 'wav') {
      this.drainWav()
      return
    }
    await this.drainCompressed(force)
  }

  async finish(): Promise<void> {
    if (this.aborted) return
    this.finished = true
    await this.drain(true)
    if (this.aborted) return

    if (!this.started) this.start()
    if (this.started) return
    if (this.byteLength === 0) {
      this.fail(new Error('empty audio'))
      return
    }
    this.fail(new Error('unable to decode audio'))
  }

  interrupt(fadeMs = 150): void {
    if (this.aborted) return
    this.aborted = true
    const now = this.context.currentTime
    const fade = Math.max(0, fadeMs) / 1000
    if (fade > 0) {
      this.gain.gain.cancelScheduledValues(now)
      this.gain.gain.setValueAtTime(this.gain.gain.value, now)
      this.gain.gain.linearRampToValueAtTime(0, now + fade)
    } else {
      this.gain.gain.value = 0
    }
    const stopAt = now + fade + 0.02
    for (const source of this.sources) {
      try {
        source.stop(stopAt)
      } catch {
        this.sources.delete(source)
      }
    }
    this.started = false
  }

  dispose(): void {
    this.interrupt(0)
    this.sources.clear()
    this.gain.disconnect()
  }

  private drainWav(): void {
    const bytes = this.bytes()
    this.wavFormat ??= parseWavHeader(bytes)
    const format = this.wavFormat
    if (!format) return

    const samples = decodeWavSamples(bytes, format)
    if (samples.length <= this.wavDecodedSamples) return

    const tail = samples.subarray(this.wavDecodedSamples)
    this.wavDecodedSamples = samples.length
    this.pushPcm(tail, format.sampleRate)
  }

  private async drainCompressed(force: boolean): Promise<void> {
    if (this.decodingPromise) {
      await this.decodingPromise
      if (this.aborted) return
      if (!force) return
    }
    const now = Date.now()
    if (!force && now - this.lastDecodeAt < DECODE_RETRY_MS) return
    this.lastDecodeAt = now

    const task = (async (): Promise<void> => {
      try {
        const source = this.bytes()
        const copy = new Uint8Array(source.length)
        copy.set(source)
        const buffer = await this.context.decodeAudioData(copy.buffer)
        if (this.aborted) return
        if (!this.decodedBuffer || buffer.duration > this.decodedBuffer.duration) {
          this.decodedBuffer = buffer
        }
        this.scheduleDecoded(buffer)
      } catch (error) {
        if (this.finished && !this.aborted && !this.started) {
          this.fail(error instanceof Error ? error : new Error('unable to decode audio'))
        }
      }
    })()

    this.decodingPromise = task
    try {
      await task
    } finally {
      this.decodingPromise = null
    }
  }

  private scheduleDecoded(buffer: AudioBuffer): void {
    if (!this.started) {
      if (buffer.duration >= this.bufferSeconds || this.finished) this.start()
      return
    }
    if (buffer.duration <= this.scheduledSeconds + 0.005) return

    const offset = this.scheduledSeconds
    const when = this.startAt + offset
    const startWhen = Math.max(when, this.context.currentTime + 0.005)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)
    source.start(startWhen, offset)
    this.track(source)
    this.scheduledSeconds = buffer.duration
  }

  private pushPcm(samples: Float32Array, sampleRate: number): void {
    if (samples.length === 0) return
    if (!this.started) {
      this.pending.push(samples)
      this.pendingSamples += samples.length
      this.pendingRate = sampleRate
      if (this.finished || this.pendingSamples / sampleRate >= this.bufferSeconds) {
        this.start()
      }
      return
    }
    this.schedulePcm(samples, sampleRate)
  }

  private schedulePcm(samples: Float32Array, sampleRate: number): void {
    if (samples.length === 0) return
    const buffer = this.context.createBuffer(1, samples.length, sampleRate)
    buffer.getChannelData(0).set(samples)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)
    const when = Math.max(
      this.startAt + this.scheduledSeconds,
      this.context.currentTime + 0.005,
    )
    source.start(when)
    this.track(source)
    this.scheduledSeconds += samples.length / sampleRate
  }

  private start(): void {
    if (this.started || this.aborted) return
    if (this.format === 'wav') {
      const format = this.wavFormat
      if (!format || this.pendingSamples === 0) return
      const samples = this.takePending()
      this.started = true
      this.startAt = this.context.currentTime + START_LEAD_SECONDS
      this.schedulePcm(samples, this.pendingRate)
    } else {
      const buffer = this.decodedBuffer
      if (!buffer || buffer.duration === 0) return
      this.started = true
      this.startAt = this.context.currentTime + START_LEAD_SECONDS
      const source = this.context.createBufferSource()
      source.buffer = buffer
      source.connect(this.gain)
      source.start(this.startAt)
      this.track(source)
      this.scheduledSeconds = buffer.duration
    }
    this.onStart?.()
  }

  private takePending(): Float32Array {
    const total = this.pendingSamples
    const merged = new Float32Array(total)
    let offset = 0
    for (const part of this.pending) {
      merged.set(part, offset)
      offset += part.length
    }
    this.pending.length = 0
    this.pendingSamples = 0
    return merged
  }

  private track(source: AudioBufferSourceNode): void {
    this.sources.add(source)
    source.addEventListener('ended', () => {
      this.sources.delete(source)
      source.disconnect()
    })
  }

  private bytes(): Uint8Array {
    return concatBytes(this.parts, this.byteLength)
  }

  private fail(error: Error): void {
    if (this.failed || this.aborted) return
    this.failed = true
    this.onError?.(error)
  }
}

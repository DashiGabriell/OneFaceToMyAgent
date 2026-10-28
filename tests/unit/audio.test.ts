import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNdjson } from '../../src/audio/ndjson.ts'
import { parseTtsEvent } from '../../src/audio/protocol.ts'
import { buildSpeechTimeline } from '../../src/audio/timeline.ts'
import { decodeWavSamples, parseWavHeader } from '../../src/audio/wav.ts'
import { mockWav } from '../../server/mock.ts'

function makeWav(samples: readonly number[], sampleRate = 8000): Uint8Array {
  const dataSize = samples.length * 2
  const bytes = new Uint8Array(44 + dataSize)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      bytes[offset + index] = text.charCodeAt(index)
    }
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataSize, true)
  samples.forEach((sample, index) => {
    bytes[44 + index * 2] = sample & 0xff
    bytes[44 + index * 2 + 1] = (sample >> 8) & 0xff
  })
  return bytes
}

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

test('parses and decodes 16-bit mono WAV samples', () => {
  const bytes = makeWav([0, 16384, -32768, 8192])
  const format = parseWavHeader(bytes)
  assert.ok(format)
  assert.equal(format.sampleRate, 8000)
  assert.equal(format.channels, 1)
  assert.equal(format.dataSize, 8)
  const samples = decodeWavSamples(bytes, format)
  assert.equal(samples.length, 4)
  assert.equal(samples[0], 0)
  assert.equal(samples[1], 0.5)
  assert.equal(samples[2], -1)
})

test('handles incomplete WAV headers and partial data', () => {
  const bytes = makeWav([0, 16384, -32768])
  assert.equal(parseWavHeader(bytes.subarray(0, 20)), null)
  const format = parseWavHeader(bytes)
  assert.ok(format)
  const partial = decodeWavSamples(bytes.subarray(0, 46), format)
  assert.equal(partial.length, 1)
})

test('rejects non-16-bit WAV data', () => {
  const bytes = makeWav([0])
  new DataView(bytes.buffer).setUint16(34, 24, true)
  assert.equal(parseWavHeader(bytes), null)
})

test('mock WAV is a valid stream with word alignment', async () => {
  const mock = mockWav('Olá mundo')
  const format = parseWavHeader(mock.bytes)
  assert.ok(format)
  assert.ok(mock.durationSec > 0.5)
  assert.equal(mock.words.length, 2)
  assert.ok((mock.words[1]?.start ?? 0) > (mock.words[0]?.end ?? 0))
  const samples = decodeWavSamples(mock.bytes, format)
  assert.equal(samples.length, Math.round(mock.durationSec * format.sampleRate))
})

test('parses NDJSON split across chunks', async () => {
  const items = await (async () => {
    const parsed: unknown[] = []
    for await (const item of parseNdjson(
      streamOf(['{"type":"done",', '"durationSec":1}\n{"type":"meta","emotion":"happy",', '"cached":true}\n']),
    )) {
      parsed.push(item)
    }
    return parsed
  })()
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { type: 'done', durationSec: 1 })
})

test('builds a viseme timeline from Fish word segments', () => {
  const timeline = buildSpeechTimeline([
    { offsetSec: 0, segments: [{ text: 'Olá', start: 0, end: 0.4 }] },
    { offsetSec: 1, segments: [{ text: 'mundo', start: 0, end: 0.5 }] },
  ])
  assert.ok(timeline.events.length > 0)
  assert.ok(Math.abs(timeline.duration - 1.5) < 1e-9)
  assert.equal(timeline.events[0]?.start, 0)
  assert.ok((timeline.events.at(-1)?.end ?? 0) <= 1.5)
  assert.ok((timeline.sample(1.2).jawOpen ?? 0) > 0)
  assert.ok(timeline.visemeAt(1.2))
  assert.equal(timeline.visemeAt(0.8), null)
})

test('speech timeline ignores empty and inverted segments', () => {
  const timeline = buildSpeechTimeline([
    { offsetSec: 0, segments: [{ text: '...', start: 0, end: 0.2 }] },
    { offsetSec: 0.3, segments: [{ text: 'x', start: 0.2, end: 0.1 }] },
    { offsetSec: 0.5, segments: [{ text: 'a', start: 0, end: 0.2 }] },
  ])
  assert.ok(timeline.events.length > 0)
  assert.equal(timeline.duration, 0.7)
})

test('validates TTS protocol events at runtime', () => {
  assert.deepEqual(parseTtsEvent({ type: 'meta', cached: true, emotion: 'happy' }), {
    type: 'meta',
    cached: true,
    model: '',
    format: 'opus',
    language: 'pt-BR',
    voiceId: '',
    emotion: 'happy',
  })
  assert.equal(parseTtsEvent({ type: 'meta', emotion: 'angry' }), null)
  assert.equal(parseTtsEvent({ type: 'audio', audioBase64: '' }), null)
  assert.ok(parseTtsEvent({ type: 'audio', audioBase64: 'AAAA' }))
  assert.ok(
    parseTtsEvent({
      type: 'alignment',
      chunkSeq: 0,
      offsetSec: 0,
      segments: [{ text: 'oi', start: 0, end: 0.2 }],
    }),
  )
  assert.equal(
    parseTtsEvent({
      type: 'alignment',
      segments: [{ text: 'oi', start: 0.3, end: 0.2 }],
    })?.type,
    'alignment',
  )
  assert.equal(parseTtsEvent({ type: 'done', durationSec: 1 })?.type, 'done')
  assert.equal(parseTtsEvent({ type: 'error', message: 'x' })?.type, 'error')
  assert.equal(parseTtsEvent({ type: 'nope' }), null)
  assert.equal(parseTtsEvent(null), null)
})

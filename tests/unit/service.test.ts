import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskCache } from '../../server/cache.ts'
import {
  VoiceUnavailableError,
  speechCacheKey,
  streamSpeech,
} from '../../server/service.ts'
import type { SpeechServiceDeps } from '../../server/service.ts'
import { DEFAULT_PERSONA } from '../../src/core/persona.ts'
import type { TtsEvent } from '../../src/audio/protocol.ts'

function fishSse(events: readonly unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const fishEvents = [
  {
    audio_base64: 'AAAA',
    chunk_seq: 0,
    chunk_audio_offset_sec: 0,
    alignment: null,
  },
  {
    audio_base64: 'BBBB',
    content: 'Olá mundo',
    chunk_seq: 0,
    chunk_audio_offset_sec: 0,
    alignment: {
      audio_duration: 0.9,
      segments: [
        { text: 'Olá', start: 0, end: 0.4 },
        { text: 'mundo', start: 0.45, end: 0.9 },
      ],
    },
  },
]

async function collect(iterable: AsyncIterable<TtsEvent>): Promise<TtsEvent[]> {
  const events: TtsEvent[] = []
  for await (const event of iterable) events.push(event)
  return events
}

async function makeDeps(
  overrides: Partial<SpeechServiceDeps> = {},
): Promise<{ deps: SpeechServiceDeps; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'rosto-service-'))
  const cache = new DiskCache({ dir, ttlMs: 100_000, maxEntries: 8 })
  await cache.init()
  return {
    dir,
    deps: {
      apiKey: 'test-key',
      persona: DEFAULT_PERSONA,
      cache,
      ...overrides,
    },
  }
}

test('streams Fish events and writes a cache entry', async () => {
  const { deps, dir } = await makeDeps({
    fetchImpl: (async () => fishSse(fishEvents)) as typeof fetch,
  })
  try {
    const events = await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    assert.equal(events[0]?.type, 'meta')
    assert.equal(events[0]?.type === 'meta' && events[0].cached, false)
    assert.equal(events.filter((event) => event.type === 'audio').length, 2)
    const done = events.at(-1)
    assert.equal(done?.type, 'done')
    if (done?.type === 'done') assert.ok(Math.abs(done.durationSec - 0.9) < 1e-9)
    assert.equal(deps.cache.size, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a repeated phrase is served from the cache without calling Fish', async () => {
  let calls = 0
  const { deps, dir } = await makeDeps({
    fetchImpl: (async () => {
      calls += 1
      return fishSse(fishEvents)
    }) as typeof fetch,
  })
  try {
    const first = await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    const second = await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    assert.equal(calls, 1)
    const firstMeta = first[0]
    const secondMeta = second[0]
    assert.equal(firstMeta?.type === 'meta' && firstMeta.cached, false)
    assert.equal(secondMeta?.type === 'meta' && secondMeta.cached, true)
    assert.deepEqual(
      second.filter((event) => event.type === 'audio'),
      first.filter((event) => event.type === 'audio'),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('nocache forces a new generation but still refreshes the cache', async () => {
  let calls = 0
  const { deps, dir } = await makeDeps({
    fetchImpl: (async () => {
      calls += 1
      return fishSse(fishEvents)
    }) as typeof fetch,
  })
  try {
    await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    const forced = await collect(streamSpeech(deps, { text: 'Olá mundo', nocache: true }))
    assert.equal(calls, 2)
    assert.equal(forced[0]?.type === 'meta' && forced[0].cached, false)
    await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    assert.equal(calls, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('cache keys vary with text, emotion, voice and format', () => {
  const base = {
    text: 'Olá',
    voiceId: '',
    model: 's2.1-pro',
    format: 'opus',
    language: 'pt-BR',
    emotion: 'neutral' as const,
  }
  const keys = new Set([
    speechCacheKey(base),
    speechCacheKey({ ...base, text: 'Outra' }),
    speechCacheKey({ ...base, emotion: 'happy' }),
    speechCacheKey({ ...base, voiceId: 'voice-1' }),
    speechCacheKey({ ...base, format: 'wav' }),
  ])
  assert.equal(keys.size, 5)
})

test('turns upstream Fish errors into voice-unavailable errors', async () => {
  const { deps, dir } = await makeDeps({
    fetchImpl: (async () => new Response('no credit', { status: 402 })) as typeof fetch,
  })
  try {
    await assert.rejects(
      collect(streamSpeech(deps, { text: 'Olá mundo' })),
      (error: unknown) => error instanceof VoiceUnavailableError && error.status === 502,
    )
    assert.equal(deps.cache.size, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('mock mode streams real WAV audio and caches it', async () => {
  const { deps, dir } = await makeDeps({ mock: true })
  try {
    const first = await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    const meta = first[0]
    assert.equal(meta?.type === 'meta' && meta.format, 'wav')
    assert.ok(first.filter((event) => event.type === 'audio').length > 0)
    const alignments = first.filter(
      (event): event is Extract<TtsEvent, { type: 'alignment' }> =>
        event.type === 'alignment',
    )
    assert.ok(alignments.length > 0)
    assert.ok((alignments.at(-1)?.segments.length ?? 0) === 2)
    const done = first.at(-1)
    assert.equal(done?.type, 'done')

    const second = await collect(streamSpeech(deps, { text: 'Olá mundo' }))
    assert.equal(second[0]?.type === 'meta' && second[0].cached, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

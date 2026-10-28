import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FishApiError,
  buildFishHeaders,
  buildFishPayload,
  normalizeFishEvent,
  openFishStream,
  parseFishSse,
} from '../../server/fish.ts'

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}

async function* readStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

const event = {
  audio_base64: 'AAAA',
  content: 'Olá',
  chunk_seq: 0,
  chunk_audio_offset_sec: 0.5,
  alignment: {
    audio_duration: 0.4,
    segments: [{ text: 'Olá', start: 0, end: 0.4 }],
  },
}

test('builds the Fish payload with an optional voice id', () => {
  const base = {
    text: 'Olá',
    voiceId: '',
    model: 's2.1-pro',
    format: 'opus',
    language: 'pt-BR',
  }
  assert.deepEqual(buildFishPayload(base), {
    text: 'Olá',
    format: 'opus',
    latency: 'balanced',
    language: 'pt-BR',
  })
  assert.equal(buildFishPayload({ ...base, voiceId: 'voice-1' }).reference_id, 'voice-1')
  assert.equal(buildFishHeaders('secret', 's2.1-pro').model, 's2.1-pro')
  assert.equal(buildFishHeaders('secret', 's2.1-pro').Authorization, 'Bearer secret')
})

test('parses SSE frames split across arbitrary chunks', async () => {
  const frame = `data: ${JSON.stringify(event)}\r\n\r\n`
  const chunks = [frame.slice(0, 7), frame.slice(7, 30), frame.slice(30)]
  const parsed = await collect(parseFishSse(readStream(streamOf(chunks))))
  assert.equal(parsed.length, 1)
  assert.deepEqual(parsed[0], event)
})

test('ignores comments and keeps multiple events in one chunk', async () => {
  const frame = `: ping\n\ndata:${JSON.stringify(event)}\n\ndata: ${JSON.stringify({ ...event, chunk_seq: 1 })}\n\n`
  const parsed = await collect(parseFishSse(readStream(streamOf([frame]))))
  assert.equal(parsed.length, 2)
})

test('rejects malformed SSE payloads', async () => {
  await assert.rejects(collect(parseFishSse(readStream(streamOf(['data: {oops\n\n'])))))
})

test('normalizes audio and alignment snapshots', () => {
  const events = normalizeFishEvent(event)
  assert.equal(events.length, 2)
  assert.deepEqual(events[0], {
    type: 'audio',
    audioBase64: 'AAAA',
    chunkSeq: 0,
    offsetSec: 0.5,
  })
  const alignment = events[1]
  assert.equal(alignment?.type, 'alignment')
  if (alignment?.type === 'alignment') {
    assert.equal(alignment.offsetSec, 0.5)
    assert.equal(alignment.audioDuration, 0.4)
    assert.equal(alignment.segments[0]?.text, 'Olá')
  }
})

test('drops invalid or empty Fish payloads', () => {
  assert.deepEqual(normalizeFishEvent(null), [])
  assert.deepEqual(normalizeFishEvent({}), [])
  assert.deepEqual(
    normalizeFishEvent({
      audio_base64: '',
      alignment: { audio_duration: 1, segments: [{ text: 'a', start: 2, end: 1 }] },
    }),
    [],
  )
})

test('opens a Fish stream and normalizes its events', async () => {
  const body = `data: ${JSON.stringify(event)}\n\n`
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }) as typeof fetch

  const stream = await openFishStream(
    fetchImpl,
    'secret',
    {
      text: 'Olá',
      voiceId: 'voice-1',
      model: 's2.1-pro',
      format: 'opus',
      language: 'pt-BR',
    },
    undefined,
  )
  const events = await collect(stream)
  assert.equal(events.length, 2)
  const call = calls[0]
  assert.ok(call)
  assert.equal(call.init?.method, 'POST')
  const rawBody = String(call.init?.body)
  assert.match(rawBody, /"reference_id":"voice-1"/)
})

test('surfaces Fish API errors with the upstream status', async () => {
  const fetchImpl = (async () => new Response('no credit', { status: 402 })) as typeof fetch
  await assert.rejects(
    openFishStream(fetchImpl, 'secret', {
      text: 'Olá',
      voiceId: '',
      model: 's2.1-pro',
      format: 'opus',
      language: 'pt-BR',
    }),
    (error: unknown) => error instanceof FishApiError && error.status === 402,
  )
})

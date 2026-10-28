import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import type { DiskCache } from './cache.ts'
import type { SpeechRequest } from './service.ts'
import { VoiceUnavailableError, streamSpeech } from './service.ts'
import { EMOTION_NAMES } from '../src/core/emotion.ts'
import type { EmotionName } from '../src/core/emotion.ts'
import type { Persona } from '../src/core/persona.ts'

export interface AppOptions {
  readonly staticDir: string
  readonly persona: Persona
  readonly apiKey: string
  readonly cache: DiskCache
  readonly mock: boolean
  readonly fetchImpl?: typeof fetch
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const MAX_BODY_BYTES = 16_384

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new HttpError(400, 'empty body')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid json')
  }
}

function parseSpeechRequest(value: unknown, nocacheQuery: boolean): SpeechRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'body must be an object')
  }
  const body = value as Record<string, unknown>
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) throw new HttpError(400, 'text is required')
  if (text.length > 1000) throw new HttpError(400, 'text is too long')

  let emotion: EmotionName | undefined
  if (body.emotion !== undefined) {
    if (
      typeof body.emotion !== 'string' ||
      !(EMOTION_NAMES as readonly string[]).includes(body.emotion)
    ) {
      throw new HttpError(400, 'unknown emotion')
    }
    emotion = body.emotion as EmotionName
  }

  const nocache = nocacheQuery || body.nocache === true
  return emotion ? { text, emotion, nocache } : { text, nocache }
}

function contentTypeFor(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

async function serveStatic(
  options: AppOptions,
  response: ServerResponse,
  pathname: string,
  method: string,
): Promise<void> {
  const root = resolve(options.staticDir)
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '')
  let target = resolve(root, relative || 'index.html')

  if (target !== root && !target.startsWith(root + sep)) {
    sendJson(response, 403, { error: 'forbidden' })
    return
  }

  let info = await stat(target).catch(() => null)
  if (!info?.isFile() && relative === '') {
    target = resolve(root, 'index.html')
    info = await stat(target).catch(() => null)
  }

  if (!info?.isFile()) {
    if (!extname(relative)) {
      target = resolve(root, 'index.html')
      info = await stat(target).catch(() => null)
    }
  }

  if (!info?.isFile()) {
    sendJson(response, 404, { error: 'not_found' })
    return
  }

  const immutable = relative.startsWith('assets/')
  response.writeHead(200, {
    'Content-Type': contentTypeFor(target),
    'Content-Length': info.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })

  if (method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(target)
  stream.on('error', () => {
    if (!response.headersSent) sendJson(response, 500, { error: 'read_failed' })
    else response.destroy()
  })
  stream.pipe(response)
}

async function handleTts(
  options: AppOptions,
  request: IncomingMessage,
  response: ServerResponse,
  nocacheQuery: boolean,
): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: 'method_not_allowed' })
    return
  }

  const controller = new AbortController()
  let aborted = false
  response.on('close', () => {
    if (!response.writableEnded) {
      aborted = true
      controller.abort()
    }
  })

  try {
    const body = await readJson(request)
    const parsed = parseSpeechRequest(body, nocacheQuery)
    const speechRequest: SpeechRequest = {
      ...parsed,
      signal: controller.signal,
    }

    response.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    })

    for await (const event of streamSpeech(
      {
        apiKey: options.apiKey,
        persona: options.persona,
        cache: options.cache,
        mock: options.mock,
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      },
      speechRequest,
    )) {
      if (aborted || response.destroyed) return
      response.write(`${JSON.stringify(event)}\n`)
    }
    response.end()
  } catch (error) {
    const status = error instanceof VoiceUnavailableError ? error.status : 500
    console.error('[tts]', status, error instanceof Error ? error.message : error)

    if (!response.headersSent) {
      sendJson(response, status === 500 ? 500 : 502, {
        error: 'voice_unavailable',
        message: 'voz indisponível',
      })
      return
    }
    if (!response.writableEnded) {
      response.write(`${JSON.stringify({ type: 'error', message: 'voz indisponível' })}\n`)
      response.end()
    }
  }
}

export function createRequestHandler(
  options: AppOptions,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const pathname = url.pathname
      const nocache = url.searchParams.get('nocache') === '1' || url.searchParams.has('nocache')

      if (pathname === '/api/health') {
        sendJson(response, 200, { ok: true, mock: options.mock })
        return
      }

      if (pathname === '/api/persona') {
        sendJson(response, 200, options.persona)
        return
      }

      if (pathname === '/api/tts') {
        await handleTts(options, request, response, nocache)
        return
      }

      if (pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'not_found' })
        return
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'method_not_allowed' })
        return
      }

      await serveStatic(options, response, pathname, request.method)
    })().catch((error: unknown) => {
      console.error('[server]', error)
      if (!response.headersSent) sendJson(response, 500, { error: 'internal_error' })
      else response.destroy()
    })
  }
}

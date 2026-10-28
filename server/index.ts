import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequestHandler } from './app.ts'
import { DiskCache } from './cache.ts'
import { validatePersona } from '../src/core/persona.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

try {
  process.loadEnvFile(join(root, '.env'))
} catch {
  // .env is optional; production can provide real environment variables.
}

const persona = validatePersona(JSON.parse(await readFile(join(root, 'persona.json'), 'utf8')))
const cache = new DiskCache({ dir: join(root, '.cache', 'tts') })
await cache.init()

const mock = process.env.FISHAUDIO_MOCK === '1'
const apiKey = process.env.API_KEY_FISHAUDIO ?? ''

if (mock) {
  console.warn('[tts] FISHAUDIO_MOCK=1 — áudio simulado, apenas para desenvolvimento')
} else if (!apiKey) {
  console.warn('[tts] API_KEY_FISHAUDIO ausente — /api/tts responderá "voz indisponível"')
}

const handler = createRequestHandler({
  staticDir: join(root, 'dist'),
  persona,
  apiKey,
  cache,
  mock,
})

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'

createServer(handler).listen(port, host, () => {
  console.log(`[tts] http://${host}:${port}${mock ? ' (mock)' : ''}`)
})

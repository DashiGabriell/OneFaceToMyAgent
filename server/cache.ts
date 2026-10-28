import { createReadStream, createWriteStream } from 'node:fs'
import type { WriteStream } from 'node:fs'
import { mkdir, readdir, stat, unlink, rename, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export interface DiskCacheOptions {
  readonly dir: string
  readonly ttlMs?: number
  readonly maxEntries?: number
  readonly now?: () => number
}

export interface CacheWriter {
  write(line: string): void
  commit(): Promise<void>
  abort(): Promise<void>
}

export interface CacheEntry {
  readonly key: string
  readonly path: string
  at: number
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_MAX_ENTRIES = 128

export async function* readLines(path: string): AsyncGenerator<string, void, void> {
  const stream = createReadStream(path, { encoding: 'utf8' })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of reader) {
      const trimmed = line.trim()
      if (trimmed) yield trimmed
    }
  } finally {
    reader.close()
    stream.destroy()
  }
}

export class DiskCache {
  private readonly dir: string
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number
  private readonly entries = new Map<string, CacheEntry>()

  constructor(options: DiskCacheOptions) {
    this.dir = options.dir
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.now = options.now ?? Date.now
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const files = await readdir(this.dir)
    for (const file of files) {
      if (!file.endsWith('.ndjson')) continue
      const key = file.slice(0, -'.ndjson'.length)
      if (!/^[a-f0-9]{64}$/.test(key)) continue
      const path = join(this.dir, file)
      this.entries.set(key, { key, path, at: this.now() })
    }
    await this.evict()
  }

  get size(): number {
    return this.entries.size
  }

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    if (!entry) return null
    if (this.now() - entry.at > this.ttlMs) {
      this.entries.delete(key)
      await unlink(entry.path).catch(() => undefined)
      return null
    }
    try {
      const info = await stat(entry.path)
      if (!info.isFile()) throw new Error('not a file')
    } catch {
      this.entries.delete(key)
      return null
    }
    entry.at = this.now()
    await utimes(entry.path, new Date(), new Date()).catch(() => undefined)
    return entry.path
  }

  async openWriter(key: string): Promise<CacheWriter> {
    const path = join(this.dir, `${key}.ndjson`)
    const temp = join(this.dir, `${key}.${process.pid}.${Date.now()}.tmp`)
    const stream: WriteStream = createWriteStream(temp, { encoding: 'utf8' })
    let closed = false
    let streamError: Error | null = null
    stream.on('error', (error) => {
      streamError = error
    })

    const close = async (): Promise<void> => {
      if (closed) return
      closed = true
      await new Promise<void>((resolve, reject) => {
        stream.end(() => resolve())
        stream.once('error', reject)
      })
      if (streamError) throw streamError
    }

    return {
      write: (line: string): void => {
        if (closed || streamError) return
        stream.write(line)
      },
      commit: async (): Promise<void> => {
        await close()
        await rename(temp, path)
        this.entries.delete(key)
        this.entries.set(key, { key, path, at: this.now() })
        await this.evict()
      },
      abort: async (): Promise<void> => {
        if (!closed) {
          stream.destroy()
          closed = true
        }
        await unlink(temp).catch(() => undefined)
      },
    }
  }

  private async evict(): Promise<void> {
    if (this.entries.size <= this.maxEntries) return
    const sorted = [...this.entries.values()].sort((left, right) => left.at - right.at)
    for (const entry of sorted) {
      if (this.entries.size <= this.maxEntries) break
      this.entries.delete(entry.key)
      await unlink(entry.path).catch(() => undefined)
    }
  }
}

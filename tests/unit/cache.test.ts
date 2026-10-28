import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskCache, readLines } from '../../server/cache.ts'

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const lines: string[] = []
  for await (const line of iterable) lines.push(line)
  return lines
}

const keyA = 'a'.repeat(64)
const keyB = 'b'.repeat(64)
const keyC = 'c'.repeat(64)

test('writes, commits and reads a cache entry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rosto-cache-'))
  try {
    const cache = new DiskCache({ dir, ttlMs: 1000, maxEntries: 4 })
    await cache.init()
    const writer = await cache.openWriter(keyA)
    writer.write('one\n')
    writer.write('two\n')
    await writer.commit()

    assert.equal(cache.size, 1)
    const path = await cache.get(keyA)
    assert.ok(path)
    assert.deepEqual(await collect(readLines(path)), ['one', 'two'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('expired entries are removed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rosto-cache-'))
  try {
    let clock = 1_000
    const cache = new DiskCache({ dir, ttlMs: 100, maxEntries: 4, now: () => clock })
    await cache.init()
    const writer = await cache.openWriter(keyA)
    writer.write('x\n')
    await writer.commit()

    clock = 1_099
    assert.ok(await cache.get(keyA))

    clock = 1_250
    assert.equal(await cache.get(keyA), null)
    assert.equal(cache.size, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('least recently used entries are evicted', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rosto-cache-'))
  try {
    let clock = 1_000
    const cache = new DiskCache({ dir, ttlMs: 10_000, maxEntries: 2, now: () => clock })
    await cache.init()

    for (const key of [keyA, keyB]) {
      const writer = await cache.openWriter(key)
      writer.write(`${key}\n`)
      await writer.commit()
      clock += 1_000
    }

    assert.ok(await cache.get(keyA))
    clock += 1_000
    const writer = await cache.openWriter(keyC)
    writer.write('c\n')
    await writer.commit()

    assert.equal(cache.size, 2)
    assert.ok(await cache.get(keyC))
    assert.ok(await cache.get(keyA))
    assert.equal(await cache.get(keyB), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('aborted writes leave no entry behind', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rosto-cache-'))
  try {
    const cache = new DiskCache({ dir, maxEntries: 2 })
    await cache.init()
    const writer = await cache.openWriter(keyA)
    writer.write('partial\n')
    await writer.abort()
    assert.equal(cache.size, 0)
    assert.equal(await cache.get(keyA), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

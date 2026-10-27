import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  type?: string
  engines?: { node?: string }
}

test('runtime is Node 24 or newer', () => {
  const major = Number(process.versions.node.split('.')[0])
  assert.ok(major >= 24, `expected Node >= 24, got ${process.versions.node}`)
})

test('package is ESM', () => {
  assert.equal(pkg.type, 'module')
})

test('package declares Node engine', () => {
  assert.equal(pkg.engines?.node, '>=24')
})

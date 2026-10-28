import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_PERSONA,
  PersonaError,
  validatePersona,
} from '../../src/core/persona.ts'

test('empty persona falls back to the safe defaults', () => {
  assert.deepEqual(validatePersona({}), DEFAULT_PERSONA)
})

test('validates a complete persona', () => {
  const persona = validatePersona({
    voiceId: '  voice-123  ',
    model: 's2-pro',
    format: 'wav',
    language: 'pt-BR',
    defaultMood: 'happy',
    intensity: 1.2,
    blinkRange: [2.5, 5],
    headAccentRate: 0.5,
  })
  assert.equal(persona.voiceId, 'voice-123')
  assert.equal(persona.model, 's2-pro')
  assert.equal(persona.format, 'wav')
  assert.equal(persona.defaultMood, 'happy')
  assert.equal(persona.intensity, 1.2)
  assert.deepEqual(persona.blinkRange, [2.5, 5])
  assert.equal(persona.headAccentRate, 0.5)
})

test('rejects malformed persona fields', () => {
  const cases: unknown[] = [
    null,
    [],
    { model: 's3' },
    { format: 'flac' },
    { language: 'pt_BR' },
    { defaultMood: 'angry' },
    { intensity: 3 },
    { intensity: Number.NaN },
    { blinkRange: [6, 2] },
    { blinkRange: [1] },
    { headAccentRate: -0.1 },
    { voiceId: 42 },
  ]
  for (const value of cases) {
    assert.throws(() => validatePersona(value), PersonaError, JSON.stringify(value))
  }
})

test('the shipped persona.json validates', async () => {
  const raw = JSON.parse(
    await readFile(new URL('../../persona.json', import.meta.url), 'utf8'),
  ) as unknown
  const persona = validatePersona(raw)
  assert.equal(persona.model, 's2.1-pro-free')
  assert.equal(persona.format, 'opus')
  assert.equal(persona.language, 'pt-BR')
  assert.equal(persona.defaultMood, 'neutral')
  assert.ok(persona.blinkRange[0] < persona.blinkRange[1])
})

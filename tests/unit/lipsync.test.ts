import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REST_VISEME_PARAMS,
  VISEMES,
  buildMockSegments,
  buildTimeline,
  buildVisemeLoop,
  buildWordTimeline,
  sampleTimeline,
  timelineDuration,
  wordToUnits,
  wordToVisemes,
} from '../../src/lipsync/index.ts'

function assertNoOverlap(events: ReturnType<typeof buildWordTimeline>): void {
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]
    const current = events[index]
    if (!previous || !current) continue
    assert.ok(previous.end <= current.start + 1e-9, 'events overlap')
  }
}

test('tokenizes pt-BR digraphs into the expected visemes', () => {
  assert.deepEqual(wordToVisemes('chave'), ['sibilant', 'a', 'fv', 'e'])
  assert.deepEqual(wordToVisemes('palha'), ['mbp', 'a', 'l', 'a'])
  assert.deepEqual(wordToVisemes('banho'), ['mbp', 'a', 'nasal', 'o'])
  assert.deepEqual(wordToVisemes('carro'), ['dtn', 'a', 'dtn', 'o'])
  assert.deepEqual(wordToVisemes('passo'), ['mbp', 'a', 'sibilant', 'o'])
  assert.deepEqual(wordToVisemes('quero'), ['dtn', 'e', 'dtn', 'o'])
  assert.deepEqual(wordToVisemes('guerra'), ['dtn', 'e', 'dtn', 'a'])
})

test('handles nasal vowels and final nasal consonants', () => {
  assert.deepEqual(wordToVisemes('não'), ['dtn', 'nasal'])
  assert.deepEqual(wordToVisemes('bem'), ['mbp', 'nasal'])
  assert.deepEqual(wordToVisemes('um'), ['nasal'])
})

test('uses the exception dictionary for frequent words', () => {
  assert.deepEqual(wordToVisemes('que'), ['dtn', 'i'])
  assert.deepEqual(wordToVisemes('de'), ['dtn', 'i'])
  assert.deepEqual(wordToVisemes('nao'), ['dtn', 'nasal'])
})

test('vowels carry more weight than consonants', () => {
  const units = wordToUnits('casa')
  const consonant = units[0]
  const vowel = units[1]
  assert.ok(consonant && vowel)
  assert.ok(vowel.weight > consonant.weight)
})

test('buildWordTimeline distributes the word duration without overlap', () => {
  const events = buildWordTimeline('casa', 2, 3)
  assert.equal(events.length, 4)
  assert.equal(events[0]?.start, 2)
  assert.equal(events.at(-1)?.end, 3)
  assertNoOverlap(events)
  const duration = events.reduce((sum, event) => sum + (event.end - event.start), 0)
  assert.ok(Math.abs(duration - 1) < 1e-9)
})

test('buildTimeline preserves word gaps and sorts events', () => {
  const events = buildTimeline([
    { text: 'casa', start: 0, end: 1 },
    { text: 'bem', start: 1.2, end: 2 },
  ])
  assert.equal(events[0]?.start, 0)
  assert.equal(events.at(-1)?.end, 2)
  assertNoOverlap(events)
  assert.ok(events.some((event) => event.start >= 1.2))
  assert.equal(timelineDuration(events), 2)
})

test('mock segments add pauses for punctuation', () => {
  const segments = buildMockSegments('Olá, mundo!')
  assert.equal(segments.length, 2)
  assert.ok((segments[1]?.start ?? 0) > (segments[0]?.end ?? 0))
})

test('viseme loop covers all 12 shapes continuously', () => {
  const events = buildVisemeLoop()
  assert.equal(events.length, 12)
  assert.equal(events[0]?.start, 0)
  assert.ok(Math.abs((events.at(-1)?.end ?? 0) - 9.6) < 1e-9)
  assertNoOverlap(events)
})

test('sampleTimeline returns the active viseme shape', () => {
  const events = buildWordTimeline('a', 0, 1)
  const sample = sampleTimeline(events, 0.5)
  assert.ok(Math.abs((sample.jawOpen ?? 0) - (VISEMES.a.jawOpen ?? 0)) < 1e-9)
})

test('sampleTimeline blends neighboring visemes at the boundary', () => {
  const events = buildTimeline([
    { text: 'a', start: 0, end: 0.5 },
    { text: 'p', start: 0.5, end: 1 },
  ])
  const sample = sampleTimeline(events, 0.5)
  const jawOpen = sample.jawOpen ?? 0
  assert.ok(jawOpen > (VISEMES.mbp.jawOpen ?? 0))
  assert.ok(jawOpen < (VISEMES.a.jawOpen ?? 0))
})

test('sampleTimeline falls back to rest outside every event', () => {
  assert.deepEqual(sampleTimeline([], 0), REST_VISEME_PARAMS)
  const events = buildWordTimeline('a', 0, 1)
  const sample = sampleTimeline(events, 4)
  assert.deepEqual(sample, REST_VISEME_PARAMS)
})

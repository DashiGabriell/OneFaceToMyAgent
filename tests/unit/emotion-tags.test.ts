import assert from 'node:assert/strict'
import test from 'node:test'
import { parseEmotionTags } from '../../src/core/emotion-tags.ts'
import { buildEmotionTimeline, buildMockSegments, buildMockTimeline } from '../../src/lipsync/index.ts'

test('parses emotion tags into segments and strips them from the plain text', () => {
  const parsed = parseEmotionTags('Olá! [EMO:happy] Tudo bem?')
  assert.deepEqual(parsed.segments, [
    { text: 'Olá!', emotion: null },
    { text: 'Tudo bem?', emotion: 'happy' },
  ])
  assert.equal(parsed.plainText, 'Olá! Tudo bem?')
})

test('accepts lowercase, uppercase and spaced tags', () => {
  const parsed = parseEmotionTags('[ emo : SAD ] Eu não sei.')
  assert.deepEqual(parsed.segments, [{ text: 'Eu não sei.', emotion: 'sad' }])
  assert.equal(parsed.plainText, 'Eu não sei.')
})

test('switches emotion across several tags', () => {
  const parsed = parseEmotionTags('[EMO:thinking] Hmm... [EMO:surprised] Ah!')
  assert.deepEqual(parsed.segments, [
    { text: 'Hmm...', emotion: 'thinking' },
    { text: 'Ah!', emotion: 'surprised' },
  ])
})

test('supports the explicit neutral tag', () => {
  const parsed = parseEmotionTags('[EMO:neutral] Calma.')
  assert.deepEqual(parsed.segments, [{ text: 'Calma.', emotion: 'neutral' }])
})

test('drops unknown tags and collapses the leftover spacing', () => {
  const parsed = parseEmotionTags('oi   [EMO:bravo]   tudo')
  assert.deepEqual(parsed.segments, [{ text: 'oi tudo', emotion: null }])
  assert.equal(parsed.plainText, 'oi tudo')
})

test('returns a single untagged segment for plain text', () => {
  const parsed = parseEmotionTags('  Olá   mundo  ')
  assert.deepEqual(parsed.segments, [{ text: 'Olá mundo', emotion: null }])
  assert.equal(parsed.plainText, 'Olá mundo')
})

test('handles empty strings and tag-only strings', () => {
  assert.deepEqual(parseEmotionTags(''), { segments: [], plainText: '' })
  assert.deepEqual(parseEmotionTags('[EMO:happy]'), { segments: [], plainText: '' })
})

test('buildEmotionTimeline without tags matches the plain mock timeline', () => {
  const timeline = buildEmotionTimeline('Olá, mundo!')
  assert.deepEqual(timeline.events, buildMockTimeline('Olá, mundo!'))
  assert.deepEqual(timeline.cues, [])
})

test('buildEmotionTimeline schedules cues at each tagged segment start', () => {
  const timeline = buildEmotionTimeline('Olá [EMO:happy] que bom!')
  assert.equal(timeline.cues.length, 1)
  assert.equal(timeline.cues[0]?.emotion, 'happy')

  const firstSegmentEnd = buildMockSegments('Olá').at(-1)?.end ?? 0
  assert.ok((timeline.cues[0]?.at ?? 0) > firstSegmentEnd)
  assert.ok((timeline.events.at(-1)?.end ?? 0) > (timeline.cues[0]?.at ?? 0))

  for (const event of timeline.events) {
    assert.ok(!event.text.includes('EMO'), 'tags must never become viseme text')
  }
  for (let index = 1; index < timeline.events.length; index += 1) {
    const previous = timeline.events[index - 1]
    const current = timeline.events[index]
    if (!previous || !current) continue
    assert.ok(previous.start <= current.start, 'events must stay sorted')
  }
})

test('buildEmotionTimeline emits one cue per emotion segment', () => {
  const timeline = buildEmotionTimeline('[EMO:thinking] Hmm. [EMO:surprised] Ah! [EMO:neutral] Ok.')
  assert.deepEqual(
    timeline.cues.map((cue) => cue.emotion),
    ['thinking', 'surprised', 'neutral'],
  )
  assert.ok(timeline.events.length > 0)
})

test('buildEmotionTimeline ignores tag-only text', () => {
  const timeline = buildEmotionTimeline('  [EMO:happy]  ')
  assert.deepEqual(timeline.events, [])
  assert.deepEqual(timeline.cues, [])
})

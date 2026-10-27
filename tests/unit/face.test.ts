import assert from 'node:assert/strict'
import test from 'node:test'
import { FACE_PARTS, FACE_PART_ORIGINS, buildFaceSvg } from '../../src/face/index.ts'

const svg = buildFaceSvg()

test('face svg stays under 80 KB', () => {
  const bytes = Buffer.byteLength(svg, 'utf8')
  assert.ok(bytes < 80 * 1024, `face svg is ${bytes} bytes`)
})

test('all rig parts are present and unique', () => {
  for (const part of FACE_PARTS) {
    const matches = svg.match(new RegExp(`<g data-part="${part}">`, 'g')) ?? []
    assert.equal(matches.length, 1, `expected one ${part}, got ${matches.length}`)
  }
})

test('every rig part declares transform-box and a transform origin', () => {
  assert.ok(svg.includes('transform-box: fill-box'))
  for (const part of FACE_PARTS) {
    const origin = FACE_PART_ORIGINS[part]
    assert.ok(
      svg.includes(`[data-part="${part}"] { transform-origin: ${origin}; }`),
      `missing origin for ${part}`,
    )
  }
})

test('svg is self-contained and accessible', () => {
  assert.match(svg, /viewBox="0 0 1000 1200"/)
  assert.match(svg, /role="img"/)
  assert.match(svg, /<title>/)
  assert.match(
    svg,
    /aria-label="Rosto de homem com boné amarelo dos Lakers, óculos dourados, bigode e cavanhaque"/,
  )
  assert.doesNotMatch(svg, /<image\b/)
  assert.doesNotMatch(svg, /(?:href|src)="https?:/)
})

test('face has the required anatomical layers', () => {
  for (const required of [
    'eyelidUpperL',
    'eyelidUpperR',
    'eyelidLowerL',
    'eyelidLowerR',
    'irisL',
    'irisR',
    'pupilL',
    'pupilR',
    'nostrilL',
    'nostrilR',
    'mouthCavity',
    'teethUpper',
    'teethLower',
    'lipUpper',
    'lipLower',
    'tongue',
    'cap',
    'capBrim',
    'capLogo',
    'glasses',
    'lensL',
    'lensR',
    'beard',
    'mustache',
  ]) {
    assert.ok(svg.includes(`data-part="${required}"`), `missing ${required}`)
  }
})

test('right side is mirrored without wrapping animatable parts in scale(-1 1)', () => {
  assert.doesNotMatch(svg, /data-part="eyeR"[\s\S]{0,400}scale\(-1 1\)/)
  assert.match(svg, /data-part="eyeR"/)
})

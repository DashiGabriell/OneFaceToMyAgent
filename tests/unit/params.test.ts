import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_RIG_PARAMS,
  RIG_CHANNELS,
  RIG_CHANNEL_COUNT,
  RIG_CHANNEL_KEYS,
  clampChannel,
  clampParams,
  mergeParams,
  resolveParams,
} from '../../src/core/params.ts'

test('rig exposes the full 29-channel contract', () => {
  assert.equal(RIG_CHANNEL_COUNT, 29)
  assert.equal(RIG_CHANNEL_KEYS.length, 29)
  for (const channel of RIG_CHANNEL_KEYS) {
    const spec = RIG_CHANNELS[channel]
    assert.ok(spec.min < spec.max, `${channel} has an empty range`)
    assert.ok(
      spec.default >= spec.min && spec.default <= spec.max,
      `${channel} default is outside its range`,
    )
    assert.ok(spec.stiffness > 0, `${channel} needs positive stiffness`)
    assert.ok(spec.damping > 0, `${channel} needs positive damping`)
    assert.equal(DEFAULT_RIG_PARAMS[channel], spec.default)
  }
})

test('clampChannel keeps values inside the channel range', () => {
  assert.equal(clampChannel('headYaw', 99), 8)
  assert.equal(clampChannel('headYaw', -99), -8)
  assert.equal(clampChannel('jawOpen', 0.42), 0.42)
  assert.equal(clampChannel('jawOpen', Number.NaN), 0)
})

test('clampParams clamps every channel', () => {
  const clamped = clampParams({
    ...DEFAULT_RIG_PARAMS,
    headYaw: 100,
    headX: -100,
    jawOpen: -4,
  })
  assert.equal(clamped.headYaw, 8)
  assert.equal(clamped.headX, -20)
  assert.equal(clamped.jawOpen, 0)
  assert.equal(clamped.eyelidOpenL, 1)
})

test('mergeParams is additive and clamps each channel', () => {
  const base = { ...DEFAULT_RIG_PARAMS, jawOpen: 0.6, headYaw: 7 }
  const merged = mergeParams(base, { jawOpen: 0.7, headYaw: 7, browRaiseL: 0.5 })
  assert.equal(merged.jawOpen, 1)
  assert.equal(merged.headYaw, 8)
  assert.equal(merged.browRaiseL, 0.5)
  assert.equal(merged.eyelidOpenR, 1)
})

test('resolveParams replaces values while keeping the rest of the base', () => {
  const resolved = resolveParams({ eyelidOpenL: 0, jawOpen: 2 })
  assert.equal(resolved.eyelidOpenL, 0)
  assert.equal(resolved.eyelidOpenR, 1)
  assert.equal(resolved.jawOpen, 1)
  assert.equal(resolved.headYaw, 0)
})

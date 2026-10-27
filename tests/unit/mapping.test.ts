import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_RIG_PARAMS, RIG_CHANNELS, RIG_CHANNEL_KEYS } from '../../src/core/params.ts'
import { CHANNEL_TARGETS, computePartStyles } from '../../src/face/mapping.ts'
import { FACE_PARTS } from '../../src/face/parts.ts'

test('every channel maps to existing rig parts', () => {
  assert.deepEqual(Object.keys(CHANNEL_TARGETS).sort(), [...RIG_CHANNEL_KEYS].sort())
  for (const channel of RIG_CHANNEL_KEYS) {
    const targets = CHANNEL_TARGETS[channel]
    assert.ok(targets.length > 0, `${channel} has no target`)
    for (const part of targets) {
      assert.ok(FACE_PARTS.includes(part), `${channel} targets missing part ${part}`)
    }
  }
})

test('every channel changes at least one of its target transforms', () => {
  const neutral = computePartStyles(DEFAULT_RIG_PARAMS)
  for (const channel of RIG_CHANNEL_KEYS) {
    const spec = RIG_CHANNELS[channel]
    const value = spec.default === spec.max ? spec.min : spec.max
    const params = { ...DEFAULT_RIG_PARAMS }
    params[channel] = value
    const changed = computePartStyles(params)
    const moved = CHANNEL_TARGETS[channel].some(
      (part) => changed[part]?.transform !== neutral[part]?.transform,
    )
    assert.ok(moved, `${channel} did not move ${CHANNEL_TARGETS[channel].join(', ')}`)
  }
})

test('directional channels keep the same sign on mirrored irises', () => {
  const styles = computePartStyles({ ...DEFAULT_RIG_PARAMS, gazeX: 1, gazeY: 0.5 })
  assert.equal(styles.irisL?.transform, styles.irisR?.transform)
})

test('breath lifts the head and scales the neck', () => {
  const neutral = computePartStyles(DEFAULT_RIG_PARAMS)
  const breathing = computePartStyles({ ...DEFAULT_RIG_PARAMS, breath: 1 })
  assert.notEqual(breathing.head?.transform, neutral.head?.transform)
  assert.notEqual(breathing.neck?.transform, neutral.neck?.transform)
})

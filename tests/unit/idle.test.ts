import assert from 'node:assert/strict'
import test from 'node:test'
import { IdleSimulator, sumPartials } from '../../src/core/idle.ts'
import { createPrng, prngChance, prngRange } from '../../src/core/prng.ts'
import { ResidualLips } from '../../src/lipsync/residual.ts'

test('prng is deterministic for the same seed', () => {
  const left = createPrng(42)
  const right = createPrng(42)
  for (let index = 0; index < 20; index += 1) {
    assert.equal(left(), right())
  }
  assert.notEqual(createPrng(1)(), createPrng(2)())
  assert.ok(prngRange(createPrng(7), 2, 6) >= 2)
  assert.ok(prngRange(createPrng(7), 2, 6) <= 6)
  assert.equal(typeof prngChance(createPrng(9), 0.5), 'boolean')
})

test('idle blink closes eyelids within the configured range', () => {
  const idle = new IdleSimulator({ blinkRange: [0.5, 0.6], seed: 11, reducedMotion: true })
  let closed = false
  let time = 0
  for (let index = 0; index < 240; index += 1) {
    time += 1 / 60
    const delta = idle.update(1 / 60, { speaking: false, energy: 0 })
    const left = delta.eyelidOpenL ?? 0
    const right = delta.eyelidOpenR ?? 0
    if (left < -0.7 && right < -0.7) {
      closed = true
      assert.ok(time >= 0.4 && time <= 1.2, `blink at ${time}`)
      break
    }
  }
  assert.ok(closed, 'expected a blink cycle')
})

test('anticipateBlink schedules a near-term blink', () => {
  const idle = new IdleSimulator({ blinkRange: [8, 10], seed: 3, reducedMotion: true })
  idle.anticipateBlink()
  let closed = false
  for (let index = 0; index < 40; index += 1) {
    const delta = idle.update(1 / 60, { speaking: true, energy: 0.2 })
    if ((delta.eyelidOpenL ?? 0) < -0.7) {
      closed = true
      break
    }
  }
  assert.ok(closed)
})

test('reduced motion removes drift and prosody nods', () => {
  const motion = new IdleSimulator({ seed: 5, reducedMotion: false, headAccentRate: 1 })
  const reduced = new IdleSimulator({ seed: 5, reducedMotion: true, headAccentRate: 1 })

  let motionYaw = 0
  let reducedYaw = 0
  let motionBrow = 0
  let reducedBrow = 0

  for (let index = 0; index < 180; index += 1) {
    const moving = motion.update(1 / 60, { speaking: true, energy: 0.8 })
    const calm = reduced.update(1 / 60, { speaking: true, energy: 0.8 })
    motionYaw = Math.max(motionYaw, Math.abs(moving.headYaw ?? 0))
    reducedYaw = Math.max(reducedYaw, Math.abs(calm.headYaw ?? 0))
    motionBrow = Math.max(motionBrow, moving.browRaiseL ?? 0)
    reducedBrow = Math.max(reducedBrow, calm.browRaiseL ?? 0)
  }

  assert.ok(motionYaw > 0.3, `expected drift yaw, got ${motionYaw}`)
  assert.equal(reducedYaw, 0)
  assert.ok(motionBrow > 0.05, `expected prosody brow, got ${motionBrow}`)
  assert.equal(reducedBrow, 0)
})

test('idle keeps breath and forward gaze alive', () => {
  const idle = new IdleSimulator({ seed: 19, reducedMotion: false })
  let sawBreath = false
  let sawGaze = false
  for (let index = 0; index < 120; index += 1) {
    const delta = idle.update(1 / 60, { speaking: false })
    if ((delta.breath ?? 0) > 0.1) sawBreath = true
    if (Math.abs(delta.gazeX ?? 0) > 0.001 || Math.abs(delta.gazeY ?? 0) > 0.001) {
      sawGaze = true
    }
  }
  assert.ok(sawBreath)
  assert.ok(sawGaze)
})

test('sumPartials adds overlapping channels', () => {
  const sum = sumPartials({ headPitch: 0.5, breath: 0.2 }, { headPitch: -0.2, gazeX: 0.1 })
  assert.equal(sum.headPitch, 0.3)
  assert.equal(sum.breath, 0.2)
  assert.equal(sum.gazeX, 0.1)
})

test('residual lips keep tension between quiet samples', () => {
  const residual = new ResidualLips()
  residual.apply({ jawOpen: 0.7, lipPress: 0.4, mouthWidth: 0.2 }, 1 / 60)
  const between = residual.apply({ jawOpen: 0.03, lipPress: 0.12, mouthWidth: 0 }, 1 / 60)
  assert.ok((between.lipPress ?? 0) > 0.12)
  residual.reset()
  const reset = residual.apply({ jawOpen: 0.03, lipPress: 0.12 }, 1 / 60)
  assert.ok((reset.lipPress ?? 0) <= 0.16)
})

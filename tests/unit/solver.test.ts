import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_RIG_PARAMS, RIG_CHANNELS, RIG_CHANNEL_KEYS } from '../../src/core/params.ts'
import { SpringSolver } from '../../src/core/solver.ts'

function settle(solver: SpringSolver, seconds = 4): void {
  const steps = Math.ceil(seconds * 60)
  for (let index = 0; index < steps; index += 1) solver.update(1 / 60)
}

test('spring solver converges to the requested target', () => {
  const solver = new SpringSolver()
  solver.setTarget({ ...DEFAULT_RIG_PARAMS, jawOpen: 1, headYaw: 8 })
  settle(solver)
  const values = solver.values()
  assert.ok(values.jawOpen > 0.98, `jawOpen settled at ${values.jawOpen}`)
  assert.ok(values.headYaw > 7.8, `headYaw settled at ${values.headYaw}`)
})

test('every channel reaches its extreme and stays inside its range', () => {
  for (const channel of RIG_CHANNEL_KEYS) {
    const spec = RIG_CHANNELS[channel]
    const target = spec.default === spec.max ? spec.min : spec.max
    const solver = new SpringSolver()
    solver.setChannelTarget(channel, target)
    settle(solver)
    const value = solver.values()[channel]
    const tolerance = (spec.max - spec.min) * 0.02 + 0.001
    assert.ok(
      Math.abs(value - target) <= tolerance,
      `${channel} settled at ${value}, expected ${target}`,
    )
    assert.ok(value >= spec.min - 1e-9 && value <= spec.max + 1e-9)
  }
})

test('snap applies values immediately and clears velocity', () => {
  const solver = new SpringSolver()
  const target = { ...DEFAULT_RIG_PARAMS, headRoll: 3, jawOpen: 0.8 }
  solver.setTarget(target)
  solver.update(1 / 60)
  solver.snap(target)
  const values = solver.values()
  assert.equal(values.headRoll, 3)
  assert.equal(values.jawOpen, 0.8)
  solver.snap(DEFAULT_RIG_PARAMS)
  assert.equal(solver.values().headRoll, 0)
})

test('invalid deltas do not move the solver', () => {
  const solver = new SpringSolver()
  const before = solver.values()
  solver.update(0)
  solver.update(-1)
  solver.update(Number.NaN)
  assert.deepEqual(solver.values(), before)
})

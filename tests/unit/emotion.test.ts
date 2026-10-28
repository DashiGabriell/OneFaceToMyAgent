import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMOTIONS,
  EMOTION_FLASHES,
  EMOTION_LABELS,
  EMOTION_NAMES,
  mixEmotionShapes,
  scaleEmotionShape,
  sumEmotionShapes,
} from '../../src/core/emotion.ts'
import type { EmotionName, EmotionShape } from '../../src/core/emotion.ts'
import {
  EmotionMixer,
  FLASH_MAX_MS,
  FLASH_MIN_MS,
  MOOD_MAX_MS,
  MOOD_MIN_MS,
  REACTION_MAX_MS,
  REACTION_MIN_MS,
} from '../../src/core/emotion-mixer.ts'
import { DEFAULT_RIG_PARAMS, RIG_CHANNEL_KEYS, mergeParams } from '../../src/core/params.ts'
import { createEmotionController } from '../../src/avatar/emotion.ts'

const HAPPY_CORNER = EMOTIONS.happy.mouthCornerL
const SAD_CORNER = 0

function closeTo(actual: number | undefined, expected: number): void {
  assert.ok(
    Math.abs((actual ?? 0) - expected) < 1e-9,
    `expected ${expected}, received ${actual ?? 0}`,
  )
}

test('declares the five emotions with pt-BR labels and zeroed neutral', () => {
  assert.deepEqual([...EMOTION_NAMES], ['neutral', 'happy', 'sad', 'surprised', 'thinking'])
  assert.deepEqual(EMOTIONS.neutral, {})
  assert.deepEqual(EMOTION_FLASHES.neutral, {})

  for (const name of EMOTION_NAMES) {
    assert.ok(EMOTION_LABELS[name].length > 0, `${name} has no label`)
    const shape: EmotionShape = EMOTIONS[name]
    const flash: EmotionShape = EMOTION_FLASHES[name]
    for (const [channel, value] of Object.entries(shape)) {
      assert.ok(
        (RIG_CHANNEL_KEYS as readonly string[]).includes(channel),
        `${name} uses unknown channel ${channel}`,
      )
      assert.ok(Number.isFinite(value), `${name}.${channel} is not finite`)
    }
    for (const [channel, value] of Object.entries(flash)) {
      assert.ok(
        (RIG_CHANNEL_KEYS as readonly string[]).includes(channel),
        `flash ${name} uses unknown channel ${channel}`,
      )
      assert.ok(Number.isFinite(value), `flash ${name}.${channel} is not finite`)
    }
  }
})

test('emotions are visually distinct from each other', () => {
  const names = EMOTION_NAMES.filter((name) => name !== 'neutral')
  for (let index = 0; index < names.length; index += 1) {
    const left = names[index]
    const right = names[index + 1]
    if (!left || !right) continue
    assert.notDeepEqual(EMOTIONS[left], EMOTIONS[right])
  }
})

test('mixing a single preset keeps partial intensity below one', () => {
  const mixed = mixEmotionShapes([{ emotion: 'happy', weight: 0.5 }])
  closeTo(mixed.mouthCornerL, HAPPY_CORNER * 0.5)
  closeTo(mixed.cheekRaise, EMOTIONS.happy.cheekRaise * 0.5)
})

test('mixing multiple presets normalizes the weights', () => {
  const mixed = mixEmotionShapes([
    { emotion: 'happy', weight: 1 },
    { emotion: 'sad', weight: 1 },
  ])
  closeTo(mixed.mouthCornerL, (HAPPY_CORNER + SAD_CORNER) / 2)
  closeTo(mixed.cheekRaise, EMOTIONS.happy.cheekRaise / 2)
})

test('weights above one are normalized instead of amplified', () => {
  const normal = mixEmotionShapes([
    { emotion: 'happy', weight: 1 },
    { emotion: 'sad', weight: 1 },
  ])
  const heavy = mixEmotionShapes([
    { emotion: 'happy', weight: 4 },
    { emotion: 'sad', weight: 4 },
  ])
  closeTo(heavy.mouthCornerL, normal.mouthCornerL ?? 0)
})

test('empty or invalid weights produce no delta', () => {
  assert.deepEqual(mixEmotionShapes([]), {})
  assert.deepEqual(mixEmotionShapes([{ emotion: 'happy', weight: 0 }]), {})
  assert.deepEqual(mixEmotionShapes([{ emotion: 'happy', weight: Number.NaN }]), {})
})

test('sum and scale helpers compose additive deltas', () => {
  const scaled = scaleEmotionShape({ jawOpen: 0.4, browRaiseL: -0.2 }, 0.5)
  closeTo(scaled.jawOpen, 0.2)
  closeTo(scaled.browRaiseL, -0.1)
  assert.deepEqual(scaleEmotionShape({ jawOpen: 0.4 }, 0), {})

  const summed = sumEmotionShapes([{ jawOpen: 0.2 }, { jawOpen: 0.3, browRaiseL: 0.1 }])
  closeTo(summed.jawOpen, 0.5)
  closeTo(summed.browRaiseL, 0.1)
})

test('emotion delta composed over a viseme clamps every channel', () => {
  const loudA = mergeParams({ ...DEFAULT_RIG_PARAMS, jawOpen: 0.9, mouthWidth: 0.05 }, EMOTIONS.surprised)
  assert.equal(loudA.jawOpen, 1)
  const sadEyes = mergeParams(DEFAULT_RIG_PARAMS, EMOTIONS.sad)
  assert.ok(sadEyes.eyelidOpenL < 1 && sadEyes.eyelidOpenL > 0)
  closeTo(sadEyes.eyelidOpenR, 1 - 0.14)
})

test('mood transition starts at zero and settles in 300-600 ms', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('happy')
  assert.equal(mixer.hasActivity(), true)
  assert.deepEqual(mixer.update(0), {})

  const quarter = mixer.update(MOOD_MIN_MS / 3 / 1000)
  assert.ok((quarter.mouthCornerL ?? 0) > 0)
  assert.ok((quarter.mouthCornerL ?? 0) < HAPPY_CORNER)

  const settled = mixer.update(MOOD_MAX_MS / 1000)
  closeTo(settled.mouthCornerL, HAPPY_CORNER)
  assert.equal(mixer.getState().transition, 1)
})

test('mood weight scales the settled delta', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('happy', { weight: 0.5, flash: false })
  const settled = mixer.update(1)
  closeTo(settled.mouthCornerL, HAPPY_CORNER * 0.5)
})

test('mixing multiple presets through the mixer blends both moods', () => {
  const mixer = new EmotionMixer()
  mixer.setMoodMix(
    [
      { emotion: 'happy', weight: 1 },
      { emotion: 'sad', weight: 1 },
    ],
    { flash: false },
  )
  const settled = mixer.update(1)
  closeTo(settled.mouthCornerL, (HAPPY_CORNER + SAD_CORNER) / 2)
})

test('switching emotions mid-transition does not jump', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('happy', { flash: false })
  mixer.update(1)
  const before = mixer.update(0)

  mixer.setMood('sad', { flash: false })
  const after = mixer.update(0)
  closeTo(after.mouthCornerL, before.mouthCornerL ?? 0)
  closeTo(after.cheekRaise, before.cheekRaise ?? 0)

  const settled = mixer.update(1)
  closeTo(settled.mouthCornerL, SAD_CORNER)
})

test('flash peaks before the mood settles and expires within 80-150 ms', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('surprised')
  assert.ok(mixer.getState().flash, 'flash should start with the mood')
  assert.ok((mixer.getState().flash?.remainingMs ?? 0) <= FLASH_MAX_MS)

  const early = mixer.update(FLASH_MIN_MS / 2 / 1000)
  assert.ok((early.browRaiseL ?? 0) > 0)
  assert.ok(mixer.getState().flash, 'flash should still be active mid-pulse')

  mixer.update(FLASH_MAX_MS / 1000)
  assert.equal(mixer.getState().flash, null)
})

test('flash can be disabled when only the mood is wanted', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('happy', { flash: false })
  assert.equal(mixer.getState().flash, null)
})

test('reaction layer decays to zero inside its one-to-three second window', () => {
  const mixer = new EmotionMixer()
  mixer.trigger('surprised', { weight: 0.8, decayMs: 1000 })
  const initial = mixer.getState().reactions
  assert.equal(initial.length, 1)
  assert.ok((initial[0]?.remainingMs ?? 0) <= REACTION_MIN_MS)

  const pulsed = mixer.update(0.2)
  assert.ok((pulsed.jawOpen ?? 0) > 0)
  assert.equal(mixer.getState().reactions.length, 1)

  mixer.update(1)
  assert.equal(mixer.getState().reactions.length, 0)
  assert.deepEqual(mixer.update(0), {})
})

test('reaction decay is clamped between one and three seconds', () => {
  const mixer = new EmotionMixer()
  mixer.trigger('happy', { decayMs: 10 })
  assert.ok((mixer.getState().reactions[0]?.remainingMs ?? 0) <= REACTION_MIN_MS)

  mixer.reset()
  mixer.trigger('happy', { decayMs: 99_999 })
  assert.ok((mixer.getState().reactions[0]?.remainingMs ?? 0) <= REACTION_MAX_MS)
})

test('neutral clears the mood after the transition', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('thinking', { flash: false })
  mixer.update(1)
  mixer.setMood('neutral')
  assert.equal(mixer.getState().flash, null)
  mixer.update(1)
  assert.deepEqual(mixer.getState().mood, [])
  assert.equal(mixer.hasActivity(), false)
})

test('reset clears mood, flash and reactions instantly', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('thinking')
  mixer.trigger('happy')
  mixer.update(0.05)
  assert.equal(mixer.hasActivity(), true)

  mixer.reset()
  assert.equal(mixer.hasActivity(), false)
  const state = mixer.getState()
  assert.deepEqual(state.mood, [])
  assert.deepEqual(state.reactions, [])
  assert.equal(state.flash, null)
  assert.deepEqual(mixer.update(0), {})
})

test('state exposes mood targets, layers and TTL for the debug panel', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('happy')
  mixer.trigger('sad', { decayMs: 2000 })
  mixer.update(0.05)
  const state = mixer.getState()
  assert.equal(state.mood[0]?.emotion, 'happy')
  assert.equal(state.mood[0]?.target, 1)
  assert.equal(state.reactions[0]?.emotion, 'sad')
  assert.ok((state.reactions[0]?.remainingMs ?? 0) > 1900)
  assert.ok(state.delta.mouthCornerL !== undefined)
  assert.equal(typeof state.transition, 'number')
})

test('invalid emotion names are ignored by the mixer', () => {
  const mixer = new EmotionMixer()
  mixer.setMood('angry' as EmotionName)
  assert.equal(mixer.hasActivity(), false)
  assert.deepEqual(mixer.getState().mood, [])
})

test('controller routes setEmotion between the mood and reaction layers', () => {
  const mixer = new EmotionMixer()
  const controller = createEmotionController(mixer)

  controller.setEmotion('happy', { weight: 0.8, flash: false })
  mixer.update(1)
  assert.equal(mixer.getState().mood[0]?.emotion, 'happy')
  closeTo(mixer.getState().mood[0]?.weight, 0.8)

  controller.setEmotion('sad', { layer: 'reaction', weight: 0.5, decayMs: 1500 })
  const state = mixer.getState()
  assert.equal(state.reactions[0]?.emotion, 'sad')
  assert.ok((state.reactions[0]?.remainingMs ?? 0) <= 1500)

  controller.clearEmotion()
  mixer.update(1)
  assert.deepEqual(mixer.getState().mood, [])

  controller.setEmotion('thinking')
  controller.reset()
  assert.equal(mixer.hasActivity(), false)
})

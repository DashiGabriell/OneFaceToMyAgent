export type Prng = () => number

export function createPrng(seed = 1): Prng {
  let state = seed >>> 0 || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function prngRange(random: Prng, min: number, max: number): number {
  return min + (max - min) * random()
}

export function prngChance(random: Prng, probability: number): boolean {
  return random() < probability
}

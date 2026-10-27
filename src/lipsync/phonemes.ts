import type { VisemeName } from './visemes.ts'

export interface SpokenUnit {
  readonly text: string
  readonly viseme: VisemeName
  readonly weight: number
}

const WEIGHTS: Record<VisemeName, number> = {
  rest: 0.4,
  mbp: 0.55,
  fv: 0.55,
  l: 0.65,
  a: 1,
  e: 0.95,
  i: 0.9,
  o: 1,
  u: 0.9,
  nasal: 1.35,
  sibilant: 1.15,
  dtn: 0.55,
}

const VOWELS: Record<string, VisemeName> = {
  a: 'a',
  e: 'e',
  i: 'i',
  o: 'o',
  u: 'u',
}

const EXCEPTIONS: Record<string, readonly VisemeName[]> = {
  que: ['dtn', 'i'],
  quem: ['dtn', 'nasal'],
  de: ['dtn', 'i'],
  do: ['dtn', 'o'],
  da: ['dtn', 'a'],
  um: ['nasal'],
  uma: ['u', 'mbp', 'a'],
  nao: ['dtn', 'nasal'],
  eu: ['e', 'u'],
}

export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '')
}

function baseChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function unit(text: string, viseme: VisemeName, weight = WEIGHTS[viseme]): SpokenUnit {
  return { text, viseme, weight }
}

function exceptionUnits(visemes: readonly VisemeName[], word: string): SpokenUnit[] {
  return visemes.map((viseme, index) => unit(`${word}:${index}`, viseme))
}

export function wordToUnits(word: string): SpokenUnit[] {
  const lower = word.toLowerCase().replace(/[^\p{L}]/gu, '')
  const chars = Array.from(lower)
  if (chars.length === 0) return []

  const exception = EXCEPTIONS[normalizeWord(word)]
  if (exception) return exceptionUnits(exception, normalizeWord(word))

  const units: SpokenUnit[] = []
  let index = 0

  while (index < chars.length) {
    const char = chars[index]
    if (!char) break

    const next = chars[index + 1] ?? ''
    const nextBase = baseChar(next)
    const pair = char + next

    if (index === chars.length - 2 && ['em', 'am', 'om', 'um', 'en', 'an', 'on', 'un'].includes(pair)) {
      units.push(unit(pair, 'nasal'))
      index += 2
      continue
    }

    if (pair === 'ão' || pair === 'ãe' || pair === 'õe') {
      units.push(unit(pair, 'nasal'))
      index += 2
      continue
    }

    if (pair === 'ch' || pair === 'ss') {
      units.push(unit(pair, 'sibilant'))
      index += 2
      continue
    }

    if (pair === 'lh') {
      units.push(unit(pair, 'l'))
      index += 2
      continue
    }

    if (pair === 'nh') {
      units.push(unit(pair, 'nasal'))
      index += 2
      continue
    }

    if (pair === 'rr') {
      units.push(unit(pair, 'dtn'))
      index += 2
      continue
    }

    if (pair === 'qu' || pair === 'gu') {
      const third = baseChar(chars[index + 2] ?? '')
      if (third === 'e' || third === 'i') {
        units.push(unit(pair, 'dtn'))
        index += 2
        continue
      }
    }

    const base = baseChar(char)

    if (char === 'ç') {
      units.push(unit(char, 'sibilant'))
      index += 1
      continue
    }

    if (base === 'c' || base === 'g') {
      units.push(unit(char, nextBase === 'e' || nextBase === 'i' ? 'sibilant' : 'dtn'))
      index += 1
      continue
    }

    if (base === 'm' || base === 'n') {
      const atEnd = index === chars.length - 1
      const beforeConsonant = next !== '' && !(nextBase in VOWELS)
      units.push(unit(char, atEnd || beforeConsonant ? 'nasal' : base === 'm' ? 'mbp' : 'dtn'))
      index += 1
      continue
    }

    if (base === 'p' || base === 'b') {
      units.push(unit(char, 'mbp'))
      index += 1
      continue
    }

    if (base === 'f' || base === 'v') {
      units.push(unit(char, 'fv'))
      index += 1
      continue
    }

    if (base === 'l') {
      units.push(unit(char, 'l'))
      index += 1
      continue
    }

    if (base === 't' || base === 'd' || base === 'k' || base === 'q' || base === 'r') {
      units.push(unit(char, 'dtn'))
      index += 1
      continue
    }

    if (base === 's' || base === 'z' || base === 'x' || base === 'j') {
      units.push(unit(char, 'sibilant'))
      index += 1
      continue
    }

    if (char === 'ã' || char === 'õ') {
      units.push(unit(char, 'nasal'))
      index += 1
      continue
    }

    if (base === 'w') {
      units.push(unit(char, 'u'))
      index += 1
      continue
    }

    if (base === 'y') {
      units.push(unit(char, 'i'))
      index += 1
      continue
    }

    if (base in VOWELS) {
      units.push(unit(char, VOWELS[base] ?? 'a'))
      index += 1
      continue
    }

    index += 1
  }

  return units
}

export function wordToVisemes(word: string): VisemeName[] {
  return wordToUnits(word).map((item) => item.viseme)
}

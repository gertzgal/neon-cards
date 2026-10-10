import type { Rng } from './types'

const STATE = /^[0-9a-f]{32}$/

// cyrb128: spreads a string seed over sfc32's four 32-bit words.
function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

function sfc32(words: [number, number, number, number]): Rng {
  let [a, b, c, d] = words
  const nextU32 = () => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return t >>> 0
  }
  const next = () => nextU32() / 4294967296
  return {
    next,
    int(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 4294967296) {
        throw new RangeError(`int() needs an integer in 1..2^32, got ${maxExclusive}`)
      }
      return Math.floor(next() * maxExclusive)
    },
    state: () => [a, b, c, d].map((w) => (w >>> 0).toString(16).padStart(8, '0')).join(''),
  }
}

export function createRng(seed: string): Rng {
  const rng = sfc32(hashSeed(seed))
  for (let i = 0; i < 15; i++) rng.next()
  return rng
}

export function restoreRng(state: string): Rng {
  if (!STATE.test(state)) throw new Error(`Not an Rng state: "${state}"`)
  const words = [0, 8, 16, 24].map((i) => parseInt(state.slice(i, i + 8), 16))
  return sfc32(words as [number, number, number, number])
}

/** The CPU stream for the action at log index `seq`, independent of the deck stream. */
export function cpuRng(seed: string, seq: number): Rng {
  return createRng(`${seed}:cpu:${seq}`)
}

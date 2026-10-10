import { describe, expect, it } from 'vitest'
import { cpuRng, createRng, restoreRng } from './rng'

const draw = (rng: ReturnType<typeof createRng>, n: number) => Array.from({ length: n }, () => rng.int(1000))

describe('createRng', () => {
  it('produces a fixed sequence for a seed', () => {
    const rng = createRng('neon')
    expect([rng.next(), rng.next(), rng.int(6), rng.int(100)]).toEqual([0.9675776979420334, 0.23675696039572358, 1, 15])
    expect(rng.state()).toBe('bcdb6f8d7b847bb8a6dceb9b296fbd40')
  })

  it('gives different seeds different streams', () => {
    expect(draw(createRng('a'), 8)).not.toEqual(draw(createRng('b'), 8))
    expect(createRng('').int(1000)).toBe(563)
  })

  it('stays in range and covers every value', () => {
    const rng = createRng('range')
    const counts = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 6000; i++) {
      const k = rng.int(6)
      counts[k] = (counts[k] ?? 0) + 1
    }
    for (const c of counts) expect(c).toBeGreaterThan(850)
    for (let i = 0; i < 1000; i++) {
      const x = rng.next()
      expect(x >= 0 && x < 1).toBe(true)
    }
  })

  it('rejects a bad bound', () => {
    const rng = createRng('neon')
    expect(() => rng.int(0)).toThrow(RangeError)
    expect(() => rng.int(2.5)).toThrow(RangeError)
  })
})

describe('restoreRng', () => {
  it('continues exactly where the saved stream left off', () => {
    const rng = createRng('neon')
    draw(rng, 5)
    const restored = restoreRng(rng.state())
    expect(draw(restored, 20)).toEqual(draw(rng, 20))
  })

  it('round-trips the initial state', () => {
    expect(restoreRng(createRng('neon').state()).state()).toBe('a004303f2e3f3e8efd00787c296fbd3c')
  })

  it('rejects anything that is not a state string', () => {
    expect(() => restoreRng('neon')).toThrow('Not an Rng state: "neon"')
  })
})

describe('cpuRng', () => {
  it('is fixed per seed and seq and independent of the deck stream', () => {
    expect(cpuRng('neon', 3).int(1000)).toBe(706)
    expect(draw(cpuRng('neon', 3), 4)).not.toEqual(draw(cpuRng('neon', 4), 4))
    expect(draw(cpuRng('neon', 0), 4)).not.toEqual(draw(createRng('neon'), 4))
  })
})

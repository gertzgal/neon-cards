import { describe, expect, it } from 'vitest'
import { burstFlight, wideEnds, type Rect } from './juice'

/** A tiny deterministic stand-in for Math.random. */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const phoneHand: Rect = { left: 70, top: 430, right: 320, bottom: 680 }
const desktopHand: Rect = { left: 560, top: 430, right: 880, bottom: 720 }

const covers = (x: number, y: number, rect: Rect) => x + 31 > rect.left && x - 31 < rect.right && y + 23 > rect.top && y - 23 < rect.bottom

describe('blackjack burst', () => {
  it.each([
    ['phone', 195, 340, 120, 390, phoneHand],
    ['desktop', 720, 400, 160, 1440, desktopHand],
  ] as const)('stays under the dealer and off the player cards on %s', (_name, x, y, ceiling, width, hand) => {
    const rand = rng(7)
    const peaks: number[] = []
    for (let i = 0; i < 48; i++) {
      const { start, peak, end } = burstFlight({ x, y }, ceiling, width, hand, rand)
      for (const p of [start, peak, end]) {
        expect(p.y).toBeGreaterThanOrEqual(ceiling + 23)
        expect(covers(p.x, p.y, hand)).toBe(false)
      }
      peaks.push(peak.x)
    }
    const spread = Math.max(...peaks) - Math.min(...peaks)
    expect(spread).toBeGreaterThan(width * 0.5)
  })

  it.each([
    ['phone', 195, 340, 120, 390, phoneHand],
    ['desktop', 720, 400, 160, 1440, desktopHand],
  ] as const)('sends the first two chips to opposite sides on %s', (_name, x, y, ceiling, width, hand) => {
    const [left, right] = wideEnds({ x, y }, ceiling, width, hand)
    expect(right.peak.x - left.peak.x).toBeGreaterThan(width * 0.5)
    for (const p of [left.start, left.peak, left.end, right.start, right.peak, right.end]) {
      expect(p.y).toBeGreaterThanOrEqual(ceiling + 23)
      expect(covers(p.x, p.y, hand)).toBe(false)
    }
  })
})

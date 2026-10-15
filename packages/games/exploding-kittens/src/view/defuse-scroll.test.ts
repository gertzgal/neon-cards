import { describe, expect, it } from 'vitest'
import { scrollToCard } from './defuse-scroll'

describe('scrollToCard', () => {
  it('leaves a card that is already on screen', () => {
    expect(scrollToCard(10, 150, 400, 0)).toBe(0)
  })

  it('brings a card past the right edge into the phone strip', () => {
    const next = scrollToCard(768, 150, 190, 0)
    expect(next).toBe(756)
    expect(next).toBeLessThanOrEqual(768)
    expect(next + 190).toBeGreaterThanOrEqual(768 + 150)
  })

  it('scrolls back when the card is off the left', () => {
    expect(scrollToCard(10, 150, 200, 500)).toBe(0)
  })

  it('aligns the left edge when the card is wider than the strip', () => {
    expect(scrollToCard(400, 220, 180, 0)).toBe(400)
  })
})

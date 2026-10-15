import { describe, expect, it } from 'vitest'
import { layoutHand, measure } from './layout'

describe('player hand', () => {
  it('keeps the full-size fan for up to three cards on a 390 phone', () => {
    const size = measure(390, 844)
    for (let n = 1; n <= 3; n++) expect(layoutHand(size, 'player', n, false).w).toBeCloseTo(size.pw)
  })

  it('shrinks a long phone hand so every covered card shows at least 30% of itself', () => {
    const size = measure(390, 844)
    for (let n = 4; n <= 6; n++) {
      const lay = layoutHand(size, 'player', n, false)
      expect(lay.w).toBeLessThan(size.pw)
      expect(lay.w).toBeGreaterThanOrEqual(size.pw * 0.6)
      expect((lay.slots[1]?.x ?? 0) / lay.w).toBeGreaterThanOrEqual(0.3)
      expect(lay.width).toBeLessThanOrEqual(390 * 0.64 + 0.001)
    }
  })

  it('never fans a hand wider than 10 degrees each way', () => {
    const size = measure(390, 844)
    for (let n = 2; n <= 8; n++) {
      const rots = layoutHand(size, 'player', n, false).slots.map((s) => Math.abs(s.rot))
      expect(Math.max(...rots)).toBeLessThanOrEqual(10)
    }
  })

  it('leaves desktop hands of up to six cards full size', () => {
    const size = measure(1440, 900)
    for (let n = 1; n <= 6; n++) expect(layoutHand(size, 'player', n, false).w).toBeCloseTo(size.pw)
  })

  it('caps desktop cards so a 1440x900 table keeps a band for the stake', () => {
    const size = measure(1440, 900)
    expect(size.ph).toBeLessThanOrEqual(210)
    expect(size.ph).toBeGreaterThan(170)
    // Hud 84 + felt 142 + dealer row (about 1.36× dh) + player hand, from table.css.
    const dealerRow = 4 + size.dh * 1.36
    const band = 900 - 84 - 142 - dealerRow - size.ph
    expect(band).toBeGreaterThan(150)
  })
})

describe('dealer row', () => {
  const rowWidth = (width: number, height: number, count: number) => {
    const size = measure(width, height)
    const badge = size.dh * 0.26 * 2.4
    return layoutHand(size, 'dealer', count, false).width + size.dw * 0.44 + 2 * (badge + 16)
  }

  it.each([
    [360, 740],
    [390, 844],
    [430, 932],
    [699, 900],
    [1440, 900],
  ])('fits a %ix%i screen with 2 to 8 dealer cards', (width, height) => {
    for (let n = 2; n <= 8; n++) expect(rowWidth(width, height, n)).toBeLessThanOrEqual(width)
  })

  it('keeps the two-card tray on a 390 phone however many cards the dealer draws', () => {
    const size = measure(390, 844)
    const two = layoutHand(size, 'dealer', 2, false).width
    expect(two).toBeCloseTo(size.dw * 2 + 8)
    for (let n = 3; n <= 8; n++) expect(layoutHand(size, 'dealer', n, false).width).toBeCloseTo(two)
  })

  it('lets a long desktop dealer hand grow until the 700px cap', () => {
    const size = measure(1440, 900)
    const five = layoutHand(size, 'dealer', 5, false)
    expect(five.width).toBeCloseTo(size.dw + 4 * (size.dw + 8))
    const seven = layoutHand(size, 'dealer', 7, false)
    expect(seven.width).toBeGreaterThan(five.width)
    expect(seven.width).toBeLessThanOrEqual(700)
    expect(seven.width).toBeGreaterThan(layoutHand(measure(390, 844), 'dealer', 7, false).width)
  })
})

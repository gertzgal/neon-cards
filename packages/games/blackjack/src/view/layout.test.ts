import { describe, expect, it } from 'vitest'
import { layoutHand, measure } from './layout'

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

  it('leaves the desktop dealer hand as wide as before', () => {
    const size = measure(1440, 900)
    expect(layoutHand(size, 'dealer', 5, false).width).toBeCloseTo(size.dw + 4 * (size.dw + 8))
    expect(layoutHand(size, 'dealer', 7, false).width).toBeCloseTo(700)
  })
})

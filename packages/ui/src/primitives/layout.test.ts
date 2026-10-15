import { describe, expect, it } from 'vitest'
import { chipsFor, formatMoney } from './chips'
import { fittedRow, handLayout, straightRow } from './hand'
import { tableMetrics } from './metrics'
import { bitmapRects } from './pixel'

describe('tableMetrics', () => {
  it('sizes the phone composition at 390x844', () => {
    expect(tableMetrics(390, 844)).toEqual({
      width: 390,
      height: 844,
      phone: true,
      card: { hand: { w: 150, h: 203 }, tray: { w: 83, h: 112 }, compact: { w: 42, h: 57 } },
      feltHeight: 178,
    })
  })

  it('sizes the desktop composition at 1440x900', () => {
    expect(tableMetrics(1440, 900)).toEqual({
      width: 1440,
      height: 900,
      phone: false,
      card: { hand: { w: 180, h: 243 }, tray: { w: 111, h: 151 }, compact: { w: 71, h: 96 } },
      feltHeight: 142,
    })
  })
})

describe('handLayout', () => {
  const card = { w: 150, h: 203 }

  it('fans two cards at full size, rotated outward and dipped at the ends', () => {
    const { width, card: fitted, slots } = handLayout(2, card, 'fan', 270, 'hand')
    expect(fitted).toEqual(card)
    expect(width).toBe(270)
    expect(slots.map((s) => s.x)).toEqual([0, 120])
    expect(slots.map((s) => s.rotate)).toEqual([-4, 4])
    expect(slots[0]?.y).toBeCloseTo(3.045)
  })

  it('shrinks cards in a long hand instead of hiding them', () => {
    const { width, card: fitted, slots } = handLayout(4, card, 'fan', 270, 'hand')
    expect(fitted).toEqual({ w: 115, h: 155 })
    expect(width).toBeCloseTo(270)
    expect(slots[1]?.x).toBeCloseTo(51.667)
    expect(slots.map((s) => s.rotate)).toEqual([-7.5, -2.5, 2.5, 7.5])
  })

  it('never shrinks compact seat cards and overlaps them in a flat row', () => {
    const { width, card: fitted, slots } = handLayout(3, { w: 42, h: 57 }, 'row', 156, 'compact')
    expect(fitted).toEqual({ w: 42, h: 57 })
    expect(width).toBeCloseTo(90.72)
    expect(slots.every((s) => s.rotate === 0 && s.y === 0)).toBe(true)
  })

  it('lays out nothing for an empty hand', () => {
    expect(handLayout(0, card, 'fan', 270, 'hand')).toEqual({ width: 0, card, slots: [] })
  })
})

describe('straightRow', () => {
  const card = { w: 150, h: 203 }

  it('keeps a gap and no rotation when the row fits', () => {
    const row = straightRow(2, card, 400)
    expect(row.card).toEqual(card)
    expect(row.slots.map((slot) => slot.rotate)).toEqual([0, 0])
    expect(row.slots.map((slot) => slot.y)).toEqual([0, 0])
    expect(row.slots[1]?.x).toBe(158)
    expect(row.scrolls).toBe(false)
  })

  it('overlaps slightly, then scrolls once the row is still too wide', () => {
    const phone = straightRow(8, card, 262)
    expect(phone.slots.every((slot) => slot.rotate === 0 && slot.y === 0)).toBe(true)
    expect(phone.slots[1]?.x).toBeCloseTo(108)
    expect(phone.width).toBeGreaterThan(262)
    expect(phone.scrolls).toBe(true)
  })
})

describe('fittedRow', () => {
  const phone = { w: 150, h: 203 }
  const desktop = { w: 180, h: 243 }

  it('opens one card smaller than the shared hand, flat and unrotated', () => {
    const row = fittedRow(1, phone, 268, 0.8)
    expect(row.card).toEqual({ w: 120, h: 162 })
    expect(row.width).toBe(120)
    expect(row.slots).toEqual([{ x: 0, y: 0, rotate: 0 }])
  })

  it('keeps a gap when the row fits', () => {
    const row = fittedRow(2, phone, 400, 0.8)
    expect(row.card.w).toBe(120)
    expect(row.slots[1]?.x).toBe(126)
    expect(row.width).toBe(246)
    expect(row.slots.every((slot) => slot.rotate === 0 && slot.y === 0)).toBe(true)
  })

  it('scales seven phone cards into the badge room without overlap or scroll', () => {
    const room = 262
    const row = fittedRow(7, phone, room, 0.8)
    expect(row.width).toBeLessThanOrEqual(room + 0.01)
    expect(row.card.w).toBeGreaterThanOrEqual(30)
    expect(row.card.w).toBeLessThan(120)
    expect(row.slots.every((slot) => slot.rotate === 0 && slot.y === 0)).toBe(true)
    expect(Math.max(...row.slots.map((slot) => slot.x + row.card.w))).toBeLessThanOrEqual(room + 0.01)
    for (let i = 1; i < row.slots.length; i++) {
      const slot = row.slots[i]
      const prev = row.slots[i - 1]
      expect(slot?.x ?? 0).toBeGreaterThanOrEqual((prev?.x ?? 0) + row.card.w - 0.01)
    }
  })

  it('keeps seven desktop cards at the opening size when they fit beside the badge', () => {
    const row = fittedRow(7, desktop, 1268, 0.8)
    expect(row.card).toEqual({ w: 144, h: 194 })
    expect(row.width).toBe(144 * 7 + 6 * 6)
  })
})

describe('chips', () => {
  it('splits an amount into the fewest chips, largest first', () => {
    expect(chipsFor(680)).toEqual([500, 100, 25, 25, 25, 5])
  })

  it('formats money with a sign and thousands separators', () => {
    expect(formatMoney(1250)).toBe('$1,250')
    expect(formatMoney(-75)).toBe('-$75')
  })
})

describe('bitmapRects', () => {
  it('merges each run of lit pixels into one rect', () => {
    expect(bitmapRects(['X..X..X', 'XXXXXXX'])).toEqual([
      { x: 0, y: 0, w: 1 },
      { x: 3, y: 0, w: 1 },
      { x: 6, y: 0, w: 1 },
      { x: 0, y: 1, w: 7 },
    ])
  })
})

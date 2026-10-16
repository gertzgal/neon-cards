import { describe, expect, it } from 'vitest'
import { chipsFor, formatMoney } from './chips'
import { handLayout, straightRow } from './hand'
import { fitTable, tableMetrics } from './metrics'
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

describe('fitTable', () => {
  it('keeps the solo phone sizes when two opponents fit', () => {
    const base = tableMetrics(390, 844)
    expect(fitTable(base, { opponents: 2, hudHeight: 58 })).toEqual(base)
  })

  it('shrinks a four-seat room on a short phone', () => {
    const base = tableMetrics(360, 640)
    const fitted = fitTable(base, { opponents: 3, hudHeight: 102 })
    expect(fitted.card.hand.h).toBeLessThan(base.card.hand.h)
    expect(fitted.card.hand.h).toBeGreaterThanOrEqual(Math.round(base.card.hand.h * 0.6))
    expect(fitted.card.compact.h).toBeLessThan(base.card.compact.h)
  })

  it('keeps the solo phone hand on a 390 room and the solo pile on a short room', () => {
    const phone = tableMetrics(390, 844)
    expect(fitTable(phone, { opponents: 3, hudHeight: 102, room: true }).card).toEqual(phone.card)
    const short = tableMetrics(360, 640)
    const fitted = fitTable(short, { opponents: 3, hudHeight: 102, room: true })
    expect(fitted.card.compact).toEqual(short.card.compact)
    expect(fitted.card.hand).toEqual({ w: 55, h: 75 })
    expect(fitted.feltHeight).toBe(132)
  })

  it('draws a desktop room hand at 70 percent of the solo hand', () => {
    const base = tableMetrics(1440, 900)
    const fitted = fitTable(base, { opponents: 3, hudHeight: 120, room: true })
    expect(fitted.card.hand).toEqual({ w: 126, h: 170 })
    expect(fitted.card.compact).toEqual(base.card.compact)
    expect(fitted.card.tray).toEqual(base.card.tray)
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

  it('shrinks a long strip until the row fits', () => {
    const row = straightRow(6, card, 282, true)
    expect(row.card.w).toBeLessThan(card.w)
    expect(row.width).toBeLessThanOrEqual(282.5)
    expect(row.scrolls).toBe(false)
  })

  it('sits four phone cards side by side with the solo gap', () => {
    const row = straightRow(4, card, 282, true)
    expect(row.card.w).toBe(64)
    expect(row.slots[1]?.x).toBe(row.card.w + 8)
    expect(row.width).toBeLessThanOrEqual(282.5)
    expect(row.scrolls).toBe(false)
  })

  it('uses a 12px gap for a desktop room strip', () => {
    const row = straightRow(4, { w: 126, h: 170 }, 1360, true, 12)
    expect(row.card).toEqual({ w: 126, h: 170 })
    expect(row.slots[1]?.x).toBe(138)
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

import { describe, expect, it } from 'vitest'
import { drawPile, seat, FULL_DECK, flipWithin, hitValue, KIND_KEYS, lineState, pBust, pileSize, visiblePile } from './counting'
import { makeView } from './view-fixtures'

const at = (key: string) => KIND_KEYS.indexOf(key as (typeof KIND_KEYS)[number])

describe('flip 7 card counting', () => {
  it('knows the 94-card deck by kind', () => {
    expect(pileSize([...FULL_DECK])).toBe(94)
    expect([FULL_DECK[at('0')], FULL_DECK[at('1')], FULL_DECK[at('12')], FULL_DECK[at('x2')], FULL_DECK[at('S')]]).toEqual([1, 1, 12, 1, 3])
  })

  it('subtracts the table, the discard, and limbo to get the exact draw pile', () => {
    const view = makeView({
      seats: { you: { cards: ['12', '+4'] }, 'cpu-1': { cards: ['5', 'S'] } },
      discard: ['12', '12', 'F'],
      pending: { kind: 'target', card: 'T' },
    })
    const d = drawPile(view)
    expect(pileSize(d)).toBe(view.drawCount)
    expect(pileSize(d)).toBe(86)
    expect([d[at('12')], d[at('5')], d[at('+4')], d[at('S')], d[at('F')], d[at('T')]]).toEqual([9, 4, 0, 2, 2, 2])
    expect(visiblePile(view)[at('12')]).toBe(11)
  })

  it('uses the discard pile as the draw pile when the draw pile is empty', () => {
    const view = makeView({ seats: { you: { cards: ['3'] }, 'cpu-1': { cards: ['4'] } }, discard: ['4', '4', 'x2'], drawCount: 0 })
    const d = drawPile(view)
    expect(pileSize(d)).toBe(3)
    expect(pBust(lineState(seat(view, 'cpu-1').line), d)).toBeCloseTo(2 / 3)
  })

  it('computes next-draw bust odds, and zero with a Second Chance', () => {
    const view = makeView({ seats: { you: {}, 'cpu-1': { cards: ['5', '12'] } } })
    const d = drawPile(view)
    expect(pBust(lineState(seat(view, 'cpu-1').line), d)).toBeCloseTo((4 + 11) / 92)
    const sc = makeView({ seats: { you: {}, 'cpu-1': { cards: ['5', '12', 'S'] } } })
    expect(pBust(lineState(seat(sc, 'cpu-1').line), drawPile(sc))).toBe(0)
  })

  it('enumerates a Flip Three: bust and Flip 7 odds within three draws', () => {
    const empty = makeView({ seats: { you: {}, 'cpu-1': {} } })
    const none = flipWithin(3, lineState(seat(empty, 'cpu-1').line), drawPile(empty))
    expect(none.flip7).toBe(0)
    expect(none.bust).toBeGreaterThan(0.05)
    expect(none.bust).toBeLessThan(0.2)

    const six = makeView({ seats: { you: {}, 'cpu-1': { cards: ['0', '1', '2', '3', '4', '5'] } } })
    const out = flipWithin(3, lineState(seat(six, 'cpu-1').line), drawPile(six))
    expect(out.flip7).toBeGreaterThan(0.8)
    expect(out.bust).toBeLessThan(0.15)
    expect(out.bust + out.flip7).toBeLessThanOrEqual(1)
  })

  it('values hitting above staying on a small line and below it on a big one', () => {
    const small = makeView({ seats: { you: {}, 'cpu-1': { cards: ['1'] } } })
    expect(hitValue(lineState(seat(small, 'cpu-1').line), drawPile(small), 3)).toBeGreaterThan(1)
    const big = makeView({ seats: { you: {}, 'cpu-1': { cards: ['12', '11', '10', '9'] } } })
    expect(hitValue(lineState(seat(big, 'cpu-1').line), drawPile(big), 3)).toBeLessThan(42)
  })
})

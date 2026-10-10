import { describe, expect, it } from 'vitest'
import { handValue, isNatural, parseFace, standard52 } from './cards'
import { rigFaces } from './rigs'

const hand = (...codes: string[]) => codes.map(parseFace)

describe('handValue', () => {
  it.each([
    [['AH', 'KS'], 21, true],
    [['AH', 'AS'], 12, true],
    [['AH', 'AS', '9C'], 21, true],
    [['AH', '6S', '10C'], 17, false],
    [['AH', '6S'], 17, true],
    [['10H', '6S', 'KC'], 26, false],
    [['AH', 'AS', 'AC', 'AD'], 14, true],
    [['AH', 'AS', 'AC', 'AD', '7H', '10S'], 21, false],
    [['5H', '6S'], 11, false],
    [['JH', 'QS'], 20, false],
  ])('%j totals %i (soft %s)', (codes, total, soft) => {
    expect(handValue(hand(...codes))).toEqual({ total, soft })
  })
})

describe('isNatural', () => {
  it('is true only for two cards totalling 21', () => {
    expect(isNatural(hand('AH', 'QS'))).toBe(true)
    expect(isNatural(hand('10H', 'AS'))).toBe(true)
    expect(isNatural(hand('7H', '7S', '7C'))).toBe(false)
    expect(isNatural(hand('AH', '9S'))).toBe(false)
  })
})

describe('standard52', () => {
  it('builds 52 unique faces, 13 per suit', () => {
    const faces = standard52.build()
    expect(faces).toHaveLength(52)
    expect(new Set(faces.map((f) => f.rank + f.suit)).size).toBe(52)
    expect(faces.filter((f) => f.suit === 'S').map((f) => f.rank)).toEqual([
      'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
    ])
  })
})

describe('rigFaces', () => {
  it('resolves a named rig and a literal card list', () => {
    expect(rigFaces('blackjack')).toEqual([
      { rank: 'A', suit: 'H' },
      { rank: '9', suit: 'C' },
      { rank: 'K', suit: 'S' },
      { rank: '7', suit: 'D' },
    ])
    expect(rigFaces('10h, qd')).toEqual([
      { rank: '10', suit: 'H' },
      { rank: 'Q', suit: 'D' },
    ])
  })

  it('rejects a bad card code', () => {
    expect(() => rigFaces('ZZ')).toThrow('Bad card code "ZZ"')
  })
})

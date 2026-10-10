import { describe, expect, it } from 'vitest'
import { buildShoe, faceDown, shuffle } from './deck'
import { standard52 } from './decks/standard52'
import { createRng } from './rng'

describe('shuffle', () => {
  it('is a fixed permutation for a seed and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(input, createRng('neon'))).toEqual([5, 3, 4, 6, 1, 7, 2, 8])
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('handles empty and single-item lists', () => {
    expect(shuffle([], createRng('neon'))).toEqual([])
    expect(shuffle(['x'], createRng('neon'))).toEqual(['x'])
  })
})

describe('buildShoe', () => {
  it('shuffles the faces and numbers the ids by shoe position', () => {
    const shoe = buildShoe(standard52, 1, createRng('neon'))
    expect(shoe.slice(0, 4)).toEqual([
      { id: 'standard52-0', deck: 'standard52', face: { rank: '6', suit: 'C' } },
      { id: 'standard52-1', deck: 'standard52', face: { rank: '5', suit: 'C' } },
      { id: 'standard52-2', deck: 'standard52', face: { rank: '10', suit: 'H' } },
      { id: 'standard52-3', deck: 'standard52', face: { rank: '9', suit: 'S' } },
    ])
  })

  it('holds every copy of every face with unique ids', () => {
    const shoe = buildShoe(standard52, 6, createRng('six'))
    expect(shoe.length).toBe(312)
    expect(new Set(shoe.map((c) => c.id)).size).toBe(312)
    const aceOfSpades = shoe.filter((c) => c.face.rank === 'A' && c.face.suit === 'S')
    expect(aceOfSpades.length).toBe(6)
  })

  it('uses the given id prefix so a reshuffled shoe never reuses ids', () => {
    const shoe = buildShoe(standard52, 1, createRng('neon'), 'shoe2')
    expect([shoe[0]?.id, shoe[51]?.id, shoe[0]?.deck]).toEqual(['shoe2-0', 'shoe2-51', 'standard52'])
  })

  it('rejects a non-positive copy count', () => {
    expect(() => buildShoe(standard52, 0, createRng('neon'))).toThrow('copies must be a positive integer, got 0')
  })
})

describe('faceDown', () => {
  it('keeps the id and hides the face', () => {
    expect(faceDown({ id: 'standard52-7', deck: 'standard52', face: { rank: 'K', suit: 'H' } })).toEqual({
      id: 'standard52-7',
      deck: 'standard52',
      face: null,
    })
  })
})

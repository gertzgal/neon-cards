import { describe, expect, it } from 'vitest'
import { buildShoe, faceDown } from '../deck'
import { createRng } from '../rng'
import type { Card } from '../types'
import { flip7Deck, type Flip7Face } from './flip7'

const SHOE_TOP: Card<Flip7Face>[] = [
  { id: 'flip7-0', deck: 'flip7', face: { kind: 'number', value: 9 } },
  { id: 'flip7-1', deck: 'flip7', face: { kind: 'number', value: 10 } },
  { id: 'flip7-2', deck: 'flip7', face: { kind: 'number', value: 12 } },
]

const key = (f: Flip7Face) =>
  f.kind === 'number' ? `${f.value}` : f.kind === 'modifier' ? (f.op === 'add' ? `+${f.value}` : `x${f.value}`) : f.action

function census(faces: Flip7Face[]) {
  const counts: Record<string, number> = {}
  for (const f of faces) counts[key(f)] = (counts[key(f)] ?? 0) + 1
  return counts
}

describe('flip7Deck', () => {
  it('has 94 cards', () => {
    expect(flip7Deck.id).toBe('flip7')
    expect(flip7Deck.build().length).toBe(94)
  })

  it('holds one 0 and n copies of each number n from 1 to 12', () => {
    expect(census(flip7Deck.build())).toMatchObject({
      '0': 1, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    })
  })

  it('holds one of each modifier and three of each action', () => {
    const counts = census(flip7Deck.build())
    expect(['+2', '+4', '+6', '+8', '+10', 'x2'].map((k) => counts[k])).toEqual([1, 1, 1, 1, 1, 1])
    expect(['freeze', 'flipThree', 'secondChance'].map((k) => counts[k])).toEqual([3, 3, 3])
    expect(Object.keys(counts).length).toBe(13 + 6 + 3)
  })

  it('splits into 79 number, 6 modifier, and 9 action cards', () => {
    const faces = flip7Deck.build()
    expect(['number', 'modifier', 'action'].map((kind) => faces.filter((f) => f.kind === kind).length)).toEqual([79, 6, 9])
  })

  it('runs through the generic shoe helpers like any other deck', () => {
    const shoe = buildShoe(flip7Deck, 1, createRng('flip7'))
    expect(shoe.length).toBe(94)
    expect(new Set(shoe.map((c) => c.id)).size).toBe(94)
    expect(census(shoe.map((c) => c.face))).toEqual(census(flip7Deck.build()))
    expect(shoe.slice(0, 3)).toEqual(SHOE_TOP)
    expect(faceDown(shoe[0] as Card<Flip7Face>)).toEqual({ id: 'flip7-0', deck: 'flip7', face: null })
  })

  it('builds a fresh copy each time', () => {
    const a = flip7Deck.build()
    a.pop()
    expect(flip7Deck.build().length).toBe(94)
  })
})

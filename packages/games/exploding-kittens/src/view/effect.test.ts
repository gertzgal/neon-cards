import type { Card } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import type { EkFace } from '../rules'
import { lineForEk } from './effect'

const card: Card<EkFace> = { id: 'c', deck: 'exploding-kittens', face: { title: 'skip' } }

describe('played-card line', () => {
  it('names the effect in a few words when the card resolves', () => {
    expect(lineForEk({ type: 'Played', seat: 'you', cards: [card], effect: { type: 'skip' } })).toBe('Skip')
    expect(lineForEk({ type: 'Played', seat: 'you', cards: [card], effect: { type: 'attack' } })).toBeNull()
    expect(lineForEk({ type: 'Played', seat: 'you', cards: [card], effect: { type: 'favor', target: 'cpu-1' } })).toBe('Give one')
    expect(lineForEk({ type: 'Attacked', from: 'you', to: 'cpu-1', owed: 2 })).toBe('Two draws')
    expect(lineForEk({ type: 'Shuffled', count: 20 })).toBe('Shuffled')
    expect(lineForEk({ type: 'Peeked', seat: 'you', count: 3 })).toBe('Three ahead')
    expect(lineForEk({ type: 'Defused', seat: 'you', defuse: card, kitten: card })).toBe('Defused')
    expect(lineForEk({ type: 'Noped', seat: 'cpu-1', card, nopes: 1 })).toBe('Nope')
    expect(lineForEk({ type: 'Cancelled', seat: 'you', nopes: 1 })).toBe('Nope')
    expect(lineForEk({ type: 'Drew', seat: 'you', card: null })).toBeNull()
    expect(lineForEk({ type: 'turn' })).toBeNull()
  })
})

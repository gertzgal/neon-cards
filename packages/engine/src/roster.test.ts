import { describe, expect, it } from 'vitest'
import { soloSeats } from './roster'

const score = { house: [] as const }
const table = { house: [{ id: 'dealer', name: 'Dealer' }] }

describe('soloSeats', () => {
  it('seats the human first, then numbered CPUs at the chosen difficulty', () => {
    expect(soloSeats(score, { opponents: 2, difficulty: 'hard' })).toEqual([
      { id: 'you', kind: 'human', name: 'You' },
      { id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'hard' },
      { id: 'cpu-2', kind: 'cpu', name: 'CPU 2', difficulty: 'hard' },
    ])
  })

  it('puts the human last when position is last, and treats a missing difficulty as easy', () => {
    expect(soloSeats(score, { opponents: 1, position: 'last' })).toEqual([
      { id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'easy' },
      { id: 'you', kind: 'human', name: 'You' },
    ])
  })

  it('seats one human when the config names no opponents', () => {
    expect(soloSeats(score, {})).toEqual([{ id: 'you', kind: 'human', name: 'You' }])
  })

  it('seats a house game as player plus those house seats', () => {
    expect(soloSeats(table, { opponents: 3 })).toEqual([
      { id: 'player', kind: 'human', name: 'You' },
      { id: 'dealer', kind: 'house', name: 'Dealer' },
    ])
  })
})

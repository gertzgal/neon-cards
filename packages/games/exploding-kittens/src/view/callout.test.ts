import { describe, expect, it } from 'vitest'
import { lineForPlayed } from './callout'

describe('play callout', () => {
  it('names the play in a few words', () => {
    expect(lineForPlayed({ type: 'skip' })).toBe('Skip')
    expect(lineForPlayed({ type: 'attack' })).toBe('Attack')
    expect(lineForPlayed({ type: 'future' })).toBe('Peek')
    expect(lineForPlayed({ type: 'pair', target: 'cpu-1', title: 'tacocat' })).toBe('Pair')
    expect(lineForPlayed({ type: 'five', titles: ['skip', 'attack', 'shuffle', 'favor', 'future'], takeId: 'x' })).toBe('Take')
  })
})

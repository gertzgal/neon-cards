import { describe, expect, it } from 'vitest'
import { lineForCard } from './callout'

describe('play callout', () => {
  it('names a dealt card in a few words', () => {
    expect(lineForCard({ kind: 'number', value: 8 })).toBe('8')
    expect(lineForCard({ kind: 'modifier', op: 'add', value: 10 })).toBe('Plus 10')
    expect(lineForCard({ kind: 'modifier', op: 'times', value: 2 })).toBe('Times two')
    expect(lineForCard({ kind: 'action', action: 'freeze' })).toBe('Freeze')
    expect(lineForCard({ kind: 'action', action: 'flipThree' })).toBe('Three flips')
    expect(lineForCard({ kind: 'action', action: 'secondChance' })).toBe('Second chance')
  })
})

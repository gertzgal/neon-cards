import { describe, expect, it } from 'vitest'
import type { Flip7Face } from '@neon-cards/engine'
import { lineForFlip7 } from './effect'

const dealt = (face: Flip7Face) => lineForFlip7({ type: 'CardDealt', card: { face } })

describe('played-card line', () => {
  it('names modifiers and actions when they resolve, and stays quiet for a number', () => {
    expect(dealt({ kind: 'modifier', op: 'times', value: 2 })).toBe('Times two')
    expect(dealt({ kind: 'modifier', op: 'add', value: 4 })).toBe('Plus 4')
    expect(dealt({ kind: 'number', value: 8 })).toBeNull()
    expect(lineForFlip7({ type: 'Frozen' })).toBe('Freeze')
    expect(lineForFlip7({ type: 'FlipThreeStarted' })).toBe('Three flips')
    expect(lineForFlip7({ type: 'SecondChanceGained' })).toBe('Second chance')
    expect(lineForFlip7({ type: 'SecondChanceUsed' })).toBe('Saved')
    expect(lineForFlip7({ type: 'Stayed' })).toBeNull()
  })
})

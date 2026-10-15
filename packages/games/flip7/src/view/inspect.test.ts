import { describe, expect, it } from 'vitest'
import { actionSentence } from './face'

describe('action explanations', () => {
  it('gives every face one sentence', () => {
    expect(actionSentence({ kind: 'action', action: 'freeze' })).toBe('That player banks their score and sits this round out.')
    expect(actionSentence({ kind: 'action', action: 'flipThree' })).toBe('That player flips the next three cards.')
    expect(actionSentence({ kind: 'action', action: 'secondChance' })).toBe(
      'Your next duplicate is discarded instead of busting you.',
    )
    expect(actionSentence({ kind: 'number', value: 7 })).toBe('A second copy busts. Seven different numbers scores Flip 7.')
    expect(actionSentence({ kind: 'modifier', op: 'add', value: 10 })).toBe('Add 10 to the round.')
    expect(actionSentence({ kind: 'modifier', op: 'times', value: 2 })).toBe('Double your number cards.')
  })
})

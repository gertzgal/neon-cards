import type { Flip7Face } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { actionSentence } from './face'

describe('action explanations', () => {
  it('explains only Freeze, Flip Three, and Second Chance', () => {
    const actions: Flip7Face[] = [
      { kind: 'action', action: 'freeze' },
      { kind: 'action', action: 'flipThree' },
      { kind: 'action', action: 'secondChance' },
    ]
    for (const face of actions) {
      const sentence = actionSentence(face)
      expect(sentence?.endsWith('.')).toBe(true)
      expect(sentence?.slice(0, -1)).not.toContain('.')
    }
    expect(actionSentence({ kind: 'action', action: 'freeze' })).toBe('That player banks their score and sits this round out.')
    expect(actionSentence({ kind: 'number', value: 7 })).toBeNull()
    expect(actionSentence({ kind: 'modifier', op: 'add', value: 10 })).toBeNull()
    expect(actionSentence({ kind: 'modifier', op: 'times', value: 2 })).toBeNull()
  })
})
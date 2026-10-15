import type { Flip7Face } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { rules } from '../rules'
import { actionSentence } from './face'
import { guide } from './guide'

const faces: Record<string, Flip7Face> = {
  number: { kind: 'number', value: 7 },
  freeze: { kind: 'action', action: 'freeze' },
  flipThree: { kind: 'action', action: 'flipThree' },
  secondChance: { kind: 'action', action: 'secondChance' },
  add: { kind: 'modifier', op: 'add', value: 4 },
  times: { kind: 'modifier', op: 'times', value: 2 },
}

describe('flip 7 guide', () => {
  it('reads each row from actionSentence', () => {
    const goal = guide.sections[0]
    if (goal?.kind !== 'prose') throw new Error('goal')
    const paragraph = goal.blocks[0]
    if (paragraph?.kind !== 'paragraph') throw new Error('goal paragraph')
    expect(paragraph.text[0]?.text).toBe(rules.meta.description)

    const cards = guide.sections.find((section) => section.kind === 'cards')
    if (cards?.kind !== 'cards') throw new Error('cards')
    for (const row of cards.rows) {
      const face = faces[row.id]
      if (!face) throw new Error(row.id)
      expect(row.sentence).toBe(actionSentence(face))
    }
    expect(actionSentence({ kind: 'number', value: 7 })).toBe('A second copy busts. Seven different numbers scores Flip 7.')
    expect(actionSentence({ kind: 'modifier', op: 'add', value: 10 })).toBe('Add 10 to the round.')
    expect(actionSentence({ kind: 'modifier', op: 'times', value: 2 })).toBe('Double your number cards.')
    expect(actionSentence({ kind: 'action', action: 'freeze' })).toBe('That player banks their score and sits this round out.')
    expect(actionSentence({ kind: 'action', action: 'flipThree' })).toBe('That player flips the next three cards.')
    expect(actionSentence({ kind: 'action', action: 'secondChance' })).toBe(
      'Your next duplicate is discarded instead of busting you.',
    )
  })
})

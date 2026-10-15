import { describe, expect, it } from 'vitest'
import { guide } from './guide'

describe('blackjack guide', () => {
  it('keeps the three sentences in this file', () => {
    const cards = guide.sections.find((section) => section.kind === 'cards')
    if (cards?.kind !== 'cards') throw new Error('cards')
    const [ace, face, number] = cards.rows
    if (!ace || !face || !number) throw new Error('rows')
    expect(ace.id).toBe('ace')
    expect(face.id).toBe('face')
    expect(number.id).toBe('number')
    expect(ace.name).toBe('ACE')
    expect(face.name).toBe('J \u00b7 Q \u00b7 K')
    expect(number.name).toBe('2 \u2013 10')
    expect(ace.sentence).toBe('Counts 1 or 11, whichever helps.')
    expect(face.sentence).toBe('Every face card counts 10.')
    expect(number.sentence).toBe('Number cards count their number.')
  })
})
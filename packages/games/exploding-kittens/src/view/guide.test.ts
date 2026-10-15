import { describe, expect, it } from 'vitest'
import { TITLE_ORDER, type Title } from '../rules/types'
import { scenes } from './art'
import { guide } from './guide'

const cats = ['tacocat', 'hairyPotato', 'rainbowRalphing', 'beard', 'cattermelon'] as const satisfies readonly Title[]

describe('exploding kittens guide', () => {
  it('lists TITLE_ORDER and shares one cat rule', () => {
    const cards = guide.sections.find((section) => section.kind === 'cards')
    if (cards?.kind !== 'cards') throw new Error('cards')
    expect(cards.rows.length).toBe(TITLE_ORDER.length)
    for (let i = 0; i < TITLE_ORDER.length; i++) {
      const title = TITLE_ORDER[i]
      const row = cards.rows[i]
      if (!title || !row) throw new Error('row')
      expect(row.id).toBe(title)
      expect(row.sentence).toBe(scenes[title].rule)
    }
    const [first, ...rest] = cats
    if (!first) throw new Error('cats')
    for (const title of rest) expect(scenes[title].rule === scenes[first].rule).toBe(true)
  })
})
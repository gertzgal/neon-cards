import { describe, expect, it } from 'vitest'
import { defineGuide, type GameGuide } from './api'

function page(): GameGuide {
  return {
    title: 'FLIP 7',
    sections: [
      {
        kind: 'prose',
        id: 'goal',
        title: 'GOAL',
        blocks: [{ kind: 'paragraph', text: [{ text: 'Flip.' }] }],
      },
    ],
  }
}

describe('defineGuide', () => {
  it('returns the same object', () => {
    const guide = page()
    expect(defineGuide(guide)).toBe(guide)
  })

  it('rejects a page that cannot be painted', () => {
    const guide = page()
    expect(() => defineGuide({ ...guide, title: ' ' })).toThrow(/title/)
    expect(() => defineGuide({ ...guide, sections: [] })).toThrow(/sections/)
    const goal = guide.sections[0]
    if (!goal) throw new Error('goal')
    expect(() =>
      defineGuide({
        ...guide,
        sections: [goal, { ...goal, id: 'goal' }],
      }),
    ).toThrow(/repeats/)
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'prose', id: 'goal', title: 'GOAL', blocks: [] }],
      }),
    ).toThrow(/blocks/)
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'prose', id: 'goal', title: 'GOAL', blocks: [{ kind: 'paragraph', text: [] }] }],
      }),
    ).toThrow(/empty run/)
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'prose', id: 'goal', title: 'GOAL', blocks: [{ kind: 'list', items: [] }] }],
      }),
    ).toThrow(/empty list/)
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'cards', id: 'cards', title: 'THE CARDS', rows: [] }],
      }),
    ).toThrow(/rows/)
    const row = { id: 'ace', name: 'ACE', sentence: 'Counts.', paint: () => null }
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'cards', id: 'cards', title: 'THE CARDS', rows: [row, { ...row }] }],
      }),
    ).toThrow(/repeats/)
    expect(() =>
      defineGuide({
        title: 'X',
        sections: [{ kind: 'cards', id: 'cards', title: 'THE CARDS', rows: [{ ...row, sentence: ' ' }] }],
      }),
    ).toThrow(/sentence/)
  })
})

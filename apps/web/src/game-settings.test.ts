import { describe, expect, it } from 'vitest'
import { resolveGameSettings } from './game-settings'
import type { SettingSpec } from '@neon-cards/engine'

const specs: SettingSpec[] = [
  {
    key: 'opponents',
    label: 'Opponents',
    options: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ],
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  },
]

describe('resolveGameSettings', () => {
  it('falls back to the first option with no defaults or stored values', () => {
    expect(resolveGameSettings(specs, {}, null)).toEqual({ opponents: 1, difficulty: 'easy' })
  })

  it('uses the game default config when it is one of the options', () => {
    expect(resolveGameSettings(specs, { opponents: 2, difficulty: 'medium', decks: 6 }, null)).toEqual({
      opponents: 2,
      difficulty: 'medium',
    })
  })

  it('prefers the remembered choice and ignores stale or foreign values', () => {
    expect(
      resolveGameSettings(specs, { opponents: 2, difficulty: 'medium' }, { opponents: 3, difficulty: 'nightmare', x: 1 }),
    ).toEqual({ opponents: 3, difficulty: 'medium' })
  })

  it('does not coerce types: "3" is not the option 3', () => {
    expect(resolveGameSettings(specs, {}, { opponents: '3' })).toEqual({ opponents: 1, difficulty: 'easy' })
  })

  it('is empty for a game with no settings', () => {
    expect(resolveGameSettings([], { decks: 6 }, { decks: 2 })).toEqual({})
  })
})

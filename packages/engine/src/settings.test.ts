import { describe, expect, it } from 'vitest'
import { ConfigError } from './errors'
import { parseSettings } from './settings'
import type { SettingSpec } from './types'

const settings: SettingSpec[] = [
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
const defaults = { opponents: 1, difficulty: 'easy' }

describe('parseSettings', () => {
  it('takes declared values and fills the rest from defaults', () => {
    expect(parseSettings(settings, defaults, { opponents: 3 })).toEqual({ opponents: 3, difficulty: 'easy' })
    expect(parseSettings(settings, defaults, { opponents: 2, difficulty: 'hard' })).toEqual({ opponents: 2, difficulty: 'hard' })
  })

  it('returns a copy of the defaults for missing config', () => {
    const parsed = parseSettings(settings, defaults, undefined)
    expect(parsed).toEqual({ opponents: 1, difficulty: 'easy' })
    expect(parsed).not.toBe(defaults)
    expect(parseSettings(settings, defaults, null)).toEqual({ opponents: 1, difficulty: 'easy' })
  })

  it('ignores keys it does not declare', () => {
    expect(parseSettings(settings, defaults, { rig: 'bust', opponents: 2 })).toEqual({ opponents: 2, difficulty: 'easy' })
  })

  it('rejects values outside the choice list, without coercion', () => {
    expect(() => parseSettings(settings, defaults, { opponents: 4 })).toThrow('opponents must be one of 1, 2, 3')
    expect(() => parseSettings(settings, defaults, { opponents: '2' })).toThrow(ConfigError)
    expect(() => parseSettings(settings, defaults, { difficulty: 'insane' })).toThrow(
      'difficulty must be one of "easy", "medium", "hard"',
    )
  })

  it('rejects config that is not an object', () => {
    expect(() => parseSettings(settings, defaults, 'hard')).toThrow('config must be an object')
    expect(() => parseSettings(settings, defaults, [1])).toThrow('config must be an object')
  })
})

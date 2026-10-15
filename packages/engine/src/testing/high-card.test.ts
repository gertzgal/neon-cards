import { soloSeats } from '../roster'
import { describe, expect, it } from 'vitest'
import { ConfigError, IllegalActionError } from '../errors'
import { createRng } from '../rng'
import { highCard } from './high-card'

const def = highCard.definition

describe('high card config and seats', () => {
  it('parses settings with defaults and rejects anything off the choice list', () => {
    expect(def.parseConfig(undefined)).toEqual({ opponents: 1, difficulty: 'easy', position: 'first' })
    expect(def.parseConfig({ opponents: 3, difficulty: 'hard' })).toEqual({ opponents: 3, difficulty: 'hard', position: 'first' })
    expect(() => def.parseConfig({ opponents: 4 })).toThrow(ConfigError)
  })

  it('seats the human first or last with numbered CPUs at the chosen difficulty', () => {
    expect(soloSeats(def, { opponents: 2, difficulty: 'medium', position: 'last' })).toEqual([
      { id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'medium' },
      { id: 'cpu-2', kind: 'cpu', name: 'CPU 2', difficulty: 'medium' },
      { id: 'you', kind: 'human', name: 'You' },
    ])
  })

  it('declares its settings for the pre-game sheet', () => {
    expect(highCard.meta.settings?.map((s) => [s.key, s.options.map((o) => o.value)])).toEqual([
      ['opponents', [1, 2, 3]],
      ['difficulty', ['easy', 'medium', 'hard']],
      ['position', ['first', 'last']],
    ])
  })
})

describe('high card views', () => {
  const config = { opponents: 2, difficulty: 'easy', position: 'first' } as const
  const state = def.setup(config, soloSeats(def, config), createRng('neon'))

  it('shows a seat its own card and hides everyone else’s while playing', () => {
    const view = def.view(state, 'cpu-1')
    expect(view.hands['cpu-1']).toEqual({ id: 'standard52-1', deck: 'standard52', face: { rank: '5', suit: 'C' } })
    expect(view.hands.you).toEqual({ id: 'standard52-0', deck: 'standard52', face: null })
    expect(view.hands['cpu-2']).toEqual({ id: 'standard52-2', deck: 'standard52', face: null })
    expect(JSON.stringify(view)).not.toContain('shoe')
  })

  it('reveals every card once the round is over', () => {
    const settled = { ...state, phase: 'settling' as const }
    expect(Object.values(def.view(settled, 'you').hands).map((c) => c.face)).toEqual([
      { rank: '6', suit: 'C' },
      { rank: '5', suit: 'C' },
      { rank: '10', suit: 'H' },
    ])
  })

  it('offers keep or swap to the seat to act and nothing to anyone else', () => {
    expect(def.legalActions(state, 'you')).toEqual([{ type: 'keep' }, { type: 'swap' }])
    expect(def.legalActions(state, 'cpu-1')).toEqual([])
    expect(() => def.apply(state, 'cpu-1', { type: 'keep' }, createRng('x'))).toThrow(IllegalActionError)
    expect(() => def.apply(state, 'you', { type: 'next' }, createRng('x'))).toThrow('next is not legal while playing')
  })
})

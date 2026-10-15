import { act, startMatch, type Difficulty, type SeatId } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { explodingKittens } from '../definition'
import { rules } from '../index'
import type { EkAction, EkView } from '../types'

const GAMES = 200

/** The human script from the spec. It is not a policy on rules.policies. */
function humanScript(view: EkView, legal: EkAction[]): EkAction {
  const pending = view.pending
  if (pending?.kind === 'nope') {
    const pass = legal.find((action) => action.type === 'pass')
    if (!pass) throw new Error('human nope window has no pass')
    return pass
  }
  if (pending?.kind === 'defuse') {
    const bottom = legal.find((action) => action.type === 'defuse' && action.index === view.drawCount)
    if (!bottom) throw new Error('human defuse menu has no bottom index')
    return bottom
  }
  if (pending?.kind === 'give') {
    const first = legal.find((action) => action.type === 'give')
    if (!first) throw new Error('human give menu is empty')
    return first
  }
  const draw = legal.find((action) => action.type === 'draw')
  if (!draw) throw new Error('human turn has no draw')
  return draw
}

function play(seed: string, cpu1: Difficulty, cpu2: Difficulty): SeatId {
  const config = explodingKittens.parseConfig({ opponents: 2, difficulty: 'medium' })
  let step = startMatch(rules, { config: config, seats: rules.definition.seatsFor(config), seed: seed })
  step = {
    ...step,
    match: {
      ...step.match,
      seats: step.match.seats.map((seat) => {
        if (seat.id === 'cpu-1') return { ...seat, difficulty: cpu1 }
        if (seat.id === 'cpu-2') return { ...seat, difficulty: cpu2 }
        return seat
      }),
    },
  }
  for (let n = 0; n < 4000; n++) {
    const id = explodingKittens.toAct(step.match.state)
    if (id === null) {
      const winner = step.match.state.winner
      if (!winner) throw new Error(`${seed} ended with no winner`)
      return winner
    }
    if (id !== 'you') throw new Error(`${seed} left ${id} to act`)
    const view = explodingKittens.view(step.match.state, id)
    const legal = explodingKittens.legalActions(step.match.state, id)
    step = act(rules, step.match, id, humanScript(view, legal))
  }
  throw new Error(`${seed} did not end`)
}

export interface StrengthRecord {
  games: number
  stronger: Difficulty
  weaker: Difficulty
  wins: Record<Difficulty, number> & { you: number }
}

function matchup(stronger: Difficulty, weaker: Difficulty): StrengthRecord {
  const wins = { easy: 0, medium: 0, hard: 0, you: 0 }
  for (let i = 0; i < GAMES; i++) {
    const cpu1: Difficulty = i % 2 === 0 ? stronger : weaker
    const cpu2: Difficulty = i % 2 === 0 ? weaker : stronger
    const winner = play(`ek-strength-${i}`, cpu1, cpu2)
    if (winner === 'cpu-1') wins[cpu1] += 1
    else if (winner === 'cpu-2') wins[cpu2] += 1
    else wins.you += 1
  }
  return { games: GAMES, stronger, weaker, wins }
}

describe('exploding kittens CPU strength', () => {
  it('Hard beats Medium over 200 seeds by at least 15, with Hard at least 70', () => {
    const record = matchup('hard', 'medium')
    console.info('strength hard vs medium', JSON.stringify(record))
    expect(record.wins.hard, JSON.stringify(record)).toBeGreaterThanOrEqual(70)
    expect(record.wins.hard - record.wins.medium, JSON.stringify(record)).toBeGreaterThanOrEqual(15)
  }, 180_000)

  it('Medium beats Easy over 200 seeds by at least 15, with Medium at least 70', () => {
    const record = matchup('medium', 'easy')
    console.info('strength medium vs easy', JSON.stringify(record))
    expect(record.wins.medium, JSON.stringify(record)).toBeGreaterThanOrEqual(70)
    expect(record.wins.medium - record.wins.easy, JSON.stringify(record)).toBeGreaterThanOrEqual(15)
  }, 180_000)

  it('Hard beats Easy over 200 seeds by at least 25, with Hard at least 80', () => {
    const record = matchup('hard', 'easy')
    console.info('strength hard vs easy', JSON.stringify(record))
    expect(record.wins.hard, JSON.stringify(record)).toBeGreaterThanOrEqual(80)
    expect(record.wins.hard - record.wins.easy, JSON.stringify(record)).toBeGreaterThanOrEqual(25)
  }, 180_000)
})

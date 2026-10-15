import { describe, expect, it } from 'vitest'
import { act, applyOpening, createRng, soloSeats, startMatch, type Difficulty, type Policy, type SeatId, type Step } from '@neon-cards/engine'
import { flip7 } from '../definition'
import { rules } from '../index'
import type { Flip7Action, Flip7Config, Flip7State, Flip7View } from '../types'
import { drawPile, pileSize, seat } from './counting'
import { policies } from './index'

type F7Step = Step<Flip7Config, Flip7State, Flip7Action>

describe('flip 7 CPU policies in real games', () => {
  it('always choose a legal action and see a draw pile the size of drawCount, at every table size and difficulty', () => {
    let checked = 0
    const counted = (p: Policy<Flip7View, Flip7Action>): Policy<Flip7View, Flip7Action> => ({
      choose(view, legal, rng) {
        if (view.drawCount > 0) {
          expect(pileSize(drawPile(view))).toBe(view.drawCount)
          checked++
        }
        return p.choose(view, legal, rng)
      },
    })
    const countedRules = { ...rules, policies: { easy: counted(policies.easy), medium: counted(policies.medium), hard: counted(policies.hard) } }
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const opponents of [1, 2, 3] as const) {
        for (const seed of ['a', 'b', 'c']) {
          const config = rules.definition.parseConfig({ opponents, difficulty })
          let step: F7Step = startMatch(countedRules, { config: config, seats: soloSeats(countedRules.definition, config), seed: `${difficulty}-${opponents}-${seed}` })
          for (let n = 0; step.match.state.stage !== 'gameOver'; n++) {
            if (n > 3000) throw new Error('game did not end')
            const id = rules.definition.toAct(step.match.state)
            if (id === null) {
              step = applyOpening(countedRules, step.match)
              continue
            }
            const s = step.match.state
            const legal = rules.definition.legalActions(s, id)
            const view = rules.definition.view(s, id)
            const hitOrStay = legal.some((a) => a.type === 'stay')
            const action = hitOrStay ? legal[seat(view, id).roundValue < 20 ? 0 : 1] : legal[0]
            step = act(countedRules, step.match, id, action as Flip7Action)
          }
          expect(step.match.state.stage).toBe('gameOver')
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  }, 30_000)
})

/** Plays one game straight through the definition, with a chosen policy for every seat including the human's. */
function duel(seed: string, seats: Record<SeatId, Difficulty>): SeatId {
  const config = flip7.parseConfig({ opponents: Object.keys(seats).length - 1 })
  const rng = createRng(seed)
  const policyRng = createRng(`${seed}-cpu`)
  let s = flip7.setup(config, soloSeats(flip7, config), rng)
  for (let n = 0; ; n++) {
    if (n > 5000) throw new Error('game did not end')
    const id = flip7.toAct(s)
    if (id === null) {
      const opening = flip7.opening?.(s)
      if (!opening) return s.winner as SeatId
      s = flip7.apply(s, s.order[0] as SeatId, opening, rng).state
      continue
    }
    const legal = flip7.legalActions(s, id)
    const action = policies[seats[id] as Difficulty].choose(flip7.view(s, id), legal, policyRng)
    s = flip7.apply(s, id, action, rng).state
  }
}

function winsOf(a: Difficulty, b: Difficulty, games: number): number {
  let wins = 0
  for (let g = 0; g < games; g++) {
    const seats = g % 2 === 0 ? { you: a, 'cpu-1': b } : { you: b, 'cpu-1': a }
    const winner = duel(`duel-${a}-${b}-${g}`, seats)
    if (seats[winner as 'you' | 'cpu-1'] === a) wins++
  }
  return wins
}

describe('flip 7 CPU strength', () => {
  it('Hard beats Medium and Easy, and Medium beats Easy, head to head over 150 seeded games each', () => {
    expect(winsOf('hard', 'easy', 150)).toBeGreaterThanOrEqual(100)
    expect(winsOf('medium', 'easy', 150)).toBeGreaterThanOrEqual(95)
    expect(winsOf('hard', 'medium', 150)).toBeGreaterThanOrEqual(85)
  }, 60_000)
})

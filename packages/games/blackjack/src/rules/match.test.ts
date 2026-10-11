import { describe, expect, it } from 'vitest'
import { act, NotYourTurnError, replay, startMatch, type ActionRecord, type Match, type Step } from '@neon-cards/engine'
import { rules } from './index'
import type { BlackjackAction, BlackjackConfig, BlackjackState } from './types'

type BjStep = Step<BlackjackConfig, BlackjackState, BlackjackAction>

function session(config: unknown, ...actions: BlackjackAction[]) {
  const parsed = rules.definition.parseConfig(config)
  let step: BjStep = startMatch(rules, parsed, 'seed-1')
  const steps = [step]
  for (const action of actions) {
    step = act(rules, step.match, 'player', action)
    steps.push(step)
  }
  return { parsed, steps, last: step }
}

const roundNets = (steps: BjStep[]) => steps.flatMap((s) => s.rounds)
const log = (steps: BjStep[]): ActionRecord<BlackjackAction>[] => steps.flatMap((s) => s.log)

describe('blackjack through the engine match runtime', () => {
  it('starts in betting with no events and the player to act', () => {
    const { last } = session({})
    expect(last.events).toEqual([])
    expect(last.match.seats.map((s) => [s.id, s.kind])).toEqual([
      ['player', 'human'],
      ['dealer', 'house'],
    ])
    expect(rules.definition.toAct(last.match.state)).toBe('player')
    expect(rules.definition.phase(last.match.state)).toBe('betting')
  })

  it('reports one settlement per finished round, matching the stack change', () => {
    const { steps, last } = session(
      { rig: 'win', bankroll: 1000 },
      { type: 'bet', amount: 50 },
      { type: 'stand' },
      { type: 'bet', amount: 50 },
      { type: 'stand' },
    )
    expect(roundNets(steps)).toEqual([[{ seat: 'player', delta: 50 }], [{ seat: 'player', delta: 50 }]])
    expect(last.match.state.stack).toBe(1100)
  })

  it('settles a natural that resolves inside the bet action', () => {
    const { steps } = session({ rig: 'blackjack' }, { type: 'bet', amount: 50 })
    expect(steps[1]?.rounds).toEqual([[{ seat: 'player', delta: 75 }]])
  })

  it('does not count a refill as a round', () => {
    const { steps, last } = session({ rig: 'lose', bankroll: 5 }, { type: 'bet', amount: 5 }, { type: 'stand' }, { type: 'refill' })
    expect(roundNets(steps)).toEqual([[{ seat: 'player', delta: -5 }]])
    expect(steps[3]?.events).toEqual([{ type: 'refill', seat: 'player', amount: 1250, stack: 1250 }])
    expect(last.match.state.stack).toBe(1250)
  })

  it('rejects a seat that is not to act', () => {
    const { last } = session({})
    expect(() => act(rules, last.match, 'dealer', { type: 'bet', amount: 5 })).toThrow('"dealer" is not a human seat')
    const wrong: Match<BlackjackConfig, BlackjackState> = { ...last.match, seats: [...last.match.seats, { id: 'p2', kind: 'human', name: 'P2' }] }
    expect(() => act(rules, wrong, 'p2', { type: 'bet', amount: 5 })).toThrow(NotYourTurnError)
  })

  it('replays a session from seed, config, and log to the same state, events, and rounds', () => {
    const parsed = rules.definition.parseConfig({})
    let last: BjStep = startMatch(rules, parsed, 'seed-1')
    const live: BjStep[] = []
    while (last.match.state.round < 6 || rules.definition.phase(last.match.state) === 'playing') {
      const view = rules.definition.view(last.match.state, 'player')
      const total = view.hands[view.active]?.total ?? 0
      const action: BlackjackAction = view.legal.includes('bet')
        ? { type: 'bet', amount: 25 }
        : { type: total < 17 ? 'hit' : 'stand' }
      last = act(rules, last.match, 'player', action)
      live.push(last)
    }
    expect(live.length).toBeGreaterThan(12)
    const again = replay(rules, { seed: 'seed-1', config: parsed, log: log(live), version: rules.definition.version })
    expect(again.match).toEqual(last.match)
    expect(again.events).toEqual(live.flatMap((s) => s.events))
    expect(again.rounds).toEqual(roundNets(live))
  })

  it('keeps the whole match plain JSON', () => {
    const { last } = session({ rig: 'split' }, { type: 'bet', amount: 25 }, { type: 'split' })
    expect(JSON.parse(JSON.stringify(last.match))).toEqual(last.match)
  })
})

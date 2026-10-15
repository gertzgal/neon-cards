import { describe, expect, it } from 'vitest'
import { act, applyOpening, replay, soloSeats, startMatch, type ActionRecord, type Policy, type Step } from '@neon-cards/engine'
import { faceKey } from './cards'
import { HUMAN } from './definition'
import { rules } from './index'
import type { F7Card, Flip7Action, Flip7Config, Flip7State, Flip7View } from './types'

type F7Step = Step<Flip7Config, Flip7State, Flip7Action>

// Uniformly random legal play for every seat: the harshest driver for the rules' state machine.
const random: Policy<Flip7View, Flip7Action> = { choose: (_view, legal, rng) => legal[rng.int(legal.length)] as Flip7Action }
const randomRules = { ...rules, policies: { easy: random, medium: random, hard: random } }

function cardsInPlay(s: Flip7State): F7Card[] {
  const out: F7Card[] = [...s.draw, ...s.discard]
  for (const r of Object.values(s.rounds)) {
    out.push(...r.line.numbers, ...r.line.modifiers)
    if (r.line.secondChance) out.push(r.line.secondChance)
    if (r.line.freeze) out.push(r.line.freeze)
  }
  for (const t of s.stack) {
    if (t.t === 'flip3') out.push(t.card, ...t.setAside)
    else if (t.t === 'assign') out.push(...t.cards, ...t.assigned.map((a) => a.card))
    else if (t.t === 'resolve') out.push(t.card)
  }
  if (s.pending && s.pending.kind !== 'hitOrStay' && s.pending.kind !== 'assign') out.push(s.pending.card)
  return out
}

/** Plays a whole game: the human picks with a seeded counter, CPUs use the random policy. */
function playGame(seed: string, opponents: 1 | 2 | 3) {
  const config = rules.definition.parseConfig({ opponents })
  let step: F7Step = startMatch(randomRules, { config: config, seats: soloSeats(randomRules.definition, config), seed: seed })
  const steps: F7Step[] = [step]
  for (let n = 0; step.match.state.stage !== 'gameOver'; n++) {
    if (n > 5000) throw new Error('game did not end')
    const id = rules.definition.toAct(step.match.state)
    if (id === null) step = applyOpening(randomRules, step.match)
    else {
      const legal = rules.definition.legalActions(step.match.state, id)
      step = act(randomRules, step.match, id, legal[(n * 7 + seed.length) % legal.length] as Flip7Action)
    }
    steps.push(step)
    const cards = cardsInPlay(step.match.state)
    expect(cards).toHaveLength(94)
    expect(new Set(cards.map((c) => c.id)).size).toBe(94)
  }
  return { config, steps, last: step }
}

describe('flip 7 through the engine match runtime', () => {
  it('plays whole seeded games at every table size to a single winner at 200+, conserving all 94 cards', () => {
    for (const opponents of [1, 2, 3] as const) {
      for (const seed of ['a', 'b', 'c', 'd']) {
        const { last } = playGame(`${seed}${opponents}`, opponents)
        const s = last.match.state
        expect(s.stage).toBe('gameOver')
        const best = Math.max(...Object.values(s.totals))
        expect(best).toBeGreaterThanOrEqual(200)
        expect(s.totals[s.winner ?? '']).toBe(best)
        expect(Object.values(s.totals).filter((t) => t === best)).toHaveLength(1)
      }
    }
  })

  it('settles one zero-delta round per finished round', () => {
    const { steps, last } = playGame('rounds', 2)
    const rounds = steps.flatMap((s) => s.rounds)
    expect(rounds).toHaveLength(last.match.state.round)
    expect(rounds.every((r) => r.every((x) => x.delta === 0) && r.length === 3)).toBe(true)
  })

  it('replays a seeded game from seed, config, and log to the same state, events, and rounds', () => {
    const { config, steps, last } = playGame('replay-7', 3)
    const log: ActionRecord<Flip7Action>[] = steps.flatMap((s) => s.log)
    expect(log.some((r) => r.seat !== HUMAN)).toBe(true)
    const again = replay(randomRules, { seed: 'replay-7', config, seats: soloSeats(randomRules.definition, config), log, version: rules.definition.version })
    expect(again.match).toEqual(last.match)
    expect(again.events).toEqual(steps.flatMap((s) => s.events))
    expect(again.rounds).toEqual(steps.flatMap((s) => s.rounds))
  })

  it('pins a seeded opening: the last seat deals, and the first card is the human Flip Three', () => {
    const first: Policy<Flip7View, Flip7Action> = { choose: (_view, legal) => legal[0] as Flip7Action }
    const firstRules = { ...rules, policies: { easy: first, medium: first, hard: first } }
    const opened = startMatch(firstRules, { config: rules.definition.parseConfig({}), seats: soloSeats(firstRules.definition, rules.definition.parseConfig({})), seed: 'pin' })
    const step = applyOpening(firstRules, opened.match)
    expect(step.match.state.dealer).toBe('cpu-2')
    expect(step.events.map((e) => {
      const c = (e as { card?: F7Card }).card
      return [e.type, e.seat ?? '', c ? faceKey(c.face) : '']
    })).toEqual([
      ['RoundStarted', '', ''],
      ['CardDealt', 'you', 'T'],
    ])
    expect(step.match.state.pending).toMatchObject({ kind: 'target', seat: 'you' })
  })
})

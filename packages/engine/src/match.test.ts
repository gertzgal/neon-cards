import { describe, expect, it } from 'vitest'
import { IllegalActionError, NotYourTurnError } from './errors'
import { MAX_CPU_ACTIONS, act, replay, startMatch } from './match'
import { cpuRng } from './rng'
import { highCard, type HighCardConfig, type HighCardState } from './testing'
import type { GameDefinition, GameEvent, GamePhase, GameRules, Match, Policy, Seat, Step } from './types'

const config = (c: Partial<HighCardConfig> = {}): HighCardConfig => ({ opponents: 1, difficulty: 'easy', position: 'first', ...c })
const hidden = (id: string) => ({ id, deck: 'standard52', face: null })
const card = (id: string, rank: string, suit: string) => ({ id, deck: 'standard52', face: { rank, suit } })
const types = (events: GameEvent[]) => events.map((e) => (e.seat ? `${e.type}:${e.seat}` : e.type))

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

/** Plays a whole match (the human mixes keep and swap) and returns every step. */
function playOut(rules: typeof highCard, c: HighCardConfig, seed: string) {
  const steps: Step<HighCardConfig, HighCardState, unknown>[] = [startMatch(rules, c, seed)]
  let match = steps[0]?.match as Match<HighCardConfig, HighCardState>
  while (rules.definition.toAct(match.state) === 'you') {
    const action = match.state.phase === 'settling' ? { type: 'next' as const } : { type: match.seq % 2 ? ('swap' as const) : ('keep' as const) }
    const step = act(rules, match, 'you', action)
    steps.push(step)
    match = step.match
  }
  return { steps, match }
}

describe('startMatch', () => {
  it('builds the match from config and stops at the human when the human acts first', () => {
    const step = startMatch(highCard, config({ opponents: 2 }), 'neon')
    expect(step.events).toEqual([])
    expect(step.log).toEqual([])
    expect(step.rounds).toEqual([])
    expect(step.match.seats.map((s) => `${s.kind}:${s.id}:${s.difficulty ?? '-'}`)).toEqual([
      'human:you:-',
      'cpu:cpu-1:easy',
      'cpu:cpu-2:easy',
    ])
    expect([step.match.gameId, step.match.version, step.match.seed, step.match.seq]).toEqual(['high-card', 1, 'neon', 0])
    expect(highCard.definition.toAct(step.match.state)).toBe('you')
  })

  it('resolves CPU turns that come before the human, each wrapped in a turn event', () => {
    const step = startMatch(highCard, config({ opponents: 3, difficulty: 'medium', position: 'last' }), 'neon')
    expect(step.log).toEqual([
      { seq: 0, seat: 'cpu-1', action: { type: 'swap' } },
      { seq: 1, seat: 'cpu-2', action: { type: 'swap' } },
      { seq: 2, seat: 'cpu-3', action: { type: 'keep' } },
    ])
    expect(step.events).toEqual([
      { type: 'turn', seat: 'cpu-1' },
      { type: 'swap', seat: 'cpu-1', card: hidden('standard52-4') },
      { type: 'turn', seat: 'cpu-2' },
      { type: 'swap', seat: 'cpu-2', card: hidden('standard52-5') },
      { type: 'turn', seat: 'cpu-3' },
      { type: 'keep', seat: 'cpu-3' },
    ])
    expect(step.match.seq).toBe(3)
    expect(highCard.definition.toAct(step.match.state)).toBe('you')
  })

  it('rejects seat lists the rules or policies cannot support', () => {
    const noPolicies: GameRules<HighCardConfig, HighCardState> = { ...highCard, policies: undefined } as never
    expect(() => startMatch(noPolicies, config(), 'neon')).toThrow('no easy policy for cpu seat "cpu-1"')
    const tooMany = { ...highCard, definition: { ...highCard.definition, seats: { min: 2, max: 2 } } }
    expect(() => startMatch(tooMany, config({ opponents: 2 }), 'neon')).toThrow('high-card needs 2..2 seats, seatsFor returned 3')
    const dupes = { ...highCard, definition: { ...highCard.definition, seatsFor: (): Seat[] => [{ id: 'a', kind: 'human', name: 'A' }, { id: 'a', kind: 'human', name: 'B' }] } }
    expect(() => startMatch(dupes, config(), 'neon')).toThrow('seat ids must be unique')
    const noDifficulty = { ...highCard, definition: { ...highCard.definition, seatsFor: (): Seat[] => [{ id: 'you', kind: 'human', name: 'You' }, { id: 'c', kind: 'cpu', name: 'C' }] } }
    expect(() => startMatch(noDifficulty, config(), 'neon')).toThrow('cpu seat "c" has no difficulty')
  })
})

describe('act', () => {
  it('applies the human action, runs CPU turns, and settles the round', () => {
    const start = startMatch(highCard, config({ opponents: 3, difficulty: 'medium', position: 'last' }), 'neon')
    const step = act(highCard, start.match, 'you', { type: 'keep' })
    expect(step.log).toEqual([{ seq: 3, seat: 'you', action: { type: 'keep' } }])
    expect(step.events).toEqual([
      { type: 'keep', seat: 'you' },
      { type: 'reveal', seat: 'cpu-1', card: card('standard52-4', '3', 'H') },
      { type: 'reveal', seat: 'cpu-2', card: card('standard52-5', '2', 'S') },
      { type: 'reveal', seat: 'cpu-3', card: card('standard52-2', '10', 'H') },
      { type: 'reveal', seat: 'you', card: card('standard52-3', '9', 'S') },
      { type: 'roundEnd', winners: ['cpu-3'] },
    ])
    expect(step.rounds).toEqual([
      [
        { seat: 'cpu-1', delta: 0 },
        { seat: 'cpu-2', delta: 0 },
        { seat: 'cpu-3', delta: 1 },
        { seat: 'you', delta: 0 },
      ],
    ])
    expect(highCard.definition.phase(step.match.state)).toBe('settling')
    expect(highCard.definition.toAct(step.match.state)).toBe('you')
  })

  it('runs CPU turns after the human in the same step', () => {
    const start = startMatch(highCard, config({ opponents: 2 }), 'neon')
    const step = act(highCard, start.match, 'you', { type: 'swap' })
    expect(step.log.map((r) => `${r.seq}:${r.seat}:${(r.action as { type: string }).type}`)).toEqual([
      '0:you:swap',
      '1:cpu-1:swap',
      '2:cpu-2:swap',
    ])
    expect(types(step.events)).toEqual([
      'swap:you',
      'turn:cpu-1',
      'swap:cpu-1',
      'turn:cpu-2',
      'swap:cpu-2',
      'reveal:you',
      'reveal:cpu-1',
      'reveal:cpu-2',
      'roundEnd',
    ])
    expect(step.rounds).toEqual([
      [
        { seat: 'you', delta: 1 },
        { seat: 'cpu-1', delta: 0 },
        { seat: 'cpu-2', delta: 0 },
      ],
    ])
  })

  it('throws NotYourTurnError out of turn and lets apply() reject illegal actions', () => {
    const start = startMatch(highCard, config({ opponents: 1 }), 'neon')
    const afterRound = act(highCard, start.match, 'you', { type: 'keep' }).match
    expect(() => act(highCard, afterRound, 'you', { type: 'keep' })).toThrow(IllegalActionError)
    const human = startMatch(highCard, config({ position: 'last' }), 'neon')
    const cpuFirst = { ...human.match, state: { ...human.match.state, turn: 0 } }
    expect(() => act(highCard, cpuFirst, 'you', { type: 'keep' })).toThrow(NotYourTurnError)
    expect(() => act(highCard, cpuFirst, 'you', { type: 'keep' })).toThrow('"you" is not to act ("cpu-1" is)')
  })

  it('refuses to act for a CPU seat, an unknown seat, or a match from other rules', () => {
    const { match } = startMatch(highCard, config({ position: 'last' }), 'neon')
    expect(() => act(highCard, match, 'cpu-1', { type: 'keep' })).toThrow('"cpu-1" is not a human seat')
    expect(() => act(highCard, match, 'ghost', { type: 'keep' })).toThrow('"ghost" is not a human seat')
    expect(() => act(highCard, { ...match, version: 0 }, 'you', { type: 'keep' })).toThrow(
      'match is high-card v0, rules are high-card v1',
    )
  })

  it('never mutates the match it is given', () => {
    const { match } = startMatch(highCard, config({ opponents: 3 }), 'neon')
    const before = JSON.stringify(match)
    expect(() => act(highCard, deepFreeze(match), 'you', { type: 'swap' })).not.toThrow()
    expect(JSON.stringify(match)).toBe(before)
  })

  it('continues identically from a JSON round trip of the match, as the server stores it', () => {
    const { match } = startMatch(highCard, config({ opponents: 2, difficulty: 'easy' }), 'seed-7')
    const stored = JSON.parse(JSON.stringify(match)) as Match<HighCardConfig, HighCardState>
    expect(act(highCard, stored, 'you', { type: 'keep' })).toEqual(act(highCard, match, 'you', { type: 'keep' }))
  })
})

describe('a full match', () => {
  it('plays three rounds to game over, settling each round once', () => {
    const { steps, match } = playOut(highCard, config({ opponents: 3, difficulty: 'hard' }), 'neon')
    const rounds = steps.flatMap((s) => s.rounds)
    expect(rounds.length).toBe(3)
    expect(highCard.definition.phase(match.state)).toBe('over')
    expect(highCard.definition.toAct(match.state)).toBe(null)
    const totals: Record<string, number> = {}
    for (const round of rounds) for (const { seat, delta } of round) totals[seat] = (totals[seat] ?? 0) + delta
    expect(totals).toEqual(match.state.scores)
    expect(match.seq).toBe(steps.reduce((n, s) => n + s.log.length, 0))
  })

  it('is deterministic per seed', () => {
    const a = playOut(highCard, config({ opponents: 3 }), 'neon')
    const b = playOut(highCard, config({ opponents: 3 }), 'neon')
    const c = playOut(highCard, config({ opponents: 3 }), 'other')
    expect(a).toEqual(b)
    expect(a.match.state.hands).not.toEqual(c.match.state.hands)
  })
})

describe('replay', () => {
  it('rebuilds the final match, events, and rounds from seed, config, and log alone', () => {
    for (const c of [config({ opponents: 3, difficulty: 'easy', position: 'last' }), config({ opponents: 2, difficulty: 'hard' })]) {
      const { steps, match } = playOut(highCard, c, 'neon')
      const log = steps.flatMap((s) => s.log)
      const replayed = replay(highCard, { seed: 'neon', config: c, log })
      expect(replayed.match).toEqual(match)
      expect(replayed.log).toEqual(log)
      expect(replayed.events).toEqual(steps.flatMap((s) => s.events))
      expect(replayed.rounds).toEqual(steps.flatMap((s) => s.rounds))
    }
  })

  it('never runs a policy', () => {
    const c = config({ opponents: 2, difficulty: 'easy' })
    const { steps, match } = playOut(highCard, c, 'neon')
    const exploding: Policy<unknown, unknown> = {
      choose: () => {
        throw new Error('policy ran')
      },
    }
    const noPolicies = { ...highCard, policies: { easy: exploding, medium: exploding, hard: exploding } }
    expect(replay(noPolicies, { seed: 'neon', config: c, log: steps.flatMap((s) => s.log) }).match).toEqual(match)
  })

  it('rejects a log that skips a seq, has the wrong seat acting, or came from other rules', () => {
    const c = config({ opponents: 1 })
    expect(() => replay(highCard, { seed: 'neon', config: c, log: [], version: 2 })).toThrow('log is high-card v2, rules are high-card v1')
    expect(replay(highCard, { seed: 'neon', config: c, log: [], version: 1 }).match.seq).toBe(0)
    expect(() => replay(highCard, { seed: 'neon', config: c, log: [{ seq: 1, seat: 'you', action: { type: 'keep' } }] })).toThrow(
      'log entry 0 has seq 1',
    )
    expect(() => replay(highCard, { seed: 'neon', config: c, log: [{ seq: 0, seat: 'cpu-1', action: { type: 'keep' } }] })).toThrow(
      'log entry 0: "cpu-1" acted but "you" was to act',
    )
  })
})

describe('CPU seats', () => {
  it('give the policy only its own view and a cpu stream seeded by seed and seq', () => {
    const seen: unknown[] = []
    const spy: Policy<unknown, { type: string }> = {
      choose: (view, legal, rng) => {
        seen.push({ view, legal, roll: rng.int(1_000_000) })
        return legal[0] as { type: string }
      },
    }
    const rules = { ...highCard, policies: { easy: spy, medium: spy, hard: spy } } as typeof highCard
    const { match } = startMatch(rules, config({ opponents: 1, position: 'last' }), 'neon')
    const view = seen[0] as { view: { hands: Record<string, { face: unknown }> }; legal: unknown; roll: number }
    expect(view.legal).toEqual([{ type: 'keep' }, { type: 'swap' }])
    expect(view.view.hands['cpu-1']?.face).not.toBe(null)
    expect(view.view.hands.you?.face).toBe(null)
    expect(view.roll).toBe(cpuRng('neon', 0).int(1_000_000))
    expect(match.seq).toBe(1)
  })

  it('keep CPU randomness out of the deck stream', () => {
    const greedy: Policy<unknown, { type: string }> = {
      choose: (_view, legal, rng) => {
        for (let i = 0; i < 50; i++) rng.next()
        return legal[0] as { type: string }
      },
    }
    const lazy: Policy<unknown, { type: string }> = { choose: (_view, legal) => legal[0] as { type: string } }
    const c = config({ opponents: 3, position: 'last' })
    const a = startMatch({ ...highCard, policies: { easy: greedy, medium: greedy, hard: greedy } } as typeof highCard, c, 'neon')
    const b = startMatch({ ...highCard, policies: { easy: lazy, medium: lazy, hard: lazy } } as typeof highCard, c, 'neon')
    expect(a).toEqual(b)
  })

  it('cannot reach game state by mutating what the policy receives', () => {
    const vandal: Policy<{ hands: Record<string, unknown> }, { type: string }> = {
      choose: (view, legal) => {
        view.hands = {}
        legal.length = 0
        return { type: 'keep' }
      },
    }
    const rules = { ...highCard, policies: { easy: vandal, medium: vandal, hard: vandal } } as unknown as typeof highCard
    const step = startMatch(rules, config({ opponents: 1, position: 'last' }), 'neon')
    expect(Object.keys(step.match.state.hands)).toEqual(['cpu-1', 'you'])
    expect(step.log).toEqual([{ seq: 0, seat: 'cpu-1', action: { type: 'keep' } }])
  })

  it('throw when a policy picks an action outside legalActions', () => {
    const cheat: Policy<unknown, { type: string }> = { choose: () => ({ type: 'next' }) }
    const rules = { ...highCard, policies: { easy: cheat, medium: cheat, hard: cheat } } as typeof highCard
    expect(() => startMatch(rules, config({ position: 'last' }), 'neon')).toThrow(
      'policy for "cpu-1" chose {"type":"next"}, which is not in legalActions',
    )
  })
})

// A minimal all-CPU-capable game for loop edge cases the high card game can't reach.
type LoopState = { phase: GamePhase; toAct: string | null; moves: number; limit: number; settlesTo: GamePhase }
function loopGame(overrides: Partial<GameDefinition<null, LoopState, 'go', null, null>> = {}, limit = 3, settlesTo: GamePhase = 'settling') {
  const definition: GameDefinition<null, LoopState, 'go', null, null> = {
    id: 'loop',
    name: 'Loop',
    version: 1,
    deck: { id: 'none', build: () => [] },
    seats: { min: 2, max: 2 },
    defaultConfig: null,
    parseConfig: () => null,
    seatsFor: () => [
      { id: 'you', kind: 'human', name: 'You' },
      { id: 'bot', kind: 'cpu', name: 'Bot', difficulty: 'easy' },
    ],
    setup: () => ({ phase: 'playing', toAct: 'you', moves: 0, limit, settlesTo }),
    toAct: (s) => s.toAct,
    legalActions: (s, seat) => (s.toAct === seat ? ['go'] : []),
    apply: (s) => {
      const moves = s.moves + 1
      const done = moves >= s.limit
      return { state: { ...s, moves, toAct: done ? null : 'bot', phase: done ? s.settlesTo : s.phase }, events: [{ type: 'go', moves }] }
    },
    view: () => null,
    phase: (s) => s.phase,
    settle: (s) => [{ seat: 'you', delta: s.moves }],
    ...overrides,
  }
  const policy: Policy<null, 'go'> = { choose: () => 'go' }
  const rules: GameRules<null, LoopState, 'go', null, null> = {
    definition,
    policies: { easy: policy, medium: policy, hard: policy },
    meta: { title: 'Loop', description: 'Test loop', economy: 'score' },
  }
  return rules
}

describe('the CPU loop edges', () => {
  it('settles a round that ends straight in over', () => {
    const rules = loopGame({}, 2, 'over')
    const step = act(rules, startMatch(rules, null, 's').match, 'you', 'go')
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 2 }]])
    expect(types(step.events)).toEqual(['go', 'turn:bot', 'go'])
  })

  it('settles every action that lands in settling, even from settling', () => {
    const rules = loopGame({ setup: () => ({ phase: 'settling', toAct: 'you', moves: 0, limit: 1, settlesTo: 'settling' }) })
    const step = act(rules, startMatch(rules, null, 's').match, 'you', 'go')
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 1 }]])
  })

  it('does not settle when over follows settling', () => {
    const rules = loopGame({ setup: () => ({ phase: 'settling', toAct: 'you', moves: 0, limit: 1, settlesTo: 'over' }) })
    expect(act(rules, startMatch(rules, null, 's').match, 'you', 'go').rounds).toEqual([])
  })

  it('keeps running CPU turns after a CPU ends a round, reporting every round', () => {
    const script: Record<number, Pick<LoopState, 'phase' | 'toAct'>> = {
      1: { phase: 'playing', toAct: 'bot' },
      2: { phase: 'settling', toAct: 'bot' },
      3: { phase: 'settling', toAct: 'bot' },
      4: { phase: 'playing', toAct: 'you' },
    }
    const rules = loopGame({
      apply: (s) => ({ state: { ...s, moves: s.moves + 1, ...script[s.moves + 1] }, events: [{ type: 'go', moves: s.moves + 1 }] }),
    })
    const step = act(rules, startMatch(rules, null, 's').match, 'you', 'go')
    expect(types(step.events)).toEqual(['go', 'turn:bot', 'go', 'turn:bot', 'go', 'turn:bot', 'go'])
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 2 }], [{ seat: 'you', delta: 3 }]])
    expect(step.log.map((r) => `${r.seq}:${r.seat}`)).toEqual(['0:you', '1:bot', '2:bot', '3:bot'])
    expect(replay(rules, { seed: 's', config: null, log: step.log }).rounds).toEqual(step.rounds)
  })

  it('stops a runaway CPU loop', () => {
    const rules = loopGame({}, Number.POSITIVE_INFINITY)
    expect(() => act(rules, startMatch(rules, null, 's').match, 'you', 'go')).toThrow(
      `CPU loop ran ${MAX_CPU_ACTIONS} actions without reaching a human`,
    )
  })

  it('rejects a toAct that names a house or unknown seat, or a CPU with nothing to do', () => {
    const house = loopGame({ seatsFor: () => [{ id: 'you', kind: 'human', name: 'You' }, { id: 'bot', kind: 'house', name: 'Dealer' }] })
    expect(() => act(house, startMatch(house, null, 's').match, 'you', 'go')).toThrow('toAct returned house seat "bot"')
    const ghost = loopGame({ apply: (s) => ({ state: { ...s, toAct: 'ghost' }, events: [] }) })
    expect(() => act(ghost, startMatch(ghost, null, 's').match, 'you', 'go')).toThrow('toAct returned unknown seat "ghost"')
    const stuck = loopGame({ legalActions: (s, seat) => (seat === 'you' && s.toAct === 'you' ? ['go'] : []) })
    expect(() => act(stuck, startMatch(stuck, null, 's').match, 'you', 'go')).toThrow('cpu seat "bot" is to act but has no legal actions')
  })
})

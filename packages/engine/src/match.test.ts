import { describe, expect, it } from 'vitest'
import { IllegalActionError, NotYourTurnError } from './errors'
import { MAX_CPU_ACTIONS, act, applyOpening, autoAct, continueMatch, replay, replayTail, startMatch } from './match'
import { soloSeats } from './roster'
import { cpuRng } from './rng'
import { highCard, type HighCardConfig, type HighCardState } from './testing'
import type { GameDefinition, GameEvent, GamePhase, GameRules, Match, Policy, Step } from './types'

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
  const steps: Step<HighCardConfig, HighCardState, unknown>[] = [startMatch(rules, { config: c, seats: soloSeats(rules.definition, c), seed: seed })]
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
    const step = startMatch(highCard, { config: config({ opponents: 2 }), seats: soloSeats(highCard.definition, config({ opponents: 2 })), seed: 'neon' })
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
    const step = startMatch(highCard, { config: config({ opponents: 3, difficulty: 'medium', position: 'last' }), seats: soloSeats(highCard.definition, config({ opponents: 3, difficulty: 'medium', position: 'last' })), seed: 'neon' })
    expect(step.log).toEqual([
      { seq: 0, seat: 'cpu-1', action: { type: 'swap' }, kind: 'cpu' },
      { seq: 1, seat: 'cpu-2', action: { type: 'swap' }, kind: 'cpu' },
      { seq: 2, seat: 'cpu-3', action: { type: 'keep' }, kind: 'cpu' },
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
    expect(() => startMatch(noPolicies, { config: config(), seats: soloSeats(noPolicies.definition, config()), seed: 'neon' })).toThrow('no easy policy for cpu seat "cpu-1"')
    const tooMany = { ...highCard, definition: { ...highCard.definition, seats: { min: 2, max: 2 } } }
    expect(() => startMatch(tooMany, { config: config({ opponents: 2 }), seats: soloSeats(tooMany.definition, config({ opponents: 2 })), seed: 'neon' })).toThrow('high-card needs 2..2 seats, the roster returned 3')
    expect(() =>
      startMatch(highCard, {
        config: config(),
        seats: [
          { id: 'a', kind: 'human', name: 'A' },
          { id: 'a', kind: 'human', name: 'B' },
        ],
        seed: 'neon',
      }),
    ).toThrow('seat ids must be unique')
    expect(() =>
      startMatch(highCard, {
        config: config(),
        seats: [
          { id: 'you', kind: 'human', name: 'You' },
          { id: 'c', kind: 'cpu', name: 'C' },
        ],
        seed: 'neon',
      }),
    ).toThrow('cpu seat "c" has no difficulty')
  })
})

describe('act', () => {
  it('applies the human action, runs CPU turns, and settles the round', () => {
    const start = startMatch(highCard, { config: config({ opponents: 3, difficulty: 'medium', position: 'last' }), seats: soloSeats(highCard.definition, config({ opponents: 3, difficulty: 'medium', position: 'last' })), seed: 'neon' })
    const step = act(highCard, start.match, 'you', { type: 'keep' })
    expect(step.log).toEqual([{ seq: 3, seat: 'you', action: { type: 'keep' }, kind: 'human' }])
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
    const start = startMatch(highCard, { config: config({ opponents: 2 }), seats: soloSeats(highCard.definition, config({ opponents: 2 })), seed: 'neon' })
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
    const start = startMatch(highCard, { config: config({ opponents: 1 }), seats: soloSeats(highCard.definition, config({ opponents: 1 })), seed: 'neon' })
    const afterRound = act(highCard, start.match, 'you', { type: 'keep' }).match
    expect(() => act(highCard, afterRound, 'you', { type: 'keep' })).toThrow(IllegalActionError)
    const human = startMatch(highCard, { config: config({ position: 'last' }), seats: soloSeats(highCard.definition, config({ position: 'last' })), seed: 'neon' })
    const cpuFirst = { ...human.match, state: { ...human.match.state, turn: 0 } }
    expect(() => act(highCard, cpuFirst, 'you', { type: 'keep' })).toThrow(NotYourTurnError)
    expect(() => act(highCard, cpuFirst, 'you', { type: 'keep' })).toThrow('"you" is not to act ("cpu-1" is)')
  })

  it('refuses to act for a CPU seat, an unknown seat, or a match from other rules', () => {
    const { match } = startMatch(highCard, { config: config({ position: 'last' }), seats: soloSeats(highCard.definition, config({ position: 'last' })), seed: 'neon' })
    expect(() => act(highCard, match, 'cpu-1', { type: 'keep' })).toThrow('"cpu-1" is not a human seat')
    expect(() => act(highCard, match, 'ghost', { type: 'keep' })).toThrow('"ghost" is not a human seat')
    expect(() => act(highCard, { ...match, version: 0 }, 'you', { type: 'keep' })).toThrow(
      'match is high-card v0, rules are high-card v1',
    )
  })

  it('never mutates the match it is given', () => {
    const { match } = startMatch(highCard, { config: config({ opponents: 3 }), seats: soloSeats(highCard.definition, config({ opponents: 3 })), seed: 'neon' })
    const before = JSON.stringify(match)
    expect(() => act(highCard, deepFreeze(match), 'you', { type: 'swap' })).not.toThrow()
    expect(JSON.stringify(match)).toBe(before)
  })

  it('continues identically from a JSON round trip of the match, as the server stores it', () => {
    const { match } = startMatch(highCard, { config: config({ opponents: 2, difficulty: 'easy' }), seats: soloSeats(highCard.definition, config({ opponents: 2, difficulty: 'easy' })), seed: 'seed-7' })
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
      const replayed = replay(highCard, { seed: 'neon', config: c, seats: soloSeats(highCard.definition, c), log })
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
    expect(replay(noPolicies, { seed: 'neon', config: c, seats: soloSeats(highCard.definition, c), log: steps.flatMap((s) => s.log) }).match).toEqual(match)
  })

  it('rejects a log that skips a seq, has the wrong seat acting, or came from other rules', () => {
    const c = config({ opponents: 1 })
    const seats = soloSeats(highCard.definition, c)
    expect(() => replay(highCard, { seed: 'neon', config: c, seats, log: [], version: 2 })).toThrow('log is high-card v2, rules are high-card v1')
    expect(replay(highCard, { seed: 'neon', config: c, seats, log: [], version: 1 }).match.seq).toBe(0)
    expect(() => replay(highCard, { seed: 'neon', config: c, seats, log: [{ seq: 1, seat: 'you', action: { type: 'keep' } }] })).toThrow(
      'log entry 0 has seq 1',
    )
    expect(() => replay(highCard, { seed: 'neon', config: c, seats, log: [{ seq: 0, seat: 'cpu-1', action: { type: 'keep' } }] })).toThrow(
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
    const { match } = startMatch(rules, { config: config({ opponents: 1, position: 'last' }), seats: soloSeats(rules.definition, config({ opponents: 1, position: 'last' })), seed: 'neon' })
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
    const greedyRules = { ...highCard, policies: { easy: greedy, medium: greedy, hard: greedy } } as typeof highCard
    const lazyRules = { ...highCard, policies: { easy: lazy, medium: lazy, hard: lazy } } as typeof highCard
    const seats = soloSeats(highCard.definition, c)
    const a = startMatch(greedyRules, { config: c, seats, seed: 'neon' })
    const b = startMatch(lazyRules, { config: c, seats, seed: 'neon' })
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
    const step = startMatch(rules, { config: config({ opponents: 1, position: 'last' }), seats: soloSeats(rules.definition, config({ opponents: 1, position: 'last' })), seed: 'neon' })
    expect(Object.keys(step.match.state.hands)).toEqual(['cpu-1', 'you'])
    expect(step.log).toEqual([{ seq: 0, seat: 'cpu-1', action: { type: 'keep' }, kind: 'cpu' }])
  })

  it('throw when a policy picks an action outside legalActions', () => {
    const cheat: Policy<unknown, { type: string }> = { choose: () => ({ type: 'next' }) }
    const rules = { ...highCard, policies: { easy: cheat, medium: cheat, hard: cheat } } as typeof highCard
    expect(() => startMatch(rules, { config: config({ position: 'last' }), seats: soloSeats(rules.definition, config({ position: 'last' })), seed: 'neon' })).toThrow(
      'policy for "cpu-1" chose {"type":"next"}, which is not in legalActions',
    )
  })
})

const loopSeats = [
  { id: 'you', kind: 'human' as const, name: 'You' },
  { id: 'bot', kind: 'cpu' as const, name: 'Bot', difficulty: 'easy' as const },
]
const houseSeats = [
  { id: 'you', kind: 'human' as const, name: 'You' },
  { id: 'bot', kind: 'house' as const, name: 'Dealer' },
]

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
    house: [],
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
    const step = act(rules, startMatch(rules, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 2 }]])
    expect(types(step.events)).toEqual(['go', 'turn:bot', 'go'])
  })

  it('settles every action that lands in settling, even from settling', () => {
    const rules = loopGame({ setup: () => ({ phase: 'settling', toAct: 'you', moves: 0, limit: 1, settlesTo: 'settling' }) })
    const step = act(rules, startMatch(rules, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 1 }]])
  })

  it('does not settle when over follows settling', () => {
    const rules = loopGame({ setup: () => ({ phase: 'settling', toAct: 'you', moves: 0, limit: 1, settlesTo: 'over' }) })
    expect(act(rules, startMatch(rules, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go').rounds).toEqual([])
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
    const step = act(rules, startMatch(rules, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')
    expect(types(step.events)).toEqual(['go', 'turn:bot', 'go', 'turn:bot', 'go', 'turn:bot', 'go'])
    expect(step.rounds).toEqual([[{ seat: 'you', delta: 2 }], [{ seat: 'you', delta: 3 }]])
    expect(step.log.map((r) => `${r.seq}:${r.seat}`)).toEqual(['0:you', '1:bot', '2:bot', '3:bot'])
    expect(replay(rules, { seed: 's', config: null, seats: loopSeats, log: step.log }).rounds).toEqual(step.rounds)
  })

  it('stops a runaway CPU loop', () => {
    const rules = loopGame({}, Number.POSITIVE_INFINITY)
    expect(() => act(rules, startMatch(rules, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')).toThrow(
      `CPU loop ran ${MAX_CPU_ACTIONS} actions without reaching a human`,
    )
  })

  it('rejects a toAct that names a house or unknown seat, or a CPU with nothing to do', () => {
    const house = loopGame()
    expect(() => act(house, startMatch(house, { config: null, seats: houseSeats, seed: 's' }).match, 'you', 'go')).toThrow('toAct returned house seat "bot"')
    const ghost = loopGame({ apply: (s) => ({ state: { ...s, toAct: 'ghost' }, events: [] }) })
    expect(() => act(ghost, startMatch(ghost, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')).toThrow('toAct returned unknown seat "ghost"')
    const stuck = loopGame({ legalActions: (s, seat) => (seat === 'you' && s.toAct === 'you' ? ['go'] : []) })
    expect(() => act(stuck, startMatch(stuck, { config: null, seats: loopSeats, seed: 's' }).match, 'you', 'go')).toThrow('cpu seat "bot" is to act but has no legal actions')
  })
})

describe('opening, takeover, and tail replay', () => {
  const seats = [
    { id: 'you', kind: 'human' as const, name: 'You' },
    { id: 'bot', kind: 'cpu' as const, name: 'Bot', difficulty: 'easy' as const },
  ]

  it('uses the seat list it is given', () => {
    const swapped = [...seats].reverse()
    const step = startMatch(loopGame(), { config: null, seats: swapped, seed: 's' })
    expect(step.match.seats.map((s) => s.id)).toEqual(['bot', 'you'])
  })

  it('applyOpening plays opening as the first seat, logged human, then CPUs, and refuses a null opening', () => {
    const rules = loopGame({
      setup: () => ({ phase: 'playing', toAct: null, moves: 0, limit: 2, settlesTo: 'playing' }),
      opening: () => 'go',
      apply: (s) => ({
        state: { ...s, moves: s.moves + 1, toAct: s.moves === 0 ? 'bot' : null, phase: 'playing' as const },
        events: [{ type: 'go', moves: s.moves + 1 }],
      }),
    })
    const started = startMatch(rules, { config: null, seats, seed: 's' })
    expect(started.match.seq).toBe(0)
    const opened = applyOpening(rules, started.match)
    expect(opened.log.map((r) => `${r.seat}:${r.kind}`)).toEqual(['you:human', 'bot:cpu'])
    expect(types(opened.events)).toEqual(['go', 'turn:bot', 'go'])
    expect(() => applyOpening(loopGame(), started.match)).toThrow('opening is null')
  })

  it('continueMatch does not deal when nobody is to act', () => {
    const rules = loopGame({
      setup: () => ({ phase: 'playing', toAct: null, moves: 0, limit: 1, settlesTo: 'playing' }),
      opening: () => 'go',
    })
    const started = startMatch(rules, { config: null, seats, seed: 's' })
    const next = continueMatch(rules, started.match)
    expect(next.match.seq).toBe(0)
    expect(next.log).toEqual([])
  })

  it('autoAct uses the given difficulty while the seat is still human', () => {
    const calls: string[] = []
    const easy: Policy<null, 'go'> = {
      choose: () => {
        calls.push('easy')
        return 'go'
      },
    }
    const hard: Policy<null, 'go'> = {
      choose: () => {
        calls.push('hard')
        return 'go'
      },
    }
    const rules = loopGame({ legalActions: () => ['go'] })
    rules.policies = { easy, medium: easy, hard }
    const started = startMatch(rules, { config: null, seats, seed: 's' })
    const step = autoAct(rules, started.match, 'hard')
    expect(calls[0]).toBe('hard')
    expect(step.log[0]).toEqual({ seq: 0, seat: 'you', action: 'go', kind: 'human' })
    expect(step.log[1]?.kind).toBe('cpu')
    expect(calls[1]).toBe('easy')
  })

  it('replayTail applies a log without setup or a policy, and a human kind skips the turn event', () => {
    const started = startMatch(loopGame(), { config: null, seats, seed: 's' })
    const rules = loopGame()
    const boom = () => {
      throw new Error('should not run')
    }
    rules.policies = { easy: { choose: boom }, medium: { choose: boom }, hard: { choose: boom } }
    rules.definition = { ...rules.definition, setup: boom }
    const match: Match<null, LoopState> = {
      ...started.match,
      state: { ...started.match.state, toAct: 'bot' },
    }
    const step = replayTail(rules, match, [{ seq: 0, seat: 'bot', action: 'go', kind: 'human' }])
    expect(step.log[0]?.kind).toBe('human')
    expect(step.events.some((event) => event.type === 'turn')).toBe(false)
    const cpu = replayTail(rules, match, [{ seq: 0, seat: 'bot', action: 'go', kind: 'cpu' }])
    expect(types(cpu.events)[0]).toBe('turn:bot')
  })
})

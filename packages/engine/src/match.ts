import { NotYourTurnError } from './errors'
import { cpuRng, createRng, restoreRng } from './rng'
import type { ActionRecord, Difficulty, GamePhase, GameRules, Match, Seat, SeatId, Step } from './types'

/** A CPU loop longer than this is a rules bug (a cycle no human ever breaks). */
export const MAX_CPU_ACTIONS = 1000

// Every action that leaves the phase at 'settling' ends exactly one round, so Blackjack's bet from
// 'settling' that deals and resolves a natural in one action still counts.
function endsRound(before: GamePhase, after: GamePhase): boolean {
  return after === 'settling' || (after === 'over' && before !== 'settling' && before !== 'over')
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

// Policies get copies, so a policy that mutates its view can never reach game state.
const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function seatOf(match: Match, id: SeatId): Seat {
  const seat = match.seats.find((s) => s.id === id)
  if (!seat) throw new Error(`toAct returned unknown seat "${id}"`)
  if (seat.kind === 'house') throw new Error(`toAct returned house seat "${id}"`)
  return seat
}

function checkSeats<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, seats: Seat[]): void {
  const { min, max } = rules.definition.seats
  if (seats.length < min || seats.length > max) {
    throw new Error(`${rules.definition.id} needs ${min}..${max} seats, the roster returned ${seats.length}`)
  }
  if (new Set(seats.map((s) => s.id)).size !== seats.length) throw new Error('seat ids must be unique')
  for (const seat of seats) {
    if (seat.kind !== 'cpu') continue
    if (!seat.difficulty) throw new Error(`cpu seat "${seat.id}" has no difficulty`)
    if (!rules.policies?.[seat.difficulty]) throw new Error(`no ${seat.difficulty} policy for cpu seat "${seat.id}"`)
  }
}

function applyOne<C, S, A, V, F>(
  rules: GameRules<C, S, A, V, F>,
  step: Step<C, S, A>,
  seat: SeatId,
  action: A,
  kind?: 'human' | 'cpu',
): Step<C, S, A> {
  const def = rules.definition
  const { match } = step
  const rng = restoreRng(match.rng)
  const before = def.phase(match.state)
  const out = def.apply(match.state, seat, action, rng)
  const record: ActionRecord<A> = { seq: match.seq, seat, action, kind: kind ?? (seatOf(match, seat).kind === 'cpu' ? 'cpu' : 'human') }
  return {
    match: { ...match, state: out.state, rng: rng.state(), seq: match.seq + 1 },
    events: [...step.events, ...out.events],
    log: [...step.log, record],
    rounds: endsRound(before, def.phase(out.state)) ? [...step.rounds, def.settle(out.state)] : step.rounds,
  }
}

function runCpuTurns<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, step: Step<C, S, A>): Step<C, S, A> {
  const def = rules.definition
  for (let n = 0; ; n++) {
    const id = def.toAct(step.match.state)
    if (id === null) return step
    const seat = seatOf(step.match, id)
    if (seat.kind !== 'cpu') return step
    if (n === MAX_CPU_ACTIONS) throw new Error(`CPU loop ran ${MAX_CPU_ACTIONS} actions without reaching a human`)
    const policy = seat.difficulty && rules.policies?.[seat.difficulty]
    if (!policy) throw new Error(`no policy for cpu seat "${id}"`)
    const { state, seed, seq } = step.match
    const legal = def.legalActions(state, id)
    if (legal.length === 0) throw new Error(`cpu seat "${id}" is to act but has no legal actions`)
    const action = policy.choose(cloneJson(def.view(state, id)), cloneJson(legal), cpuRng(seed, seq))
    if (!legal.some((l) => jsonEqual(l, action))) {
      throw new Error(`policy for "${id}" chose ${JSON.stringify(action)}, which is not in legalActions`)
    }
    step = applyOne(rules, { ...step, events: [...step.events, { type: 'turn', seat: id }] }, id, action)
  }
}

export interface MatchInput<C> {
  config: C
  seats: Seat[]
  seed: string
}

function begin<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, input: MatchInput<C>): Step<C, S, A> {
  const def = rules.definition
  checkSeats(rules, input.seats)
  const rng = createRng(input.seed)
  const state = def.setup(input.config, input.seats, rng)
  const match: Match<C, S> = {
    gameId: def.id,
    version: def.version,
    seed: input.seed,
    config: input.config,
    seats: input.seats,
    state,
    rng: rng.state(),
    seq: 0,
  }
  return { match, events: [], log: [], rounds: [] }
}

function playedKind<C, S>(match: Match<C, S>, seat: SeatId, kind: 'human' | 'cpu' | undefined): 'human' | 'cpu' {
  if (kind) return kind
  return seatOf(match, seat).kind === 'cpu' ? 'cpu' : 'human'
}

function applyLogged<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, step: Step<C, S, A>, record: ActionRecord<A>): Step<C, S, A> {
  const def = rules.definition
  const toAct = def.toAct(step.match.state)
  if (toAct === null && matchesOpening(rules, step.match.state, record.action)) {
    const first = step.match.seats[0]
    if (!first || record.seat !== first.id) {
      throw new NotYourTurnError(`"${record.seat}" acted but nobody was to act`)
    }
    const kind = playedKind(step.match, record.seat, record.kind)
    const withTurn = kind === 'cpu' ? { ...step, events: [...step.events, { type: 'turn' as const, seat: record.seat }] } : step
    return applyOne(rules, withTurn, record.seat, record.action, kind)
  }
  if (toAct !== record.seat) {
    throw new NotYourTurnError(`"${record.seat}" acted but "${toAct}" was to act`)
  }
  const kind = playedKind(step.match, toAct, record.kind)
  const withTurn = kind === 'cpu' ? { ...step, events: [...step.events, { type: 'turn' as const, seat: toAct }] } : step
  return applyOne(rules, withTurn, record.seat, record.action, kind)
}

/** `config` is already parsed. `seats` is the roster. Runs setup, then CPU turns that come before a human. */
export function startMatch<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, input: MatchInput<C>): Step<C, S, A> {
  return runCpuTurns(rules, begin(rules, input))
}

/** True when `action` is the game's opening action for this state. */
export function matchesOpening<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, state: S, action: unknown): boolean {
  const opening = rules.definition.opening?.(state)
  return opening != null && jsonEqual(opening, action)
}

/** Applies `opening()` as seats[0], logged human, then the CPU cascade. Throws when opening is null. */
export function applyOpening<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, match: Match<C, S>): Step<C, S, A> {
  const action = rules.definition.opening?.(match.state) ?? null
  if (action === null) throw new Error('opening is null')
  const first = match.seats[0]
  if (!first) throw new Error('no seats')
  return continueMatchStep(rules, applyOne(rules, { match, events: [], log: [], rounds: [] }, first.id, action, 'human'))
}

/** One policy action for whoever is to act, even when that seat is still human, then the CPU cascade. */
export function autoAct<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, match: Match<C, S>, difficulty: Difficulty): Step<C, S, A> {
  const def = rules.definition
  const id = def.toAct(match.state)
  if (id === null) throw new Error('nobody is to act')
  const seat = seatOf(match, id)
  const policy = rules.policies?.[difficulty]
  if (!policy) throw new Error(`no ${difficulty} policy`)
  const legal = def.legalActions(match.state, id)
  if (legal.length === 0) throw new Error(`seat "${id}" is to act but has no legal actions`)
  const action = policy.choose(cloneJson(def.view(match.state, id)), cloneJson(legal), cpuRng(match.seed, match.seq))
  if (!legal.some((l) => jsonEqual(l, action))) {
    throw new Error(`policy for "${id}" chose ${JSON.stringify(action)}, which is not in legalActions`)
  }
  const kind = seat.kind === 'cpu' ? 'cpu' : 'human'
  const base: Step<C, S, A> = { match, events: kind === 'cpu' ? [{ type: 'turn', seat: id }] : [], log: [], rounds: [] }
  return runCpuTurns(rules, applyOne(rules, base, id, action, kind))
}

function continueMatchStep<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, step: Step<C, S, A>): Step<C, S, A> {
  return runCpuTurns(rules, step)
}

/** CPU turns until a human or nobody. Does not call `opening`. */
export function continueMatch<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, match: Match<C, S>): Step<C, S, A> {
  return continueMatchStep(rules, { match, events: [], log: [], rounds: [] })
}

/** Applies a human action, then runs CPU turns until no CPU seat is to act. Never mutates `match`. */
export function act<C, S, A, V, F>(rules: GameRules<C, S, A, V, F>, match: Match<C, S>, seat: SeatId, action: A): Step<C, S, A> {
  const def = rules.definition
  if (match.gameId !== def.id || match.version !== def.version) {
    throw new Error(`match is ${match.gameId} v${match.version}, rules are ${def.id} v${def.version}`)
  }
  const human = match.seats.find((s) => s.id === seat)
  if (human?.kind !== 'human') throw new Error(`"${seat}" is not a human seat`)
  const toAct = def.toAct(match.state)
  if (toAct !== seat) throw new NotYourTurnError(`"${seat}" is not to act (${toAct === null ? 'nobody is' : `"${toAct}" is`})`)
  return runCpuTurns(rules, applyOne(rules, { match, events: [], log: [], rounds: [] }, seat, action))
}

/**
 * Rebuilds a match from its seed, config, and action log without running a policy. Its events and rounds
 * equal the concatenation of every live step's.
 */
export function replay<C, S, A, V, F>(
  rules: GameRules<C, S, A, V, F>,
  input: MatchInput<C> & { log: readonly ActionRecord<A>[]; version?: number },
): Step<C, S, A> {
  const def = rules.definition
  if (input.version !== undefined && input.version !== def.version) {
    throw new Error(`log is ${def.id} v${input.version}, rules are ${def.id} v${def.version}`)
  }
  let step = begin(rules, input)
  for (const [i, record] of input.log.entries()) {
    if (record.seq !== i) throw new Error(`log entry ${i} has seq ${record.seq}`)
    try {
      step = applyLogged(rules, step, record)
    } catch (err) {
      if (err instanceof NotYourTurnError) {
        throw new NotYourTurnError(`log entry ${i}: ${err.message}`)
      }
      throw err
    }
  }
  return step
}

/** Applies a log onto an existing match. Does not call setup or a policy. */
export function replayTail<C, S, A, V, F>(
  rules: GameRules<C, S, A, V, F>,
  match: Match<C, S>,
  log: readonly ActionRecord<A>[],
): Step<C, S, A> {
  const def = rules.definition
  if (match.gameId !== def.id || match.version !== def.version) {
    throw new Error(`match is ${match.gameId} v${match.version}, rules are ${def.id} v${def.version}`)
  }
  let step: Step<C, S, A> = { match, events: [], log: [], rounds: [] }
  for (const [i, record] of log.entries()) {
    if (record.seq !== step.match.seq) throw new Error(`log entry ${i} has seq ${record.seq}`)
    step = applyLogged(rules, step, record)
  }
  return step
}

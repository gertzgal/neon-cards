import { createRng, IllegalActionError, replay, type ActionRecord, type Rng, type SeatId } from '@neon-cards/engine'
import { expect } from 'vitest'
import { rules } from './index'
import type { EkAction, EkCard, EkEvent, EkState, RigName, Title } from './types'

export const ek = rules.definition
export const HUMAN = 'you'

export interface Session {
  seed: string
  config: ReturnType<typeof ek.parseConfig>
  seats: ReturnType<typeof ek.seatsFor>
  rng: Rng
  state: EkState
  log: ActionRecord<EkAction>[]
  events: EkEvent[]
}

export function openSession(seed: string, players: 2 | 3 | 4 = 2, rig?: RigName): Session {
  const opponents = (players - 1) as 1 | 2 | 3
  const config = ek.parseConfig(rig ? { opponents, difficulty: 'medium', rig } : { opponents, difficulty: 'medium' })
  const seats = ek.seatsFor(config)
  const rng = createRng(seed)
  const state = ek.setup(config, seats, rng)
  return { seed, config, seats, rng, state, log: [], events: [] }
}

export function lab(players: 2 | 3 | 4 = 2, seed = 'ek-lab'): EkState {
  return openSession(seed, players).state
}

export function cardsOf(state: EkState): EkCard[] {
  const cards: EkCard[] = []
  for (const seat of state.order) cards.push(...(state.seats[seat]?.hand ?? []))
  cards.push(...state.draw, ...state.discard, ...state.removed)
  if (state.pending?.kind === 'defuse') cards.push(state.pending.kitten)
  return cards
}

export function cardIds(state: EkState): string[] {
  return cardsOf(state).map((card) => card.id).sort()
}

export function assertConserved(before: EkState, after: EkState): void {
  const ids = cardIds(after)
  expect(ids).toEqual(cardIds(before))
  expect(new Set(ids).size).toBe(56)
  expect(after.removed.map((card) => card.id).sort()).toEqual(before.removed.map((card) => card.id).sort())
}

export function actOn(state: EkState, seat: SeatId, action: EkAction, rng: Rng = createRng('act-on')): { state: EkState; events: EkEvent[] } {
  const before = structuredClone(state)
  let out: { state: EkState; events: { type: string }[] }
  try {
    out = ek.apply(state, seat, action, rng)
  } catch (error) {
    expect(state).toEqual(before)
    throw error
  }
  expect(state).toEqual(before)
  assertConserved(before, out.state)
  return { state: out.state, events: out.events as EkEvent[] }
}

export function rejects(state: EkState, seat: SeatId, action: EkAction): void {
  const before = structuredClone(state)
  expect(() => ek.apply(state, seat, action, createRng('reject'))).toThrow(IllegalActionError)
  expect(state).toEqual(before)
}

export function step(session: Session, action: EkAction, seat: SeatId | null = ek.toAct(session.state)): { state: EkState; events: EkEvent[] } {
  if (!seat) throw new Error('nobody to act')
  const out = actOn(session.state, seat, action, session.rng)
  session.log.push({ seq: session.log.length, seat, action })
  session.events.push(...out.events)
  session.state = out.state
  return out
}

export function expectReplay(session: Session): void {
  const out = replay(rules, { seed: session.seed, config: session.config, seats: rules.definition.seatsFor(session.config), log: session.log })
  expect(out.events.filter((event) => event.type !== 'turn')).toEqual(session.events)
  expect(out.match.state.draw.map((card) => card.id)).toEqual(session.state.draw.map((card) => card.id))
  for (const seat of session.state.order) {
    const left = out.match.state.seats[seat]?.hand.map((card) => card.id)
    const right = session.state.seats[seat]?.hand.map((card) => card.id)
    expect(left).toEqual(right)
  }
}

export function pluck(state: EkState, pred: (card: EkCard, seat: SeatId | null) => boolean): EkCard {
  for (const seat of state.order) {
    const hand = state.seats[seat]?.hand
    if (!hand) continue
    const index = hand.findIndex((card) => pred(card, seat))
    if (index >= 0) return hand.splice(index, 1)[0] as EkCard
  }
  for (const zone of ['draw', 'discard', 'removed'] as const) {
    const pile = state[zone]
    const index = pile.findIndex((card) => pred(card, null))
    if (index >= 0) return pile.splice(index, 1)[0] as EkCard
  }
  throw new Error('no card matches')
}

export function take(state: EkState, title: Title, skip?: SeatId): EkCard {
  return pluck(state, (card, seat) => card.face.title === title && seat !== skip)
}

export function give(state: EkState, seat: SeatId, title: Title): EkCard {
  const pred = (card: EkCard) => card.face.title === title
  for (const zone of ['draw', 'discard', 'removed'] as const) {
    const pile = state[zone]
    const index = pile.findIndex(pred)
    const card = index >= 0 ? pile.splice(index, 1)[0] : undefined
    if (card) {
      state.seats[seat]?.hand.push(card)
      return card
    }
  }
  const card = take(state, title, seat)
  state.seats[seat]?.hand.push(card)
  return card
}

export function replaceHand(state: EkState, seat: SeatId, titles: readonly Title[]): void {
  const hand = state.seats[seat]?.hand
  if (!hand) throw new Error(`unknown seat ${seat}`)
  state.draw.push(...hand)
  hand.length = 0
  for (const title of titles) hand.push(take(state, title, seat))
}

export function strip(state: EkState, seat: SeatId, title: Title): void {
  const hand = state.seats[seat]?.hand
  if (!hand) return
  const keep: EkCard[] = []
  for (const card of hand) {
    if (card.face.title === title) state.draw.push(card)
    else keep.push(card)
  }
  hand.length = 0
  hand.push(...keep)
}

export function stripAll(state: EkState, title: Title): void {
  for (const seat of state.order) strip(state, seat, title)
}

export function setTop(state: EkState, title: Title): EkCard {
  const card = take(state, title)
  state.draw.unshift(card)
  return card
}

export function seatTurn(state: EkState, seat: SeatId, owed = 0): void {
  state.turn = seat
  state.owed = owed
  state.pending = { kind: 'turn', seat }
  state.winner = null
}

export function holds(state: EkState, seat: SeatId, title: Title): boolean {
  return state.seats[seat]?.hand.some((card) => card.face.title === title) ?? false
}

export function titlesOf(cards: readonly { face: { title: Title } }[]): Title[] {
  return cards.map((card) => card.face.title)
}

/** A seeded legal actor. It reads full state only to stay inside legalActions. */
export function choose(state: EkState, rng: Rng): { seat: SeatId; action: EkAction } {
  const seat = ek.toAct(state)
  if (!seat) throw new Error('no seat to act')
  const legal = ek.legalActions(state, seat)
  const pending = state.pending
  if (!pending || legal.length === 0) throw new Error(`empty menu for ${seat}`)
  if (pending.kind === 'defuse') return { seat, action: legal[rng.int(legal.length)] as EkAction }
  if (pending.kind === 'give') return { seat, action: legal[0] as EkAction }
  if (pending.kind === 'nope') {
    const nope = legal.find((action) => action.type === 'nope')
    if (nope && pending.nopes < 2) return { seat, action: nope }
    return { seat, action: legal[0] as EkAction }
  }
  if (rng.int(4) === 0) {
    const pair = legal.find((action) => action.type === 'pair' && action.title !== 'defuse' && action.title !== 'kitten')
    if (pair) return { seat, action: pair }
  }
  if (rng.int(3) === 0) {
    const play = legal.find((action) => action.type === 'play' || action.type === 'favor')
    if (play) return { seat, action: play }
  }
  const draw = legal.find((action) => action.type === 'draw')
  if (!draw) throw new Error('turn has no draw')
  return { seat, action: draw }
}

export interface Played {
  session: Session
  defuses: number
  maxNopes: number
}

export function playGame(seed: string, players: 2 | 3 | 4, rig?: RigName, cap = 4000): Played {
  const session = openSession(seed, players, rig)
  const actor = createRng(`${seed}:actor`)
  const removedIds = session.state.removed.map((card) => card.id).sort()
  let guard = 0
  while (session.state.pending) {
    if (guard === cap) throw new Error(`${seed} did not end in ${cap} actions`)
    guard++
    const choice = choose(session.state, actor)
    step(session, choice.action, choice.seat)
    expect(session.state.removed.map((card) => card.id).sort()).toEqual(removedIds)
  }
  const defuses = session.events.filter((event) => event.type === 'Defused').length
  const maxNopes = session.events.reduce((max, event) => (event.type === 'Noped' ? Math.max(max, event.nopes) : max), 0)
  return { session, defuses, maxNopes }
}

export function keyHits(value: unknown, keyName: string, path = '$'): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => keyHits(item, keyName, `${path}[${index}]`))
  const hits: string[] = []
  for (const [key, child] of Object.entries(value)) {
    if (key === keyName) hits.push(`${path}.${key}`)
    hits.push(...keyHits(child, keyName, `${path}.${key}`))
  }
  return hits
}

export { IllegalActionError }

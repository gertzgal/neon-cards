import { createRng, type Rng, type SeatId } from '@neon-cards/engine'
import { faceKey } from './cards'
import { flip7 } from './definition'
import type { F7Card, Flip7Action, Flip7Event, Flip7Face, Flip7State } from './types'

let nextId = 0

/** A loose card for tests, from a face key ("7", "+4", "x2", "F", "T", "S"). */
export function card(key: string): F7Card {
  return { id: `t-${nextId++}`, deck: 'flip7', face: faceOf(key) }
}

export function faceOf(key: string): Flip7Face {
  if (key === 'x2') return { kind: 'modifier', op: 'times', value: 2 }
  if (key.startsWith('+')) return { kind: 'modifier', op: 'add', value: Number(key.slice(1)) as 2 | 4 | 6 | 8 | 10 }
  if (key === 'F') return { kind: 'action', action: 'freeze' }
  if (key === 'T') return { kind: 'action', action: 'flipThree' }
  if (key === 'S') return { kind: 'action', action: 'secondChance' }
  return { kind: 'number', value: Number(key) as 0 }
}

/** A table of 1 + `opponents` seats, rigged, before the first deal. Dealer is the last seat. */
export function table(rig: string, opponents: 1 | 2 | 3 = 2, seed = 'test'): { s: Flip7State; rng: Rng } {
  const config = flip7.parseConfig({ opponents, rig })
  const rng = createRng(seed)
  return { s: flip7.setup(config, flip7.seatsFor(config), rng), rng }
}

export interface Game {
  s: Flip7State
  rng: Rng
  /** Every event so far. */
  log: Flip7Event[]
  /** The last action's events. */
  last: Flip7Event[]
}

export function game(rig: string, opponents: 1 | 2 | 3 = 2): Game {
  const { s, rng } = table(rig, opponents)
  const g: Game = { s, rng, log: [], last: [] }
  return play(g, { type: 'nextRound' })
}

/** Applies one action for whoever is to act (or `seat`), asserting it is theirs to take. */
export function play(g: Game, action: Flip7Action, seat?: SeatId): Game {
  const who = seat ?? flip7.toAct(g.s)
  if (who === null) throw new Error('nobody is to act')
  const out = flip7.apply(g.s, who, action, g.rng)
  const last = out.events as Flip7Event[]
  return { s: out.state, rng: g.rng, log: [...g.log, ...last], last }
}

export const types = (events: Flip7Event[]) => events.map((e) => e.type)
export const keys = (cards: F7Card[]) => cards.map((c) => faceKey(c.face))
export const lineKeys = (s: Flip7State, seat: SeatId) => keys(s.rounds[seat]?.line.numbers ?? [])
export const status = (s: Flip7State, seat: SeatId) => s.rounds[seat]?.status

/** Puts loose cards in front of a seat (test-only state surgery; the state is plain JSON). */
export function give(s: Flip7State, seat: SeatId, ...cardKeys: string[]): Flip7State {
  const next = JSON.parse(JSON.stringify(s)) as Flip7State
  const line = next.rounds[seat]?.line
  if (!line) throw new Error(`no seat ${seat}`)
  for (const k of cardKeys) {
    const c = card(k)
    if (c.face.kind === 'number') line.numbers.push(c)
    else if (c.face.kind === 'modifier') line.modifiers.push(c)
    else if (c.face.action === 'secondChance') line.secondChance = c
    else throw new Error('give only numbers, modifiers, and S')
  }
  return next
}

/** Sets the faces a seat draws next. */
export function rigNext(s: Flip7State, seat: SeatId, ...faceKeys: string[]): Flip7State {
  return { ...s, rig: { ...s.rig, [seat]: faceKeys } }
}

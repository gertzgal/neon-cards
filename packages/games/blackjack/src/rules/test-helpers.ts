import type { Rng } from '../contract'
import { blackjack, defaultConfig } from './definition'
import type { BlackjackAction, BlackjackConfig, BlackjackEvent, BlackjackState } from './types'

export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, int: (n) => Math.floor(next() * n), state: () => String(a) }
}

export const SEAT = 'p1'

export function newGame(config: Partial<BlackjackConfig> = {}, seed = 1) {
  const rng = seededRng(seed)
  const state = blackjack.setup({ ...defaultConfig, ...config }, [{ id: SEAT, kind: 'human', name: 'You' }], rng)
  return { state, rng }
}

export function play(state: BlackjackState, rng: Rng, ...actions: BlackjackAction[]) {
  const events: BlackjackEvent[] = []
  for (const action of actions) {
    const out = blackjack.apply(state, SEAT, action, rng)
    state = out.state
    events.push(...(out.events as BlackjackEvent[]))
  }
  return { state, rng, events, view: blackjack.view(state, SEAT) }
}

/** Plays a rigged round from a fresh game: bet, then the given actions. */
export function rigged(rig: string, bet: number, actions: BlackjackAction['type'][] = [], config: Partial<BlackjackConfig> = {}) {
  const { state, rng } = newGame({ ...config, rig })
  return play(state, rng, { type: 'bet', amount: bet }, ...actions.map((type) => ({ type }) as BlackjackAction))
}

export const types = (events: BlackjackEvent[]) => events.map((e) => e.type)
export const codes = (cards: { face: { rank: string; suit: string } | null }[]) =>
  cards.map((c) => (c.face ? c.face.rank + c.face.suit : '??'))

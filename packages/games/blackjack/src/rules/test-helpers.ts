import { createRng, type Rng } from '@neon-cards/engine'
import { blackjack, defaultConfig } from './definition'
import type { BlackjackAction, BlackjackConfig, BlackjackEvent, BlackjackState } from './types'

export const seededRng = (seed: number): Rng => createRng(`blackjack-test-${seed}`)

export const SEAT = 'player'

export function newGame(config: Partial<BlackjackConfig> = {}, seed = 1) {
  const rng = seededRng(seed)
  const full = { ...defaultConfig, ...config }
  const state = blackjack.setup(full, blackjack.seatsFor(full), rng)
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

import type { Policy, Rng } from '@neon-cards/engine'
import { hasAnyCard } from '../cards'
import type { Flip7Action, Flip7View } from '../types'
import { lineState, pickTarget, pickType, seat, targetsOf } from './counting'

export const EASY_MIN_THRESHOLD = 15
export const EASY_THRESHOLD_SPAN = 11
export const EASY_WHIM = 0.1

/** FNV-1a, so the threshold is a pure function of the view. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * Easy's stay threshold T = 15..25, fixed for a seat for the whole game (§8.4). Policies are stateless,
 * so T hashes what stays put all game: the seat, the seat order, and the first round's dealer
 * (the dealer moves one seat clockwise per round).
 */
export function easyThreshold(view: Flip7View): number {
  const n = view.order.length
  const firstDealer = view.order[(((view.order.indexOf(view.dealer) - (view.round - 1)) % n) + n) % n]
  return EASY_MIN_THRESHOLD + (hash(`${view.me}|${view.order.join(',')}|${firstDealer}`) % EASY_THRESHOLD_SPAN)
}

function randomOpponent(view: Flip7View, legal: Flip7Action[], rng: Rng): Flip7Action {
  const targets = targetsOf(legal)
  const opps = targets.filter((id) => id !== view.me)
  const pool = opps.length > 0 ? opps : targets
  return pickTarget(legal, pool[rng.int(pool.length)])
}

/** Risk-blind: hits until its numbers reach T, with a 10% whim. */
export const easy: Policy<Flip7View, Flip7Action> = {
  choose(view, legal, rng) {
    const p = view.pending
    if (!p || p.seat !== view.me) return legal[0] as Flip7Action
    switch (p.kind) {
      case 'hitOrStay': {
        const line = seat(view, view.me).line
        if (!hasAnyCard(line)) return pickType(legal, 'hit')
        if (rng.next() < EASY_WHIM) return legal[rng.int(legal.length)] as Flip7Action
        return pickType(legal, lineState(line).sum < easyThreshold(view) ? 'hit' : 'stay')
      }
      case 'target':
      case 'assign':
        return randomOpponent(view, legal, rng)
      case 'passSecondChance':
        return legal[rng.int(legal.length)] as Flip7Action
    }
  },
}

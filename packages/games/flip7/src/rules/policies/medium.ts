import type { Policy } from '@neon-cards/engine'
import { hasAnyCard, TARGET_SCORE } from '../cards'
import type { Flip7Action, Flip7View } from '../types'
import { argmax, lineState, pBust, pickTarget, pickType, seat, targetsOf, valueOf, visiblePile } from './counting'

export const MEDIUM_SC_STAY_VALUE = 35
export const MEDIUM_BUST_LIMIT = 0.25
export const MEDIUM_CHASE_LIMIT = 0.4
export const MEDIUM_PROTECT_LIMIT = 0.1
export const MEDIUM_CHASE_UNIQUES = 6
export const MEDIUM_FLIP7_GIFT_UNIQUES = 5
export const MEDIUM_SELF_FLIP3_BUST = 0.2

function hitOrStay(view: Flip7View, legal: Flip7Action[]): Flip7Action {
  const me = seat(view, view.me)
  if (!hasAnyCard(me.line)) return pickType(legal, 'hit')
  const st = lineState(me.line)
  const value = valueOf(st)
  if (st.sc) return pickType(legal, value >= MEDIUM_SC_STAY_VALUE ? 'stay' : 'hit')
  let limit = MEDIUM_BUST_LIMIT
  if (st.count === MEDIUM_CHASE_UNIQUES) limit = MEDIUM_CHASE_LIMIT
  if (me.total + value >= TARGET_SCORE) limit = MEDIUM_PROTECT_LIMIT
  return pickType(legal, pBust(st, visiblePile(view)) < limit ? 'hit' : 'stay')
}

function freeze(view: Flip7View, legal: Flip7Action[]): Flip7Action {
  const opps = targetsOf(legal).filter((id) => id !== view.me).map((id) => seat(view, id))
  const best = argmax(opps, (o) => o.total * 100 + lineState(o.line).count)
  return pickTarget(legal, best?.id ?? view.me)
}

function flipThree(view: Flip7View, legal: Flip7Action[]): Flip7Action {
  const targets = targetsOf(legal)
  const opps = targets.filter((id) => id !== view.me).map((id) => ({ id, uniques: lineState(seat(view, id).line).count }))
  const safe = opps.filter((o) => o.uniques < MEDIUM_FLIP7_GIFT_UNIQUES)
  const best = argmax(safe, (o) => o.uniques)
  if (best) return pickTarget(legal, best.id)
  const mine = lineState(seat(view, view.me).line)
  if (targets.includes(view.me) && (opps.length === 0 || pBust(mine, visiblePile(view)) < MEDIUM_SELF_FLIP3_BUST)) {
    return pickTarget(legal, view.me)
  }
  return pickTarget(legal, argmax(opps, (o) => -o.uniques)?.id)
}

function passSecondChance(view: Flip7View, legal: Flip7Action[]): Flip7Action {
  const best = argmax(targetsOf(legal), (id) => -seat(view, id).total)
  return pickTarget(legal, best)
}

/** A bust-probability threshold over the cards it can see on the table (§8.5). */
export const medium: Policy<Flip7View, Flip7Action> = {
  choose(view, legal) {
    const p = view.pending
    if (!p || p.seat !== view.me) return legal[0] as Flip7Action
    switch (p.kind) {
      case 'hitOrStay':
        return hitOrStay(view, legal)
      case 'target':
      case 'assign':
        return p.card.face.kind === 'action' && p.card.face.action === 'freeze' ? freeze(view, legal) : flipThree(view, legal)
      case 'passSecondChance':
        return passSecondChance(view, legal)
    }
  },
}

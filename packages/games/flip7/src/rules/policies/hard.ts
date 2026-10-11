import type { Policy } from '@neon-cards/engine'
import { hasAnyCard, TARGET_SCORE } from '../cards'
import type { Flip7Action, Flip7View, SeatView } from '../types'
import {
  argmax,
  drawPile,
  flipWithin,
  hitValue,
  isLocked,
  lineState,
  opponents,
  pBust,
  pickTarget,
  pickType,
  projected,
  seat,
  targetsOf,
  valueOf,
  type Counts,
} from './counting'

export const HARD_DEPTH = 3
export const HARD_FLIP_THREE_DRAWS = 3
export const HARD_LEAD = 40
export const HARD_LEAD_MARGIN = 3
export const HARD_TRAIL = 60
export const HARD_LATE_LEADER = 150
export const HARD_TRAIL_MARGIN = -3
export const HARD_FREEZE_UNIQUE_WEIGHT = 8
export const HARD_FREEZE_SC_WEIGHT = 6
export const HARD_FREEZE_LINE_WEIGHT = 0.5
export const HARD_FREEZE_LET_GAMBLE = 0.5
export const HARD_SELF_FREEZE_BUST = 0.35
export const HARD_SELF_FREEZE_VALUE = 20

function hitOrStay(view: Flip7View, legal: Flip7Action[]): Flip7Action {
  const me = seat(view, view.me)
  if (!hasAnyCard(me.line)) return pickType(legal, 'hit')
  const d = drawPile(view)
  const st = lineState(me.line)
  const stay = valueOf(st)
  const mine = projected(me)
  const opps = opponents(view)
  const lockedBest = Math.max(0, ...opps.filter(isLocked).map(projected))
  const oppBest = Math.max(0, ...opps.map(projected))

  // Locking in a likely win: nobody can catch this from where they are now.
  if (mine >= TARGET_SCORE && mine > oppBest) return pickType(legal, 'stay')
  // A locked opponent already wins if I stay; only hitting can change that.
  if (lockedBest >= TARGET_SCORE && mine <= lockedBest && pBust(st, d) < 1) return pickType(legal, 'hit')

  const leaderTotal = Math.max(0, ...opps.map((o) => o.total))
  let margin = 0
  if (mine - oppBest >= HARD_LEAD) margin += HARD_LEAD_MARGIN
  if (leaderTotal >= HARD_LATE_LEADER && leaderTotal - me.total >= HARD_TRAIL) margin += HARD_TRAIL_MARGIN
  return pickType(legal, hitValue(st, d, HARD_DEPTH) > stay + margin ? 'hit' : 'stay')
}

function freeze(view: Flip7View, legal: Flip7Action[], d: Counts): Flip7Action {
  const targets = targetsOf(legal)
  const opps = targets.filter((id) => id !== view.me).map((id) => seat(view, id))
  if (opps.length === 0) return pickTarget(legal, view.me)
  // Freezing a seat that already projects to the target would bank its win, and a seat likely to bust should be left to gamble.
  const worth = opps.filter((o) => projected(o) < TARGET_SCORE && pBust(lineState(o.line), d) <= HARD_FREEZE_LET_GAMBLE)
  const best = argmax(worth, (o) => {
    const st = lineState(o.line)
    const threat = projected(o) + HARD_FREEZE_UNIQUE_WEIGHT * st.count + (st.sc ? HARD_FREEZE_SC_WEIGHT : 0)
    return threat - HARD_FREEZE_LINE_WEIGHT * o.roundValue
  })
  if (best) return pickTarget(legal, best.id)
  const me = lineState(seat(view, view.me).line)
  if (targets.includes(view.me) && valueOf(me) >= HARD_SELF_FREEZE_VALUE && pBust(me, d) > HARD_SELF_FREEZE_BUST) {
    return pickTarget(legal, view.me)
  }
  return pickTarget(legal, argmax(opps, (o) => (projected(o) >= TARGET_SCORE ? -Infinity : -o.roundValue))?.id)
}

/** How much a Flip Three on `t` helps me: my expected gain on myself, an opponent's expected loss on them. */
function flipThreeValue(view: Flip7View, t: SeatView, d: Counts): number {
  const st = lineState(t.line)
  const gain = flipWithin(HARD_FLIP_THREE_DRAWS, st, d).value - valueOf(st)
  return t.id === view.me ? gain : -gain
}

function flipThree(view: Flip7View, legal: Flip7Action[], d: Counts): Flip7Action {
  const targets = targetsOf(legal).map((id) => seat(view, id))
  return pickTarget(legal, argmax(targets, (t) => flipThreeValue(view, t, d))?.id)
}

function passSecondChance(view: Flip7View, legal: Flip7Action[], d: Counts): Flip7Action {
  const best = argmax(targetsOf(legal), (id) => {
    const o = seat(view, id)
    return -(pBust(lineState(o.line), d) * o.roundValue * 1000 + o.total)
  })
  return pickTarget(legal, best)
}

/** Expectimax over the exact draw pile plus scoreboard awareness and counted targeting (§8.6). */
export const hard: Policy<Flip7View, Flip7Action> = {
  choose(view, legal) {
    const p = view.pending
    if (!p || p.seat !== view.me) return legal[0] as Flip7Action
    switch (p.kind) {
      case 'hitOrStay':
        return hitOrStay(view, legal)
      case 'target':
      case 'assign': {
        const d = drawPile(view)
        return p.card.face.kind === 'action' && p.card.face.action === 'freeze' ? freeze(view, legal, d) : flipThree(view, legal, d)
      }
      case 'passSecondChance':
        return passSecondChance(view, legal, drawPile(view))
    }
  },
}

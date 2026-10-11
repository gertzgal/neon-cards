import type { SeatId } from '@neon-cards/engine'
import { emptyLine, hasAnyCard, roundValue, TARGET_SCORE } from '../cards'
import { card, faceOf } from '../test-helpers'
import { seat } from './counting'
import type { F7Card, Flip7Action, Flip7View, Line, Pending, SeatStatus, SeatView } from '../types'

export interface SeatSpec {
  cards?: string[]
  status?: SeatStatus
  total?: number
}

export interface ViewSpec {
  me?: SeatId
  seats: Record<SeatId, SeatSpec>
  discard?: string[]
  /** Defaults to every card not on the table or in the discard. */
  drawCount?: number
  /** A face key: 'F' or 'T' for target / assign, 'S' for passSecondChance. Omit for hitOrStay. */
  pending?: { kind: Pending['kind']; card?: string }
}

function lineOf(keys: string[]): Line {
  const line = emptyLine()
  for (const k of keys) {
    const c = card(k)
    if (c.face.kind === 'number') line.numbers.push(c)
    else if (c.face.kind === 'modifier') line.modifiers.push(c)
    else if (c.face.action === 'secondChance') line.secondChance = c
    else line.freeze = c
  }
  return line
}

/** A hand-built view for policy tests; seat order is the key order of `seats`. */
export function makeView(spec: ViewSpec): Flip7View {
  const me = spec.me ?? 'cpu-1'
  const order = Object.keys(spec.seats)
  const seats: Record<SeatId, SeatView> = {}
  let onTable = 0
  for (const id of order) {
    const s = spec.seats[id] as SeatSpec
    const keys = s.cards ?? []
    onTable += keys.length
    const line = lineOf(keys)
    const round = { status: s.status ?? 'active', line, flip7: false }
    seats[id] = { id, ...round, roundValue: roundValue(round), total: s.total ?? 0 }
  }
  const p = spec.pending ?? { kind: 'hitOrStay' }
  const pendingCard: F7Card = card(p.card ?? 'F')
  const pending: Pending = p.kind === 'hitOrStay' ? { kind: 'hitOrStay', seat: me } : { kind: p.kind, seat: me, card: pendingCard }
  const active = order.filter((id) => seats[id]?.status === 'active')
  const legalTargets =
    p.kind === 'hitOrStay' ? [] : p.kind === 'passSecondChance' ? active.filter((id) => id !== me && !seats[id]?.line.secondChance) : active
  const discard = (spec.discard ?? []).map(faceOf)
  const limbo = p.kind === 'target' || p.kind === 'passSecondChance' || p.kind === 'assign' ? [pendingCard.face] : []
  return {
    me,
    order,
    seats,
    dealer: order[order.length - 1] as SeatId,
    round: 1,
    stage: 'playing',
    drawCount: spec.drawCount ?? 94 - onTable - discard.length - limbo.length,
    discard,
    limbo,
    flipThree: null,
    pending,
    legalTargets,
    lastScores: null,
    winner: null,
    tiebreak: false,
    targetScore: TARGET_SCORE,
  }
}

/** The legal menu the rules would offer for a view built by makeView. */
export function legalFor(view: Flip7View): Flip7Action[] {
  const p = view.pending
  if (!p) return [{ type: 'nextRound' }]
  switch (p.kind) {
    case 'hitOrStay':
      return hasAnyCard(seat(view, view.me).line) ? [{ type: 'hit' }, { type: 'stay' }] : [{ type: 'hit' }]
    case 'target':
      return view.legalTargets.map((to) => ({ type: 'target', to }))
    case 'passSecondChance':
      return view.legalTargets.map((to) => ({ type: 'passSecondChance', to }))
    case 'assign':
      return view.legalTargets.map((to) => ({ type: 'assign', cardId: p.card.id, to }))
  }
}

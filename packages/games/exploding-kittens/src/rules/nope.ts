import type { Rng, SeatId } from '@neon-cards/engine'
import { IllegalActionError } from '@neon-cards/engine'
import type { Effect, EkEvent, EkState } from './types'

/** Shared with definition.ts. The deck rng is unused here; Nope never shuffles or steals. */
export interface NopeCtx {
  s: EkState
  events: EkEvent[]
  rng: Rng
}

const holdsNope = (s: EkState, id: SeatId) => s.seats[id]?.hand.some((card) => card.face.title === 'nope') ?? false

function nextSeat(s: EkState, id: SeatId): SeatId {
  const index = s.order.indexOf(id)
  return s.order[(index + 1) % s.order.length] as SeatId
}

/** Seat order starting at `start` and wrapping once. */
function clockwiseFrom(s: EkState, start: SeatId): SeatId[] {
  const index = s.order.indexOf(start)
  const out: SeatId[] = []
  for (let step = 0; step < s.order.length; step++) out.push(s.order[(index + step) % s.order.length] as SeatId)
  return out
}

function nopeQueue(s: EkState, top: SeatId): SeatId[] {
  const eligible = clockwiseFrom(s, nextSeat(s, top)).filter(
    (id) => id !== top && (s.seats[id]?.alive ?? false) && holdsNope(s, id),
  )
  const human = eligible.filter((id) => id === s.human)
  const rest = eligible.filter((id) => id !== s.human)
  return [...human, ...rest]
}

function closeNope(ctx: NopeCtx, resolve: () => void): void {
  const pending = ctx.s.pending
  if (pending?.kind !== 'nope') return
  if (pending.nopes % 2 === 1) {
    ctx.events.push({ type: 'Cancelled', seat: pending.actor, nopes: pending.nopes })
    ctx.s.pending = { kind: 'turn', seat: pending.actor }
    return
  }
  resolve()
}

/** Empty queue resolves inside this call. Otherwise the human, when eligible, is index 0. */
export function openNope(ctx: NopeCtx, actor: SeatId, effect: Effect, resolve: () => void): void {
  const queue = nopeQueue(ctx.s, actor)
  if (queue.length === 0) {
    resolve()
    return
  }
  ctx.s.pending = { kind: 'nope', queue, index: 0, actor, effect, nopes: 0, top: actor }
}

export function passNope(ctx: NopeCtx, resolve: () => void): void {
  const pending = ctx.s.pending
  if (pending?.kind !== 'nope') throw new IllegalActionError('pass is only legal in a nope window')
  const seat = pending.queue[pending.index]
  if (!seat) throw new IllegalActionError('nope queue has nobody to pass')
  ctx.events.push({ type: 'Passed', seat })
  const index = pending.index + 1
  ctx.s.pending = { ...pending, index }
  if (index >= pending.queue.length) closeNope(ctx, resolve)
}

export function playNope(ctx: NopeCtx, seat: SeatId, resolve: () => void): void {
  const pending = ctx.s.pending
  if (pending?.kind !== 'nope') throw new IllegalActionError('nope is only legal in a nope window')
  const hand = ctx.s.seats[seat]?.hand
  const at = hand?.findIndex((card) => card.face.title === 'nope') ?? -1
  if (!hand || at < 0) throw new IllegalActionError('no nope in hand')
  const card = hand.splice(at, 1)[0]
  if (!card) throw new IllegalActionError('no nope in hand')
  ctx.s.discard.push(card)
  const nopes = pending.nopes + 1
  ctx.events.push({ type: 'Noped', seat, card, nopes })
  const queue = nopeQueue(ctx.s, seat)
  ctx.s.pending = { ...pending, queue, index: 0, nopes, top: seat }
  if (queue.length === 0) closeNope(ctx, resolve)
}

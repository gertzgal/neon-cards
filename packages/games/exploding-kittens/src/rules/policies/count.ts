import type { SeatId } from '@neon-cards/engine'
import { COUNTS } from '../deck'
import { TITLE_ORDER, type Effect, type EkAction, type EkView, type PlayTitle, type Title } from '../types'

/** Hard plays scared at this chance the next draw is a kitten. */
export const HARD_P = 0.15

/** Lowest given first. The five cats, then the rest of the sheet. */
const GIVE_RANK: readonly Title[] = [
  'tacocat',
  'hairyPotato',
  'rainbowRalphing',
  'beard',
  'cattermelon',
  'kitten',
  'future',
  'shuffle',
  'favor',
  'skip',
  'attack',
  'nope',
  'defuse',
]

export function first(legal: readonly EkAction[]): EkAction {
  const action = legal[0]
  if (!action) throw new Error('legal menu is empty')
  return action
}

export function topKitten(view: EkView): boolean {
  if (view.plantedIndex === 0) return true
  return view.knownTop[0]?.face.title === 'kitten'
}

/** Next living seat after `from`. Dead seats are skipped. */
export function nextLiving(view: EkView, from: SeatId): SeatId | null {
  const start = view.order.indexOf(from)
  if (start < 0) return null
  for (let step = 1; step <= view.order.length; step++) {
    const id = view.order[(start + step) % view.order.length]
    if (id && view.seats[id]?.alive) return id
  }
  return null
}

/** Largest living hand other than me. Ties take the first seat clockwise from me. */
export function largestOther(view: EkView): SeatId | null {
  const start = view.order.indexOf(view.me)
  let best: SeatId | null = null
  let bestCount = -1
  for (let step = 1; step <= view.order.length; step++) {
    const id = view.order[(start + step) % view.order.length]
    if (!id || id === view.me) continue
    const seat = view.seats[id]
    if (!seat?.alive) continue
    if (seat.count > bestCount) {
      best = id
      bestCount = seat.count
    }
  }
  return best
}

export function holds(view: EkView, title: Title): boolean {
  return view.hand.some((card) => card.face.title === title)
}

export function playOf(legal: readonly EkAction[], title: PlayTitle): EkAction | undefined {
  return legal.find((action) => action.type === 'play' && action.title === title)
}

export function defuseAt(legal: readonly EkAction[], index: number): EkAction {
  return legal.find((action) => action.type === 'defuse' && action.index === index) ?? first(legal)
}

export function giveChoice(view: EkView, legal: readonly EkAction[]): EkAction {
  let bestId: string | null = null
  let bestRank = Number.POSITIVE_INFINITY
  for (const card of view.hand) {
    const rank = GIVE_RANK.indexOf(card.face.title)
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank
      bestId = card.id
    }
  }
  return legal.find((action) => action.type === 'give' && action.cardId === bestId) ?? first(legal)
}

function emptyPool(): Record<Title, number> {
  const pool = {} as Record<Title, number>
  for (const title of TITLE_ORDER) pool[title] = 0
  return pool
}

function subtract(pool: Record<Title, number>, cards: readonly { face: { title: Title } }[]): void {
  for (const card of cards) pool[card.face.title] = Math.max(0, (pool[card.face.title] ?? 0) - 1)
}

/**
 * Opponent hands plus the unknown part of the deck. Setup removals, the hand, the discard,
 * a known prefix, and one buried kitten are already gone. Hands are not split out of the deck.
 */
export function unseen(view: EkView): Record<Title, number> {
  const players = view.order.length
  const pool = emptyPool()
  for (const title of TITLE_ORDER) pool[title] = COUNTS[title]
  pool.kitten = Math.max(0, pool.kitten - (4 - (players - 1)))
  const defusesRemoved = players === 2 ? 2 : players === 3 ? 1 : 0
  pool.defuse = Math.max(0, pool.defuse - defusesRemoved)
  subtract(pool, view.hand)
  subtract(pool, view.discard)
  subtract(pool, view.knownTop)
  if (view.plantedIndex !== null && view.plantedIndex > 0) pool.kitten = Math.max(0, pool.kitten - 1)
  return pool
}

export function poolSum(pool: Record<Title, number>): number {
  let total = 0
  for (const title of TITLE_ORDER) total += pool[title] ?? 0
  return total
}

/** Chance the next draw is a kitten, using only this seat's view. */
export function pTop(view: EkView): number {
  if (view.plantedIndex === 0) return 1
  const top = view.knownTop[0]
  if (top) return top.face.title === 'kitten' ? 1 : 0
  if (view.drawCount === 0) return 0
  const pool = unseen(view)
  const total = poolSum(pool)
  if (total === 0) return 0
  return pool.kitten / total
}

function baseBad(view: EkView, actor: SeatId, effect: Effect): boolean {
  if (effect.type === 'favor' || effect.type === 'pair' || effect.type === 'three') return effect.target === view.me
  if (effect.type === 'attack' || effect.type === 'skip') return nextLiving(view, actor) === view.me
  return false
}

/** Even nopes a bad effect. Odd nopes a good one. A future is neither. Returns the menu object. */
export function nopeChoice(
  view: EkView,
  legal: readonly EkAction[],
  extraBad: (effect: Effect, actor: SeatId) => boolean,
): EkAction {
  const pass = legal.find((action) => action.type === 'pass') ?? first(legal)
  const nope = legal.find((action) => action.type === 'nope')
  const pending = view.pending
  if (!nope || pending?.kind !== 'nope') return pass
  const bad = baseBad(view, pending.actor, pending.effect) || extraBad(pending.effect, pending.actor)
  const good = pending.actor === view.me && !bad && pending.effect.type !== 'future'
  const even = pending.nopes % 2 === 0
  if ((even && bad) || (!even && good)) return nope
  return pass
}

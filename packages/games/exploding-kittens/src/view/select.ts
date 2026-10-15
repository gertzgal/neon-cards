import type { SeatId } from '@neon-cards/engine'
import { TITLE_ORDER, type EkAction, type Title } from '../rules'
import type { EkCard } from '../rules/types'

export interface TapResult {
  send: EkAction | null
  selected: string[]
}

/** Card tap. A unique solo play sends at once. A second tap confirms a play you could also combo. */
export function onCardTap(hand: readonly EkCard[], actions: readonly EkAction[], selected: readonly string[], cardId: string): TapResult {
  const card = hand.find((item) => item.id === cardId)
  if (!card) return { send: null, selected: [...selected] }
  const play = actions.find((action) => action.type === 'play' && action.title === card.face.title)
  if (play && selected.length === 1 && selected[0] === cardId) return { send: play, selected: [] }

  const next = selected.includes(cardId) ? selected.filter((id) => id !== cardId) : [...selected, cardId]
  const copies = hand.filter((item) => item.face.title === card.face.title).length
  if (play && copies === 1 && next.length === 1 && next[0] === cardId) return { send: play, selected: [] }

  const aimed = matching(hand, actions, next).filter((action) => action.type === 'favor' || action.type === 'pair')
  if (aimed.length === 1 && aimed[0]) return { send: aimed[0], selected: [] }
  return { send: null, selected: next }
}

export function targetSeats(hand: readonly EkCard[], actions: readonly EkAction[], selected: readonly string[]): SeatId[] {
  const ids: SeatId[] = []
  for (const action of matching(hand, actions, selected)) {
    if ((action.type === 'favor' || action.type === 'pair' || action.type === 'three') && !ids.includes(action.target)) ids.push(action.target)
  }
  return ids
}

/** A three waits for a name. A single favor or pair at this seat sends that menu object. */
export function actionForSeat(
  hand: readonly EkCard[],
  actions: readonly EkAction[],
  selected: readonly string[],
  seatId: SeatId,
): { send: EkAction | null; ask: boolean } {
  const matched = matching(hand, actions, selected).filter(
    (action) => (action.type === 'favor' || action.type === 'pair' || action.type === 'three') && action.target === seatId,
  )
  if (matched.some((action) => action.type === 'three')) return { send: null, ask: true }
  if (matched.length === 1 && matched[0]) return { send: matched[0], ask: false }
  return { send: null, ask: false }
}

export function actionForName(
  hand: readonly EkCard[],
  actions: readonly EkAction[],
  selected: readonly string[],
  seatId: SeatId,
  name: Title,
): EkAction | null {
  return (
    matching(hand, actions, selected).find((action) => action.type === 'three' && action.target === seatId && action.name === name) ?? null
  )
}

/** Five titles in TITLE_ORDER, or null when the selection is not five different titles. */
export function fiveTitles(hand: readonly EkCard[], selected: readonly string[]): Title[] | null {
  if (selected.length !== 5) return null
  const titles: Title[] = []
  for (const id of selected) {
    const card = hand.find((item) => item.id === id)
    if (!card) return null
    titles.push(card.face.title)
  }
  if (new Set(titles).size !== 5) return null
  return TITLE_ORDER.filter((title) => titles.includes(title))
}

/** The human five comes from the cards they tapped, not from the one menu entry. */
export function fiveAction(hand: readonly EkCard[], selected: readonly string[], takeId: string): EkAction | null {
  const titles = fiveTitles(hand, selected)
  if (!titles) return null
  return { type: 'five', titles, takeId }
}

export function matching(hand: readonly EkCard[], actions: readonly EkAction[], selected: readonly string[]): EkAction[] {
  const titles = titlesOf(hand, selected)
  if (!titles) return []
  return actions.filter((action) => consumes(action, titles))
}

function titlesOf(hand: readonly EkCard[], selected: readonly string[]): Title[] | null {
  const titles: Title[] = []
  for (const id of selected) {
    const card = hand.find((item) => item.id === id)
    if (!card) return null
    titles.push(card.face.title)
  }
  return titles
}

function consumes(action: EkAction, titles: readonly Title[]): boolean {
  if (action.type === 'play') return titles.length === 1 && titles[0] === action.title
  if (action.type === 'favor') return titles.length === 1 && titles[0] === 'favor'
  if (action.type === 'pair') return titles.length === 2 && titles.every((title) => title === action.title)
  if (action.type === 'three') return titles.length === 3 && titles.every((title) => title === action.title)
  if (action.type === 'five') return titles.length === 5 && sameSet(titles, action.titles)
  return false
}

function sameSet(left: readonly Title[], right: readonly Title[]): boolean {
  if (left.length !== right.length) return false
  const count = new Map<Title, number>()
  for (const title of left) count.set(title, (count.get(title) ?? 0) + 1)
  for (const title of right) {
    const n = count.get(title) ?? 0
    if (n === 0) return false
    count.set(title, n - 1)
  }
  return true
}

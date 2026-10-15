import type { SeatId } from '@neon-cards/engine'
import { TITLE_ORDER, type EkAction, type Title } from '../rules'
import type { EkCard } from '../rules/types'

export interface PlayChoice {
  action: EkAction | null
  reason: string | null
  targets: SeatId[]
  names: Title[]
}

const EMPTY: PlayChoice = { action: null, reason: null, targets: [], names: [] }

/** A tap raises the card. A second tap on the same card lowers it. Neither tap plays. */
export function toggleRaised(selected: readonly string[], cardId: string): string[] {
  if (selected.includes(cardId)) return selected.filter((id) => id !== cardId)
  return [...selected, cardId]
}

/**
 * The Play button sends the one menu action this selection consumes.
 * Anything else stays disabled, with the reason the rules already imply.
 */
export function playChoice(
  hand: readonly EkCard[],
  actions: readonly EkAction[],
  selected: readonly string[],
  kind: 'turn' | 'nope' | 'give' | 'defuse',
  discard: readonly EkCard[],
  picked: { target?: SeatId | null; name?: Title | null; takeId?: string | null } = {},
): PlayChoice {
  if (selected.length === 0) return EMPTY
  if (kind === 'nope') return nopeChoice(hand, actions, selected)
  if (kind === 'give') return giveChoice(actions, selected)
  if (kind === 'defuse') return defuseChoice(hand, selected)
  return turnChoice(hand, actions, selected, discard, picked)
}

/** A defuse menu is one action per index. Raising the card must not pick one. */
function defuseChoice(hand: readonly EkCard[], selected: readonly string[]): PlayChoice {
  const card = selected.length === 1 ? hand.find((item) => item.id === selected[0]) : undefined
  if (card?.face.title === 'defuse') return { action: null, reason: null, targets: [], names: [] }
  return { action: null, reason: 'Play a Defuse.', targets: [], names: [] }
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

function nopeChoice(hand: readonly EkCard[], actions: readonly EkAction[], selected: readonly string[]): PlayChoice {
  const nope = actions.find((action) => action.type === 'nope')
  const card = selected.length === 1 ? hand.find((item) => item.id === selected[0]) : undefined
  if (nope && card?.face.title === 'nope') return { action: nope, reason: null, targets: [], names: [] }
  return { action: null, reason: 'Play a Nope.', targets: [], names: [] }
}

function giveChoice(actions: readonly EkAction[], selected: readonly string[]): PlayChoice {
  if (selected.length === 1) {
    const give = actions.find((action) => action.type === 'give' && action.cardId === selected[0])
    if (give) return { action: give, reason: null, targets: [], names: [] }
  }
  return { action: null, reason: 'Give one card.', targets: [], names: [] }
}

function turnChoice(
  hand: readonly EkCard[],
  actions: readonly EkAction[],
  selected: readonly string[],
  discard: readonly EkCard[],
  picked: { target?: SeatId | null; name?: Title | null; takeId?: string | null },
): PlayChoice {
  const matched = matching(hand, actions, selected)
  const plays = matched.filter((action) => action.type === 'play')
  if (plays.length === 1 && matched.length === 1 && plays[0]) return ready(plays[0])

  const aimed = matched.filter((action) => action.type === 'favor' || action.type === 'pair')
  if (aimed.length > 0 && matched.every((action) => action.type === 'favor' || action.type === 'pair')) {
    return aimedChoice(aimed, picked.target ?? null)
  }

  const threes = matched.filter(isThree)
  if (threes.length > 0 && matched.every(isThree)) {
    return threeChoice(threes, picked.target ?? null, picked.name ?? null)
  }

  const titles = fiveTitles(hand, selected)
  if (titles) {
    const takeId = picked.takeId || defaultTake(selected, discard)
    const action = takeId ? fiveAction(hand, selected, takeId) : null
    if (action) return ready(action)
    return { action: null, reason: 'Pick a card to take.', targets: [], names: [] }
  }

  return { action: null, reason: 'Need a matching pair.', targets: [], names: [] }
}

function aimedChoice(actions: readonly EkAction[], target: SeatId | null): PlayChoice {
  const targets = seatsOf(actions)
  const narrowed = target ? actions.filter((action) => 'target' in action && action.target === target) : actions
  if (narrowed.length === 1 && narrowed[0]) return { action: narrowed[0], reason: null, targets, names: [] }
  return { action: null, reason: 'Pick a player.', targets, names: [] }
}

function threeChoice(actions: readonly Extract<EkAction, { type: 'three' }>[], target: SeatId | null, name: Title | null): PlayChoice {
  const targets = seatsOf(actions)
  const seat = target ?? (targets.length === 1 ? targets[0] : null)
  if (!seat) return { action: null, reason: 'Pick a player.', targets, names: [] }
  const named = actions.filter((action) => action.target === seat)
  const names = TITLE_ORDER.filter((title) => named.some((action) => action.name === title))
  if (name) {
    const action = named.find((item) => item.name === name)
    if (action) return { action, reason: null, targets, names }
  }
  return { action: null, reason: 'Name a card.', targets, names }
}

function isThree(action: EkAction): action is Extract<EkAction, { type: 'three' }> {
  return action.type === 'three'
}

function seatsOf(actions: readonly EkAction[]): SeatId[] {
  const ids: SeatId[] = []
  for (const action of actions) {
    if ((action.type === 'favor' || action.type === 'pair' || action.type === 'three') && !ids.includes(action.target)) ids.push(action.target)
  }
  return ids
}

function ready(action: EkAction): PlayChoice {
  return { action, reason: null, targets: [], names: [] }
}

/** The top discard, or one of the five when the discard is empty. Both are legal takes. */
function defaultTake(selected: readonly string[], discard: readonly EkCard[]): string | null {
  const top = discard[discard.length - 1]
  if (top) return top.id
  return selected[0] ?? null
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

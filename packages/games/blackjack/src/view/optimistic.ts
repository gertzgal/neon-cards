import type { BlackjackEvent, VisibleCard } from '../rules'

/** Deck id of a card dealt locally before the server names it. The face is always null. */
export const PENDING_DECK = 'optimistic'

/** Matches the deal fly in Card.tsx, so the face waits until that flight has landed. */
export const PENDING_FLY_MS = 230

export function isPendingCard(card: { deck: string }): boolean {
  return card.deck === PENDING_DECK
}

export function pendingCard(hand: number, index: number): VisibleCard {
  return { id: `optimistic-${hand}-${index}`, deck: PENDING_DECK, face: null }
}

/** Clock for a click. Kept out of the table component so the render path stays pure. */
export function pendingAt(): number {
  return performance.now()
}

export interface PendingDeal {
  hand: number
  placeholderId: string
  card: VisibleCard
}

/** What the table already showed. The server's matching prefix is not played again. */
export type PendingAction =
  | { kind: 'hit'; hand: number; placeholderId: string }
  | { kind: 'stand'; hand: number }
  | { kind: 'double'; hand: number; placeholderId: string }
  | { kind: 'split'; placeholders: readonly [{ hand: 0; id: string }, { hand: 1; id: string }] }

function isPlayerDeal(event: BlackjackEvent | undefined, hand: number): event is Extract<BlackjackEvent, { type: 'deal' }> {
  return event?.type === 'deal' && event.seat !== 'dealer' && event.hand === hand
}

/**
 * Drops the prefix the table already played, and returns the real cards that replace face-down
 * placeholders. Returns null when the server's events aren't that prefix, so the caller can
 * undo and play the batch from the server.
 */
export function absorbPending(
  events: readonly BlackjackEvent[],
  pending: PendingAction,
): { rest: BlackjackEvent[]; deals: PendingDeal[] } | null {
  if (pending.kind === 'stand') {
    const first = events[0]
    if (first?.type !== 'stand' || first.hand !== pending.hand) return null
    return { rest: events.slice(1), deals: [] }
  }
  if (pending.kind === 'hit' || pending.kind === 'double') {
    const offset = pending.kind === 'double' ? 1 : 0
    if (pending.kind === 'double' && (events[0]?.type !== 'double' || events[0].hand !== pending.hand)) return null
    const deal = events[offset]
    if (!isPlayerDeal(deal, pending.hand)) return null
    return {
      rest: events.slice(offset + 1),
      deals: [{ hand: pending.hand, placeholderId: pending.placeholderId, card: deal.card }],
    }
  }
  const [split, left, right] = events
  if (split?.type !== 'split') return null
  const [first, second] = pending.placeholders
  if (!isPlayerDeal(left, first.hand) || !isPlayerDeal(right, second.hand)) return null
  return {
    rest: events.slice(3),
    deals: [
      { hand: first.hand, placeholderId: first.id, card: left.card },
      { hand: second.hand, placeholderId: second.id, card: right.card },
    ],
  }
}

import { describe, expect, it } from 'vitest'
import type { BlackjackCard, BlackjackEvent } from '../rules'
import { absorbPending, isPendingCard, pendingCard, type PendingAction } from './optimistic'

const face = (id: string): BlackjackCard => ({ id, deck: 'standard52', face: { rank: '5', suit: 'H' } })

const deal = (hand: number, id: string): BlackjackEvent => ({
  type: 'deal',
  seat: 'player',
  hand,
  card: face(id),
})

describe('pending cards', () => {
  it('keeps the face hidden, so a local deal cannot reveal the shoe', () => {
    const card = pendingCard(0, 2)
    expect(card.face).toBeNull()
    expect(isPendingCard(card)).toBe(true)
    expect(isPendingCard(face('standard52-1'))).toBe(false)
  })
})

describe('absorbPending', () => {
  it('drops a stand and leaves the dealer events', () => {
    const events: BlackjackEvent[] = [
      { type: 'stand', seat: 'player', hand: 0 },
      { type: 'reveal', seat: 'dealer', card: face('hole'), total: 17 },
    ]
    expect(absorbPending(events, { kind: 'stand', hand: 0 })).toEqual({ rest: [events[1]], deals: [] })
  })

  it('replaces a hit placeholder with the server card and keeps the bust', () => {
    const events: BlackjackEvent[] = [deal(0, 'c1'), { type: 'bust', seat: 'player', hand: 0, total: 26 }]
    const pending: PendingAction = { kind: 'hit', hand: 0, placeholderId: 'optimistic-0-2' }
    expect(absorbPending(events, pending)).toEqual({
      rest: [events[1]],
      deals: [{ hand: 0, placeholderId: 'optimistic-0-2', card: face('c1') }],
    })
  })

  it('drops the double and its card, which the table already flew', () => {
    const events: BlackjackEvent[] = [
      { type: 'double', seat: 'player', hand: 1, amount: 50, stack: 1100 },
      deal(1, 'c2'),
      { type: 'turn', seat: 'player', hand: 0 },
    ]
    expect(absorbPending(events, { kind: 'double', hand: 1, placeholderId: 'optimistic-1-2' })).toEqual({
      rest: [events[2]],
      deals: [{ hand: 1, placeholderId: 'optimistic-1-2', card: face('c2') }],
    })
  })

  it('drops a split and both new cards', () => {
    const events: BlackjackEvent[] = [
      { type: 'split', seat: 'player', amount: 50, stack: 1150 },
      deal(0, 'left'),
      deal(1, 'right'),
      { type: 'turn', seat: 'player', hand: 0 },
    ]
    const absorbed = absorbPending(events, {
      kind: 'split',
      placeholders: [
        { hand: 0, id: 'optimistic-0-1' },
        { hand: 1, id: 'optimistic-1-1' },
      ],
    })
    expect(absorbed?.rest).toEqual([events[3]])
    expect(absorbed?.deals.map((d) => [d.hand, d.card.id])).toEqual([
      [0, 'left'],
      [1, 'right'],
    ])
  })

  it('refuses a prefix that is not what the table showed', () => {
    expect(absorbPending([deal(0, 'c')], { kind: 'stand', hand: 0 })).toBeNull()
    expect(absorbPending([{ type: 'stand', seat: 'player', hand: 0 }], { kind: 'hit', hand: 0, placeholderId: 'optimistic-0-2' })).toBeNull()
    expect(absorbPending([deal(1, 'c')], { kind: 'hit', hand: 0, placeholderId: 'optimistic-0-2' })).toBeNull()
    expect(
      absorbPending([{ type: 'deal', seat: 'dealer', hand: 0, card: { id: 'hole', deck: 'standard52', face: null } }], {
        kind: 'hit',
        hand: 0,
        placeholderId: 'optimistic-0-2',
      }),
    ).toBeNull()
  })
})

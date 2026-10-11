import { describe, expect, it } from 'vitest'
import type { BlackjackView, HandView } from '@neon-cards/game-blackjack/rules'
import { blackjackRecap } from './blackjack-recap'

const card = (code: string, i: number) => {
  const rank = code.slice(0, -1) as HandView['cards'][number]['face']['rank']
  const suit = code.slice(-1) as HandView['cards'][number]['face']['suit']
  return { id: `bj-${i}`, deck: 'standard52', face: { rank, suit } }
}

const hand = (codes: string[], over: Partial<HandView>): HandView => ({
  cards: codes.map(card),
  bet: 25,
  total: 0,
  soft: false,
  status: 'stood',
  doubled: false,
  fromSplit: false,
  outcome: null,
  payout: null,
  ...over,
})

const summary = (hands: HandView[]) => ({ settlements: [], view: { hands } as unknown as BlackjackView })

describe('blackjackRecap', () => {
  it('names a natural BLACKJACK in gold with its cards', () => {
    expect(blackjackRecap(summary([hand(['AH', 'KS'], { status: 'blackjack', outcome: 'blackjack' })]))).toEqual({
      outcome: 'BLACKJACK',
      tone: 'gold',
      hands: [[card('AH', 0), card('KS', 1)]],
    })
  })

  it('says BUST rather than LOSE for a busted hand', () => {
    expect(blackjackRecap(summary([hand(['10H', '6S', 'KC'], { status: 'bust', outcome: 'lose' })]))?.outcome).toBe('BUST')
  })

  it('joins split hands in order', () => {
    const recap = blackjackRecap(
      summary([hand(['8H', '3C'], { outcome: 'win' }), hand(['8S', '10D'], { outcome: 'push' })]),
    )
    expect(recap?.outcome).toBe('WIN · PUSH')
    expect(recap?.hands).toHaveLength(2)
    expect(recap?.tone).toBeUndefined()
  })

  it('returns null without a settled view', () => {
    expect(blackjackRecap({ settlements: [] })).toBeNull()
    expect(blackjackRecap(summary([hand(['8H', '3C'], {})]))).toBeNull()
  })
})

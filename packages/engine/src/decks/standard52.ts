import type { DeckSpec } from '../types'

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
export const SUITS = ['H', 'D', 'S', 'C'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

export interface StandardFace {
  rank: Rank
  suit: Suit
}

export const standard52: DeckSpec<StandardFace> = {
  id: 'standard52',
  build: () => SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
}

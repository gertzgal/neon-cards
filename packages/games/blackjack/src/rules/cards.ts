import type { Card, DeckSpec } from '@neon-cards/engine'

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
export const SUITS = ['H', 'D', 'S', 'C'] as const

export type Rank = (typeof RANKS)[number]
export type Suit = (typeof SUITS)[number]

export interface BlackjackFace {
  rank: Rank
  suit: Suit
}

export type BlackjackCard = Card<BlackjackFace>

export const standard52: DeckSpec<BlackjackFace> = {
  id: 'standard52',
  build: () => SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
}

export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

export interface HandValue {
  total: number
  soft: boolean
}

export function handValue(faces: readonly BlackjackFace[]): HandValue {
  let total = 0
  let elevenAces = 0
  for (const { rank } of faces) {
    total += rankValue(rank)
    if (rank === 'A') elevenAces++
  }
  while (total > 21 && elevenAces > 0) {
    total -= 10
    elevenAces--
  }
  return { total, soft: elevenAces > 0 }
}

export function isNatural(faces: readonly BlackjackFace[]): boolean {
  return faces.length === 2 && handValue(faces).total === 21
}

export function parseFace(code: string): BlackjackFace {
  const rank = code.slice(0, -1).toUpperCase()
  const suit = code.slice(-1).toUpperCase()
  if (!(RANKS as readonly string[]).includes(rank) || !(SUITS as readonly string[]).includes(suit)) {
    throw new Error(`Bad card code "${code}"`)
  }
  return { rank: rank as Rank, suit: suit as Suit }
}

import type { Card, SeatId } from '../contract'
import type { BlackjackCard, BlackjackFace } from './cards'

export interface BlackjackConfig {
  decks: number
  minBet: number
  /** Bets are whole multiples of the smallest chip. */
  betStep: number
  /** Chips the seat sits down with; the server passes the wallet balance. */
  bankroll: number
  /** A broke seat may refill to this amount. */
  refillTo: number
  /** Reshuffle before a round when less than this fraction of the shoe is left. */
  reshuffleAt: number
  /** Dev-only stacked shoe, applied at the start of every round. */
  rig?: string
}

export type Phase = 'betting' | 'playing' | 'settling'

/** `stood` covers every finished, unbusted hand: stand, 21, double, split aces. */
export type HandStatus = 'active' | 'stood' | 'bust' | 'blackjack'

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack'

export interface Hand {
  cards: BlackjackCard[]
  bet: number
  status: HandStatus
  doubled: boolean
  fromSplit: boolean
  outcome: Outcome | null
  payout: number | null
}

export interface RoundResult {
  wagered: number
  payout: number
  net: number
}

export interface BlackjackState {
  config: BlackjackConfig
  seat: SeatId
  phase: Phase
  round: number
  stack: number
  lastBet: number
  shoe: BlackjackCard[]
  shoeSize: number
  /** Index 1 is the hole card, hidden from views until `holeRevealed`. */
  dealer: BlackjackCard[]
  holeRevealed: boolean
  hands: Hand[]
  active: number
  result: RoundResult | null
}

export type BlackjackAction =
  | { type: 'bet'; amount: number }
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'double' }
  | { type: 'split' }
  | { type: 'refill' }

export type ActionType = BlackjackAction['type']

/** A face of `null` is a face-down card. */
export type VisibleCard = Card<BlackjackFace | null>

export const DEALER = 'dealer'

export type BlackjackEvent =
  | { type: 'shuffle'; size: number }
  | { type: 'bet'; seat: SeatId; amount: number; stack: number }
  | { type: 'deal'; seat: SeatId; hand: number; card: VisibleCard }
  | { type: 'peek'; seat: typeof DEALER }
  | { type: 'reveal'; seat: typeof DEALER; card: BlackjackCard; total: number }
  | { type: 'turn'; seat: SeatId; hand: number }
  | { type: 'stand'; seat: SeatId; hand: number }
  | { type: 'double'; seat: SeatId; hand: number; amount: number; stack: number }
  | { type: 'split'; seat: SeatId; amount: number; stack: number }
  | { type: 'bust'; seat: SeatId; hand: number; total: number }
  | { type: 'blackjack'; seat: SeatId; hand: number }
  | { type: 'dealerBlackjack'; seat: typeof DEALER }
  | { type: 'dealerBust'; seat: typeof DEALER; total: number }
  | { type: 'handResult'; seat: SeatId; hand: number; outcome: Outcome; bet: number; payout: number }
  | { type: 'roundEnd'; seat: SeatId; wagered: number; payout: number; net: number; stack: number }
  | { type: 'refill'; seat: SeatId; amount: number; stack: number }

export interface HandView {
  cards: BlackjackCard[]
  bet: number
  total: number
  soft: boolean
  status: HandStatus
  doubled: boolean
  fromSplit: boolean
  outcome: Outcome | null
  payout: number | null
}

export interface BlackjackView {
  phase: Phase
  round: number
  stack: number
  minBet: number
  betStep: number
  lastBet: number
  dealer: { cards: VisibleCard[]; total: number | null; soft: boolean }
  hands: HandView[]
  active: number
  legal: ActionType[]
  result: RoundResult | null
  shoe: { remaining: number; size: number }
}

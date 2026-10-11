import type { Card, Difficulty, Flip7Face, Flip7Number, SeatId } from '@neon-cards/engine'

export type { Flip7Face, Flip7Number }
export type F7Card = Card<Flip7Face>
export type FaceAction = 'freeze' | 'flipThree' | 'secondChance'

export interface Flip7Config {
  opponents: 1 | 2 | 3
  difficulty: Difficulty
  /** Dev only (DEV_RIG=1): a named rig or a literal per-seat stack, see rigs.ts. */
  rig?: string
}

export type SeatStatus = 'active' | 'stayed' | 'frozen' | 'busted'

/** The cards in front of one seat this round. */
export interface Line {
  /** In flip order. Unique values, except a busted line also holds the duplicate last. */
  numbers: F7Card[]
  /** +N and x2 cards. */
  modifiers: F7Card[]
  secondChance: F7Card | null
  /** The Freeze that froze this seat (display only). */
  freeze: F7Card | null
}

export interface SeatRound {
  status: SeatStatus
  line: Line
  flip7: boolean
}

export type Pending =
  | { kind: 'hitOrStay'; seat: SeatId }
  | { kind: 'target'; seat: SeatId; card: F7Card }
  | { kind: 'passSecondChance'; seat: SeatId; card: F7Card }
  | { kind: 'assign'; seat: SeatId; card: F7Card }

/**
 * The rules' work stack, top last. Decisions pause it; apply() resumes it. Plain JSON so a round can
 * pause mid-chain (a Flip Three inside a Flip Three inside the initial deal) and resume after a request.
 */
export type Task =
  /** The hit/stay loop: the next active seat after `anchor` is asked. Ends the round when nobody is active. */
  | { t: 'turn'; anchor: SeatId }
  /** The initial deal: one card to each seat in `queue`, in order. */
  | { t: 'deal'; queue: SeatId[] }
  | { t: 'draw'; seat: SeatId; source: 'initial' | 'hit' | 'flipThree' }
  /** A Flip Three in progress on `seat`. Set-aside Freeze and Flip Three cards wait in `setAside`. */
  | { t: 'flip3'; seat: SeatId; card: F7Card; remaining: number; setAside: F7Card[] }
  /** `seat` hands out set-aside cards in flip order; nothing resolves until all are assigned. */
  | { t: 'assign'; seat: SeatId; cards: F7Card[]; assigned: { card: F7Card; to: SeatId }[] }
  /** A Freeze or Flip Three assigned to `to`. Discarded if `to` is no longer active. */
  | { t: 'resolve'; card: F7Card; from: SeatId; to: SeatId }

export type Stage = 'ready' | 'playing' | 'roundOver' | 'gameOver'

export interface RoundScore {
  seat: SeatId
  /** Sum of number cards (before x2). */
  numbers: number
  x2: boolean
  plus: number
  flip7Bonus: number
  busted: boolean
  round: number
  total: number
}

export interface Flip7State {
  config: Flip7Config
  order: SeatId[]
  human: SeatId
  totals: Record<SeatId, number>
  round: number
  dealer: SeatId
  stage: Stage
  /** ORDER IS SECRET. The next card is draw[0]. */
  draw: F7Card[]
  discard: F7Card[]
  rounds: Record<SeatId, SeatRound>
  stack: Task[]
  pending: Pending | null
  lastScores: RoundScore[] | null
  winner: SeatId | null
  /** True while the round being played is a replay after a tie at the target. */
  tiebreak: boolean
  /** Dev rig: faces each seat draws next, pulled out of the shoe. */
  rig: Record<SeatId, string[]>
}

export type Flip7Action =
  | { type: 'hit' }
  | { type: 'stay' }
  | { type: 'target'; to: SeatId }
  | { type: 'passSecondChance'; to: SeatId }
  | { type: 'assign'; cardId: string; to: SeatId }
  | { type: 'nextRound' }

export interface SeatView {
  id: SeatId
  status: SeatStatus
  line: Line
  flip7: boolean
  roundValue: number
  total: number
}

export interface Flip7View {
  me: SeatId
  order: SeatId[]
  seats: Record<SeatId, SeatView>
  dealer: SeatId
  round: number
  stage: Stage
  drawCount: number
  /** Public multiset: every card in the discard pile since the last reshuffle. */
  discard: Flip7Face[]
  /** Cards out of play but not discarded: running Flip Threes, their set-aside cards, and actions awaiting a target. */
  limbo: Flip7Face[]
  /** The innermost running Flip Three. */
  flipThree: { seat: SeatId; remaining: number; setAside: F7Card[] } | null
  pending: Pending | null
  /** Seats the pending decision may pick (targets, recipients). */
  legalTargets: SeatId[]
  lastScores: RoundScore[] | null
  winner: SeatId | null
  tiebreak: boolean
  targetScore: number
}

export type Flip7Event =
  | { type: 'RoundStarted'; round: number; dealer: SeatId; tiebreak: boolean }
  | { type: 'CardDealt'; seat: SeatId; card: F7Card; source: 'initial' | 'hit' | 'flipThree' }
  | { type: 'Stayed'; seat: SeatId; banked: number }
  | { type: 'Busted'; seat: SeatId; card: F7Card }
  | { type: 'ActionTargeted'; seat: SeatId; to: SeatId; card: F7Card }
  | { type: 'ActionDiscarded'; seat: SeatId; card: F7Card }
  | { type: 'Frozen'; seat: SeatId; by: SeatId; card: F7Card; banked: number }
  | { type: 'FlipThreeStarted'; seat: SeatId; by: SeatId; card: F7Card }
  | { type: 'CardSetAside'; seat: SeatId; card: F7Card }
  | { type: 'FlipThreeEnded'; seat: SeatId; result: 'complete' | 'bust' }
  | { type: 'SetAsideDiscarded'; seat: SeatId; cards: F7Card[] }
  | { type: 'SecondChanceGained'; seat: SeatId; card: F7Card }
  | { type: 'SecondChancePassed'; seat: SeatId; to: SeatId; card: F7Card }
  | { type: 'SecondChanceDiscarded'; seat: SeatId; card: F7Card }
  | { type: 'SecondChanceUsed'; seat: SeatId; card: F7Card; secondChance: F7Card }
  | { type: 'Flip7Achieved'; seat: SeatId; numbers: Flip7Number[] }
  | { type: 'DeckReshuffled'; count: number }
  | { type: 'RoundScored'; round: number; scores: RoundScore[] }
  | { type: 'TiebreakRound'; tied: SeatId[] }
  | { type: 'GameWon'; seat: SeatId; total: number }

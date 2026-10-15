import type { Card, Difficulty, Policies, Policy, SeatId } from '@neon-cards/engine'

/** A later PR adds `src/rules/policies/{easy,medium,hard,index,count}.ts` against this type. */
export type EkPolicy = Policy<EkView, EkAction>
export type EkPolicies = Policies<EkView, EkAction>

export const TITLE_ORDER = [
  'kitten',
  'defuse',
  'nope',
  'attack',
  'skip',
  'favor',
  'shuffle',
  'future',
  'tacocat',
  'hairyPotato',
  'rainbowRalphing',
  'beard',
  'cattermelon',
] as const

export type Title = (typeof TITLE_ORDER)[number]

export const PLAY_TITLES = ['attack', 'skip', 'shuffle', 'future'] as const
export type PlayTitle = (typeof PLAY_TITLES)[number]

export interface EkFace {
  title: Title
}

export type EkCard = Card<EkFace>

export interface EkConfig {
  opponents: 1 | 2 | 3
  difficulty: Difficulty
  /** Dev only (DEV_RIG=1). A known rig name. */
  rig?: RigName
}

export const RIGS = ['kitten', 'explode', 'nope', 'favor', 'five'] as const
export type RigName = (typeof RIGS)[number]

export interface SeatState {
  hand: EkCard[]
  alive: boolean
}

export type Effect =
  | { type: 'attack' | 'skip' | 'shuffle' | 'future' }
  | { type: 'favor'; target: SeatId }
  | { type: 'pair'; target: SeatId; title: Title }
  | { type: 'three'; target: SeatId; title: Title; name: Title }
  | { type: 'five'; titles: Title[]; takeId: string }

export type Pending =
  | { kind: 'turn'; seat: SeatId }
  | {
      kind: 'nope'
      queue: SeatId[]
      index: number
      actor: SeatId
      effect: Effect
      nopes: number
      top: SeatId
    }
  | { kind: 'give'; seat: SeatId; to: SeatId }
  | { kind: 'defuse'; seat: SeatId; kitten: EkCard }

/** Nope's queue and cursor stay on the server. `seat` is who must answer. */
export type PendingView =
  | { kind: 'turn'; seat: SeatId }
  | { kind: 'nope'; seat: SeatId; actor: SeatId; effect: Effect; nopes: number; top: SeatId }
  | { kind: 'give'; seat: SeatId; to: SeatId }
  | { kind: 'defuse'; seat: SeatId; kitten: EkCard }

export interface Known {
  top: string[]
  planted: number | null
}

export interface EkState {
  order: SeatId[]
  human: SeatId
  seats: Record<SeatId, SeatState>
  /** SECRET. Index 0 is the top. */
  draw: EkCard[]
  /** Public. The last element is the top. */
  discard: EkCard[]
  removed: EkCard[]
  turn: SeatId | null
  /** 0 means one ordinary turn. Policies read this raw value. */
  owed: number
  pending: Pending | null
  known: Record<SeatId, Known>
  winner: SeatId | null
}

export type EkAction =
  | { type: 'draw' }
  | { type: 'play'; title: PlayTitle }
  | { type: 'favor'; target: SeatId }
  | { type: 'pair'; title: Title; target: SeatId }
  | { type: 'three'; title: Title; target: SeatId; name: Title }
  | { type: 'five'; titles: Title[]; takeId: string }
  | { type: 'pass' }
  | { type: 'nope' }
  | { type: 'give'; cardId: string }
  | { type: 'defuse'; index: number }

export interface EkView {
  me: SeatId
  order: SeatId[]
  seats: Record<SeatId, { alive: boolean; count: number }>
  hand: EkCard[]
  drawCount: number
  discard: EkCard[]
  turn: SeatId | null
  /** Raw owed. 0 is one ordinary turn. The badge is display-only. */
  owed: number
  pending: PendingView | null
  knownTop: EkCard[]
  plantedIndex: number | null
  winner: SeatId | null
  actions: EkAction[]
}

export type EkEvent =
  | { type: 'Played'; seat: SeatId; cards: EkCard[]; effect: Effect }
  | { type: 'Attacked'; from: SeatId; to: SeatId; owed: number }
  | { type: 'Passed'; seat: SeatId }
  | { type: 'Noped'; seat: SeatId; card: EkCard; nopes: number }
  | { type: 'Cancelled'; seat: SeatId; nopes: number }
  | { type: 'Drew'; seat: SeatId; card: Card<null> | null }
  | { type: 'DrewKitten'; seat: SeatId; card: EkCard }
  | { type: 'Peeked'; seat: SeatId; count: number }
  | { type: 'Shuffled'; count: number }
  | { type: 'Reshuffled'; count: number }
  | { type: 'Whiff'; seat: SeatId }
  | { type: 'Gave'; from: SeatId; to: SeatId }
  | { type: 'Stole'; from: SeatId; to: SeatId }
  | { type: 'Asked'; from: SeatId; to: SeatId; title: Title; hit: true; card: EkCard }
  | { type: 'Asked'; from: SeatId; to: SeatId; title: Title; hit: false }
  | { type: 'Took'; seat: SeatId; card: EkCard }
  | { type: 'Defused'; seat: SeatId; defuse: EkCard; kitten: EkCard }
  | { type: 'Exploded'; seat: SeatId; kitten: EkCard; hand: EkCard[] }
  | { type: 'Won'; seat: SeatId }

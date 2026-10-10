import type { ComponentType } from 'react'
import type { GameDefinition, GameEvent, Policies, Seat, SeatId } from '@neon-cards/engine'

export type SettingValue = string | number

export interface SettingSpec {
  key: string
  label: string
  options: { value: SettingValue; label: string }[]
}

export interface GameMeta {
  title: string
  description: string
  economy: 'chips' | 'score'
  minBet?: number
  settings?: SettingSpec[]
}

export interface GameRules {
  definition: GameDefinition<unknown, unknown, unknown, unknown, unknown>
  policies?: Policies<unknown, unknown>
  meta: GameMeta
}

export interface EventBatch {
  id: number
  events: GameEvent[]
}

export interface TableProps<View = unknown, Action = unknown> {
  seats: Seat[]
  humanSeat: SeatId
  view: View
  events: EventBatch
  wallet: number | null
  act(action: Action): Promise<void>
  busy: boolean
}

export interface GamePlugin {
  rules: GameRules
  Table: ComponentType<TableProps>
}

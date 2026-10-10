import type { ComponentType } from 'react'
import type { GameEvent, GameRules, Seat, SeatId } from '@neon-cards/engine'

// Mirrors TableProps and GamePlugin from the UI kit contract PR until it lands in packages/ui.
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

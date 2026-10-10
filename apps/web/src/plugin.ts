import type { ComponentType, ReactNode } from 'react'
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
  /** The shell's sound and settings buttons. The table renders them at the right of its top bar. */
  hudIcons: ReactNode
}

export interface GamePlugin<View = unknown, Action = unknown> {
  rules: GameRules<unknown, unknown, Action, View>
  Table: ComponentType<TableProps<View, Action>>
}

/** Erases a plugin's View and Action so plugins of different games fit one registry array. */
export function definePlugin<View, Action>(plugin: GamePlugin<View, Action>): GamePlugin {
  return plugin as unknown as GamePlugin
}

import type { GameEvent, Seat, SeatId } from '@neon-cards/engine'

// Mirrors TableProps and EventBatch from the @neon-cards/ui API until the UI kit lands on main.
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

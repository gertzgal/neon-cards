import type { GameEvent, SeatId } from '@neon-cards/engine'
import type { JuiceKit, JuiceMap } from '../api'

export interface PlaybackDeps {
  juice: JuiceMap
  kit: JuiceKit
  apply(event: GameEvent): void
  isCpu(seat: SeatId): boolean
  /** Resolves once the applied event is on screen (a frame after React commits). */
  settle(): Promise<void>
  thinkingMs: number
  /** True once the user asked to jump to the end. */
  skipped(): boolean
  onTurn(seat: SeatId, thinking: boolean): void
}

/**
 * Plays a batch of events in order. Every event is applied to the display; while not skipped,
 * a CPU `turn` gets a thinking beat on its seat and each event's juice runs to completion.
 */
export async function runPlayback(events: readonly GameEvent[], deps: PlaybackDeps): Promise<void> {
  const { juice, kit, apply, isCpu, settle, thinkingMs, skipped, onTurn } = deps
  for (const event of events) {
    apply(event)
    const turnSeat = event.type === 'turn' && typeof event.seat === 'string' ? event.seat : null
    if (turnSeat) onTurn(turnSeat, false)
    if (skipped()) continue
    await settle()
    if (turnSeat && isCpu(turnSeat)) {
      onTurn(turnSeat, true)
      kit.sfx('turn')
      await kit.wait(thinkingMs)
      onTurn(turnSeat, false)
    }
    if (skipped()) continue
    await juice[event.type]?.(event, kit)
  }
}

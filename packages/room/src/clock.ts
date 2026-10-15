export const TURN_MS = 30_000
export const QUICK_MS = 5_000
export const HOST_GRACE_MS = 15_000

export interface TurnDeadline {
  seatId: string
  dueAt: number
}

export interface QuickDeadline {
  seatId: string
  dueAt: number
}

export interface HostGrace {
  dueAt: number
}

export interface Deadlines {
  turn: TurnDeadline | null
  quick: QuickDeadline | null
  hostGrace: HostGrace | null
}

export function emptyDeadlines(): Deadlines {
  return { turn: null, quick: null, hostGrace: null }
}

export function earliest(deadlines: Deadlines): number | null {
  const times = [deadlines.turn?.dueAt, deadlines.quick?.dueAt, deadlines.hostGrace?.dueAt].filter(
    (time): time is number => typeof time === 'number',
  )
  if (times.length === 0) return null
  return Math.min(...times)
}

/** Host grace wins. A due grace does not also play the turn. */
export function wakePlan(deadlines: Deadlines, now: number): { close: boolean; turn: boolean; quick: boolean } {
  const close = deadlines.hostGrace !== null && deadlines.hostGrace.dueAt <= now
  if (close) return { close: true, turn: false, quick: false }
  return {
    close: false,
    turn: deadlines.turn !== null && deadlines.turn.dueAt <= now,
    quick: deadlines.quick !== null && deadlines.quick.dueAt <= now,
  }
}

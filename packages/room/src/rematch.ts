import type { LiveChair } from './seats'

export interface Hold {
  playerId: string
  seatId: string
  nickname: string
}

/** Playing chairs move left by one. House chairs stay at the end. Ids are s0 onward in the new order. */
export function rotatePlaying(chairs: readonly LiveChair[]): LiveChair[] {
  const playing = chairs.filter((chair) => chair.kind !== 'house')
  const house = chairs.filter((chair) => chair.kind === 'house')
  const head = playing[0]
  if (!head || playing.length < 2) return chairs.map((chair) => ({ ...chair }))
  const rotated = [...playing.slice(1), head]
  const renumbered = rotated.map((chair, index) => ({ ...chair, seatId: `s${index}` }))
  return [...renumbered, ...house]
}

/**
 * A hold takes a CPU seat whose away is null. The player must not already be seated.
 * Invalid holds are dropped. Applied players leave the watcher list via the caller.
 */
export function applyHolds(chairs: readonly LiveChair[], holds: readonly Hold[]): { chairs: LiveChair[]; seated: string[] } {
  let next = chairs.map((chair) => ({ ...chair }))
  const seated: string[] = []
  for (const hold of holds) {
    const taken = next.some((chair) => chair.kind === 'human' && chair.playerId === hold.playerId)
    const chair = next.find((item) => item.seatId === hold.seatId)
    if (taken || chair?.kind !== 'cpu' || chair.away !== null) continue
    next = next.map((item) =>
      item.seatId === hold.seatId
        ? { kind: 'human' as const, seatId: item.seatId, playerId: hold.playerId, nickname: hold.nickname, misses: 0 as const }
        : item,
    )
    seated.push(hold.playerId)
  }
  return { chairs: next, seated }
}

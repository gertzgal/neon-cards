import type { LiveFrame, OutFrame, PresenceRow, Remembered, SeqFrame } from './lobby'
import type { LiveChair, RoomSeat } from './seats'

export interface EngineMatch {
  gameId: string
  version: number
  seed: string
  config: unknown
  seats: RoomSeat[]
  state: unknown
  rng: string
  seq: number
}

export interface LiveRoom {
  kind: 'live'
  code: string
  gameId: string
  hostId: string
  historyId: string
  config: unknown
  chairs: LiveChair[]
  watching: string[]
  holds: []
  present: PresenceRow[]
  deadlines: { turn: null; quick: null; hostGrace: null }
  match: EngineMatch
  generation: number
  remembered: Remembered[]
  seqFrames: SeqFrame[]
  phase: 'playing' | 'between' | 'over'
  events: unknown[]
}

export function isLive(state: { kind: string }): state is LiveRoom {
  return state.kind === 'live'
}

export function rememberedFrame(remembered: readonly Remembered[], commandId: string, playerId: string): OutFrame | null {
  for (let i = remembered.length - 1; i >= 0; i--) {
    const row = remembered[i]
    if (row && row.commandId === commandId && row.playerId === playerId) return row.frame
  }
  return null
}

export function frameAtSeq(frames: readonly SeqFrame[], seq: number, playerId: string): OutFrame | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const row = frames[i]
    if (row && row.seq === seq && row.playerId === playerId) return row.frame
  }
  return null
}

export function remember<T extends { generation: number; remembered: Remembered[]; seqFrames: SeqFrame[] }>(
  room: T,
  commandId: string,
  playerId: string,
  frame: OutFrame,
  seq: number | null,
): T {
  return {
    ...room,
    generation: room.generation + 1,
    remembered: [...room.remembered, { commandId, playerId, frame }],
    seqFrames: seq === null ? room.seqFrames : [...room.seqFrames, { seq, playerId, frame }],
  }
}

export function leaveLive(room: LiveRoom, playerId: string): LiveRoom | { kind: 'closed'; code: string } {
  if (playerId === room.hostId) return { kind: 'closed', code: room.code }
  return {
    ...room,
    watching: room.watching.filter((id) => id !== playerId),
    present: room.present.filter((row) => row.playerId !== playerId),
  }
}

export function watchLive(room: LiveRoom, playerId: string): LiveRoom {
  const seated = room.chairs.some((chair) => chair.kind === 'human' && chair.playerId === playerId)
  if (seated || room.watching.includes(playerId)) return room
  return { ...room, watching: [...room.watching, playerId] }
}

export function displaySeats(chairs: readonly LiveChair[]): LiveFrame['seats'] {
  return chairs.map((chair) => {
    if (chair.kind === 'human') return { id: chair.seatId, kind: 'human' as const, name: chair.nickname }
    if (chair.kind === 'house') return { id: chair.seatId, kind: 'house' as const, name: chair.name }
    if (chair.away) return { id: chair.seatId, kind: 'cpu' as const, name: chair.name }
    return { id: chair.seatId, kind: 'cpu' as const, name: chair.name, difficulty: chair.difficulty }
  })
}

export function liveFrame(input: {
  room: LiveRoom
  playerId: string
  view: unknown
  events: unknown
  snap: boolean
  canAct: boolean
  canOpen: boolean
}): LiveFrame {
  const mine = input.room.chairs.find((chair) => chair.kind === 'human' && chair.playerId === input.playerId)
  return {
    type: 'live',
    code: input.room.code,
    gameId: input.room.gameId,
    host: input.playerId === input.room.hostId,
    you: mine?.seatId ?? null,
    canAct: input.canAct,
    canOpen: input.canOpen,
    seats: displaySeats(input.room.chairs),
    eyes: input.room.watching.length,
    seq: input.room.match.seq,
    view: input.view,
    events: input.events,
    snap: input.snap,
    deadline: null,
  }
}

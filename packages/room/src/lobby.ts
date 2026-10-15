export interface LobbyChair {
  seatId: string
  playerId: string | null
  nickname: string | null
}

export interface PresenceRow {
  playerId: string
  sockets: number
}

export interface Remembered {
  commandId: string
  playerId: string
  frame: OutFrame
}

export interface SeqFrame {
  seq: number
  playerId: string
  frame: OutFrame
}

export interface Lobby {
  kind: 'lobby'
  code: string
  gameId: string
  hostId: string
  chairs: LobbyChair[]
  watching: string[]
  present: PresenceRow[]
  config: unknown
  generation: number
  remembered: Remembered[]
  seqFrames: SeqFrame[]
}

export interface ClosedRoom {
  kind: 'closed'
  code: string
}

export type RoomState = Lobby | ClosedRoom

export interface LobbyFrame {
  type: 'lobby'
  code: string
  gameId: string
  host: boolean
  you: string | null
  seats: { id: string; kind: 'human'; name: string }[]
  eyes: number
  canOpen: boolean
}

export interface LiveFrame {
  type: 'live'
  code: string
  gameId: string
  host: boolean
  you: string | null
  canAct: boolean
  canOpen: boolean
  seats: { id: string; kind: 'human' | 'cpu' | 'house'; name: string; difficulty?: 'easy' | 'medium' | 'hard' }[]
  eyes: number
  seq: number
  view: unknown
  events: unknown
  snap: boolean
  deadline: number | null
}

export interface ClosedFrame {
  type: 'closed'
}

export interface RejectedFrame {
  type: 'rejected'
  reason: 'not-your-turn' | 'seq' | 'not-host' | 'closed' | 'illegal' | 'full' | 'hold' | 'chips'
}

export type OutFrame = LobbyFrame | LiveFrame | ClosedFrame | RejectedFrame

export function createLobby(input: { code: string; gameId: string; hostId: string; nickname: string; seats: number }): Lobby {
  if (input.seats < 2) throw new Error('a room needs at least two seats')
  const chairs: LobbyChair[] = Array.from({ length: input.seats }, (_, i) =>
    i === 0
      ? { seatId: `s${i}`, playerId: input.hostId, nickname: input.nickname }
      : { seatId: `s${i}`, playerId: null, nickname: null },
  )
  return {
    kind: 'lobby',
    code: input.code,
    gameId: input.gameId,
    hostId: input.hostId,
    chairs,
    watching: [],
    present: [],
    config: {},
    generation: 0,
    remembered: [],
    seqFrames: [],
  }
}

function chairOf(room: Lobby, playerId: string): LobbyChair | undefined {
  return room.chairs.find((chair) => chair.playerId === playerId)
}

/** Takes the first open chair. Already seated players stay put. A full room throws. */
export function seatPlayer(room: Lobby, playerId: string, nickname: string): Lobby {
  if (chairOf(room, playerId)) return room
  const open = room.chairs.find((chair) => chair.playerId === null)
  if (!open) throw new Error('full')
  return {
    ...room,
    watching: room.watching.filter((id) => id !== playerId),
    chairs: room.chairs.map((chair) => (chair.seatId === open.seatId ? { ...chair, playerId, nickname } : chair)),
  }
}

export function addSocket<T extends { present: PresenceRow[] }>(room: T, playerId: string): T {
  const row = room.present.find((p) => p.playerId === playerId)
  const present = row
    ? room.present.map((p) => (p.playerId === playerId ? { ...p, sockets: p.sockets + 1 } : p))
    : [...room.present, { playerId, sockets: 1 }]
  return { ...room, present }
}

export function dropSocket<T extends { present: PresenceRow[] }>(room: T, playerId: string): T {
  const present = room.present.flatMap((p) => {
    if (p.playerId !== playerId) return [p]
    if (p.sockets <= 1) return []
    return [{ ...p, sockets: p.sockets - 1 }]
  })
  return { ...room, present }
}

export function watch(room: Lobby, playerId: string): Lobby {
  if (playerId === room.hostId) throw new Error('illegal')
  const chairs = room.chairs.map((chair) =>
    chair.playerId === playerId ? { ...chair, playerId: null, nickname: null } : chair,
  )
  const watching = room.watching.includes(playerId) ? room.watching : [...room.watching, playerId]
  return { ...room, chairs, watching }
}

export function leave(room: Lobby, playerId: string): RoomState {
  if (playerId === room.hostId) return { kind: 'closed', code: room.code }
  return {
    ...room,
    watching: room.watching.filter((id) => id !== playerId),
    chairs: room.chairs.map((chair) => (chair.playerId === playerId ? { ...chair, playerId: null, nickname: null } : chair)),
    present: room.present.filter((p) => p.playerId !== playerId),
  }
}

export function lobbyFrame(room: Lobby, playerId: string): LobbyFrame {
  const mine = chairOf(room, playerId)
  return {
    type: 'lobby',
    code: room.code,
    gameId: room.gameId,
    host: playerId === room.hostId,
    you: mine?.seatId ?? null,
    seats: room.chairs.flatMap((chair) =>
      chair.playerId && chair.nickname ? [{ id: chair.seatId, kind: 'human' as const, name: chair.nickname }] : [],
    ),
    eyes: room.watching.length,
    canOpen: playerId === room.hostId,
  }
}

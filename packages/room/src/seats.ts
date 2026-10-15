import type { Lobby, LobbyChair } from './lobby'
import { randomNickname } from './nickname'

export type RoomDifficulty = 'easy' | 'medium' | 'hard'

export interface RoomSeat {
  id: string
  kind: 'human' | 'cpu' | 'house'
  name: string
  difficulty?: RoomDifficulty
}

export interface LiveHuman {
  kind: 'human'
  seatId: string
  playerId: string
  nickname: string
  misses: 0 | 1
}

export interface LiveCpu {
  kind: 'cpu'
  seatId: string
  name: string
  difficulty: RoomDifficulty
  away: string | null
}

export interface LiveHouse {
  kind: 'house'
  seatId: string
  name: string
}

export type LiveChair = LiveHuman | LiveCpu | LiveHouse

function isDifficulty(value: string | undefined): value is RoomDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

/**
 * Humans keep their lobby chairs. Open chairs become CPUs. Rotate stays 0, so the host is index 0.
 * The caller appends house seats. This list does not add `config.opponents` on top.
 */
export function roomSeats(room: Lobby, difficulty: RoomDifficulty): RoomSeat[] {
  let cpu = 0
  return room.chairs.map((chair) => {
    if (chair.playerId && chair.nickname) {
      return { id: chair.seatId, kind: 'human' as const, name: chair.nickname }
    }
    cpu += 1
    return { id: chair.seatId, kind: 'cpu' as const, name: randomNickname(() => cpu * 5 + 1), difficulty }
  })
}

export function liveChairs(lobbyChairs: readonly LobbyChair[], seats: readonly RoomSeat[]): LiveChair[] {
  return seats.map((seat) => {
    if (seat.kind === 'house') return { kind: 'house', seatId: seat.id, name: seat.name }
    if (seat.kind === 'cpu') {
      return {
        kind: 'cpu',
        seatId: seat.id,
        name: seat.name,
        difficulty: isDifficulty(seat.difficulty) ? seat.difficulty : 'medium',
        away: null,
      }
    }
    const source = lobbyChairs.find((chair) => chair.seatId === seat.id)
    if (!source?.playerId) throw new Error(`human seat "${seat.id}" has no player`)
    return { kind: 'human', seatId: seat.id, playerId: source.playerId, nickname: seat.name, misses: 0 }
  })
}

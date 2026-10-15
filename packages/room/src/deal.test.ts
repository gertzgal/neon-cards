import { describe, expect, it } from 'vitest'
import { displaySeats, frameAtSeq, liveFrame, remember, rememberedFrame, type LiveRoom } from './live'
import { createLobby, lobbyFrame, seatPlayer } from './lobby'
import { stripRig } from './rig'
import { liveChairs, roomSeats } from './seats'

describe('room seats', () => {
  it('keeps humans and fills open chairs with CPUs at the room difficulty', () => {
    const lobby = seatPlayer(createLobby({ code: 'ABCD', gameId: 'flip7', hostId: 'host', nickname: 'Neon Ace', seats: 4 }), 'guest', 'Pixel Fox')
    const seats = roomSeats(lobby, 'easy')
    expect(seats.map((seat) => seat.id)).toEqual(['s0', 's1', 's2', 's3'])
    expect(seats.map((seat) => seat.kind)).toEqual(['human', 'human', 'cpu', 'cpu'])
    expect(seats[2]).toMatchObject({ difficulty: 'easy' })
    expect(liveChairs(lobby.chairs, seats).map((chair) => chair.kind)).toEqual(['human', 'human', 'cpu', 'cpu'])
  })
})

describe('rig', () => {
  it('removes rig unless the dev flag is on', () => {
    expect(stripRig({ difficulty: 'hard', rig: 'bust' }, false)).toEqual({ difficulty: 'hard' })
    expect(stripRig({ difficulty: 'hard', rig: 'bust' }, true)).toEqual({ difficulty: 'hard', rig: 'bust' })
  })
})

describe('retry frames', () => {
  it('bumps the generation and returns the stored frame for that command and seq', () => {
    const lobby = createLobby({ code: 'ABCD', gameId: 'flip7', hostId: 'host', nickname: 'Neon Ace', seats: 4 })
    const frame = lobbyFrame(lobby, 'host')
    const next = remember(lobby, 'd1', 'host', frame, 0)
    expect(next.generation).toBe(1)
    expect(rememberedFrame(next.remembered, 'd1', 'host')).toEqual(frame)
    expect(frameAtSeq(next.seqFrames, 0, 'host')).toEqual(frame)
    expect(rememberedFrame(next.remembered, 'd1', 'guest')).toBeNull()
  })

  it('omits difficulty on a covered seat and does not copy the match into the frame', () => {
    const room = {
      kind: 'live',
      code: 'ABCD',
      gameId: 'flip7',
      hostId: 'host',
      historyId: 'h1',
      config: {},
      chairs: [
        { kind: 'human', seatId: 's0', playerId: 'host', nickname: 'Neon Ace', misses: 0 },
        { kind: 'cpu', seatId: 's1', name: 'Pixel Fox', difficulty: 'hard', away: 'guest' },
      ],
      watching: [],
      holds: [],
      present: [],
      deadlines: { turn: null, quick: null, hostGrace: null },
      match: { gameId: 'flip7', version: 2, seed: 'seed', config: {}, seats: [], state: { draw: ['SECRET'] }, rng: 'rng', seq: 3 },
      generation: 1,
      remembered: [],
      seqFrames: [],
      phase: 'playing',
      events: [],
    } satisfies LiveRoom
    expect(displaySeats(room.chairs)[1]).toEqual({ id: 's1', kind: 'cpu', name: 'Pixel Fox' })
    const frame = liveFrame({ room, playerId: 'host', view: { me: 's0' }, events: [], snap: false, canAct: true, canOpen: false })
    expect(JSON.stringify(frame)).not.toContain('SECRET')
    expect(JSON.stringify(frame)).not.toContain('rng')
    expect(frame).toMatchObject({ type: 'live', you: 's0', seq: 3, canAct: true, deadline: null, backSeat: null })
    const covered = liveFrame({ room, playerId: 'guest', view: null, events: [], snap: true, canAct: false, canOpen: false })
    expect(covered).toMatchObject({ you: null, backSeat: 's1', canAct: false })
  })
})

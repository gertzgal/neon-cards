import { describe, expect, it } from 'vitest'
import { addSocket, createLobby, dropSocket, leave, lobbyFrame, seatPlayer, watch } from './lobby'

const room = () => createLobby({ code: 'ABCD', gameId: 'flip7', hostId: 'host', nickname: 'Neon Ace', seats: 4 })

describe('lobby', () => {
  it('seats the host at s0 and leaves the rest open', () => {
    const frame = lobbyFrame(room(), 'host')
    expect(frame).toMatchObject({ type: 'lobby', host: true, you: 's0', eyes: 0, canOpen: true })
    expect(frame.seats).toEqual([{ id: 's0', kind: 'human', name: 'Neon Ace' }])
  })

  it('seats a second player and counts sockets up and down to zero', () => {
    let next = seatPlayer(room(), 'guest', 'Pixel Fox')
    next = addSocket(addSocket(next, 'guest'), 'guest')
    expect(next.present).toEqual([{ playerId: 'guest', sockets: 2 }])
    next = dropSocket(next, 'guest')
    expect(next.present).toEqual([{ playerId: 'guest', sockets: 1 }])
    next = dropSocket(next, 'guest')
    expect(next.present).toEqual([])
    expect(lobbyFrame(next, 'guest').you).toBe('s1')
    expect(lobbyFrame(next, 'guest').seats.map((s) => s.id)).toEqual(['s0', 's1'])
  })

  it('rejects a fifth human', () => {
    let next = room()
    next = seatPlayer(next, 'a', 'A')
    next = seatPlayer(next, 'b', 'B')
    next = seatPlayer(next, 'c', 'C')
    expect(() => seatPlayer(next, 'd', 'D')).toThrow('full')
  })

  it('lets a guest watch, and a host leave closes the room', () => {
    const seated = seatPlayer(room(), 'guest', 'Pixel Fox')
    const watching = watch(seated, 'guest')
    expect(watching.watching).toEqual(['guest'])
    expect(lobbyFrame(watching, 'guest')).toMatchObject({ you: null, eyes: 1, host: false, canOpen: false })
    expect(leave(watching, 'host')).toEqual({ kind: 'closed', code: 'ABCD' })
  })
})

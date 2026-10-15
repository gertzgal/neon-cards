import { describe, expect, it } from 'vitest'
import { applyHolds, rotatePlaying } from './rematch'
import type { LiveChair } from './seats'

const chairs = (): LiveChair[] => [
  { kind: 'human', seatId: 's0', playerId: 'host', nickname: 'Neon Ace', misses: 0 },
  { kind: 'human', seatId: 's1', playerId: 'guest', nickname: 'Pixel Fox', misses: 1 },
  { kind: 'cpu', seatId: 's2', name: 'Quiet Wren', difficulty: 'easy', away: null },
  { kind: 'cpu', seatId: 's3', name: 'Bold Cedar', difficulty: 'easy', away: 'away' },
]

describe('rematch rotation', () => {
  it('moves the first playing chair to the end and renumbers from s0', () => {
    const next = rotatePlaying(chairs())
    expect(next.map((chair) => chair.seatId)).toEqual(['s0', 's1', 's2', 's3'])
    expect(next[0]).toMatchObject({ kind: 'human', playerId: 'guest', misses: 1 })
    expect(next[3]).toMatchObject({ kind: 'human', playerId: 'host' })
  })

  it('leaves house chairs at the end', () => {
    const next = rotatePlaying([
      ...chairs().slice(0, 2),
      { kind: 'house', seatId: 'dealer', name: 'House' },
    ])
    expect(next.map((chair) => chair.seatId)).toEqual(['s0', 's1', 'dealer'])
    expect(next[2]).toMatchObject({ kind: 'house', name: 'House' })
  })
})

describe('holds', () => {
  it('gives an open CPU seat to a watcher and skips a covered seat', () => {
    const open = applyHolds(chairs(), [{ playerId: 'watch', seatId: 's2', nickname: 'Calm Jade' }])
    expect(open.seated).toEqual(['watch'])
    expect(open.chairs[2]).toMatchObject({ kind: 'human', playerId: 'watch', nickname: 'Calm Jade', misses: 0 })
    const covered = applyHolds(chairs(), [{ playerId: 'watch', seatId: 's3', nickname: 'Calm Jade' }])
    expect(covered.seated).toEqual([])
    expect(covered.chairs[3]).toMatchObject({ kind: 'cpu', away: 'away' })
  })
})

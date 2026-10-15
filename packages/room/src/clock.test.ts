import { describe, expect, it } from 'vitest'
import { earliest, wakePlan } from './clock'

describe('room clock', () => {
  it('picks the earliest deadline', () => {
    expect(earliest({ turn: { seatId: 's0', dueAt: 50 }, quick: null, hostGrace: { dueAt: 20 } })).toBe(20)
    expect(earliest({ turn: null, quick: null, hostGrace: null })).toBeNull()
  })

  it('closes on host grace without playing a turn that is also due', () => {
    expect(wakePlan({ turn: { seatId: 's0', dueAt: 10 }, quick: { seatId: 's1', dueAt: 10 }, hostGrace: { dueAt: 10 } }, 10)).toEqual({
      close: true,
      turn: false,
      quick: false,
    })
  })

  it('plays a due turn when grace is later', () => {
    expect(wakePlan({ turn: { seatId: 's0', dueAt: 10 }, quick: null, hostGrace: { dueAt: 99 } }, 10)).toEqual({
      close: false,
      turn: true,
      quick: false,
    })
  })
})

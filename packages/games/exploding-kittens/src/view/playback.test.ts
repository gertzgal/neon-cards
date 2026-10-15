import type { GameEvent } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { splitBeats, thinkingMs } from './playback'

const turn = (seat: string): GameEvent => ({ type: 'turn', seat })
const ev = (type: string, seat?: string): GameEvent => (seat ? { type, seat } : { type })

describe('splitBeats', () => {
  it('keeps events before the first turn on a human beat with no thinking', () => {
    const events = [ev('Played', 'you'), ev('Attacked')]
    expect(splitBeats(events)).toEqual([{ events, thinkingMs: 0 }])
    expect(thinkingMs(events)).toBe(0)
  })

  it('starts each later beat at a turn', () => {
    const events = [ev('Played', 'you'), turn('cpu-1'), ev('Passed', 'cpu-1'), turn('cpu-2'), ev('Noped', 'cpu-2')]
    const beats = splitBeats(events)
    expect(beats.map((beat) => beat.events.map((event) => event.type))).toEqual([
      ['Played'],
      ['turn', 'Passed'],
      ['turn', 'Noped'],
    ])
    expect(beats.map((beat) => beat.thinkingMs)).toEqual([0, 120, 500])
  })

  it('thinks 120 on a pass that does not nope or play, even if the attack then resolves', () => {
    const beat = [turn('cpu-2'), ev('Passed', 'cpu-2'), ev('Attacked')]
    expect(thinkingMs(beat)).toBe(120)
  })

  it('thinks 500 when the beat plays or nopes', () => {
    expect(thinkingMs([turn('cpu-1'), ev('Played', 'cpu-1'), ev('Attacked')])).toBe(500)
    expect(thinkingMs([turn('cpu-1'), ev('Passed', 'cpu-1'), ev('Noped', 'cpu-1')])).toBe(500)
    expect(thinkingMs([turn('cpu-1')])).toBe(500)
  })

  it('returns no beats for an empty batch', () => {
    expect(splitBeats([])).toEqual([])
  })
})

import type { Flip7Face } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { inspectRule } from './face'

describe('press to read', () => {
  it('has a rule for the specials and does not put that sentence on the face', () => {
    const faces: Flip7Face[] = [
      { kind: 'action', action: 'freeze' },
      { kind: 'action', action: 'flipThree' },
      { kind: 'action', action: 'secondChance' },
      { kind: 'modifier', op: 'add', value: 4 },
      { kind: 'modifier', op: 'times', value: 2 },
    ]
    for (const face of faces) expect(inspectRule(face).length).toBeGreaterThan(8)
    expect(inspectRule({ kind: 'action', action: 'freeze' })).toBe('They bank their score and sit out.')
    expect(inspectRule({ kind: 'modifier', op: 'add', value: 10 })).toBe('Add 10 to the round.')
  })
})
import { describe, expect, it } from 'vitest'
import { flip7HandRoom } from './hand-room'

describe('flip7HandRoom', () => {
  it('leaves the score badge inside a phone and a desktop row', () => {
    expect(flip7HandRoom(390, 20, 12, 96)).toBe(262)
    expect(flip7HandRoom(1440, 20, 12, 140)).toBe(1268)
  })

  it('never hands the row a sliver when the badge is wide', () => {
    expect(flip7HandRoom(100, 20, 12, 80)).toBe(72)
  })
})

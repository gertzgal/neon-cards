import { describe, expect, it } from 'vitest'
import { flip7HandRoom, flip7OpenScale } from './hand-room'

describe('flip7HandRoom', () => {
  it('gives the whole player row to the cards on a phone and a desktop', () => {
    expect(flip7HandRoom(390, 20)).toBe(370)
    expect(flip7HandRoom(1440, 20)).toBe(1420)
    expect(flip7HandRoom(1920, 20)).toBe(1900)
  })

  it('never hands the row a sliver', () => {
    expect(flip7HandRoom(100, 40)).toBe(72)
  })

  it('opens desktop cards at 70% of the post-fit phone scale', () => {
    expect(flip7OpenScale(true)).toBe(0.8)
    expect(flip7OpenScale(false)).toBeCloseTo(0.8 * 0.7)
  })
})

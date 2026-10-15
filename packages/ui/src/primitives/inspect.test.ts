import { describe, expect, it } from 'vitest'
import { readOrPlay } from './inspect'

describe('read or play', () => {
  it('reads on the first contact, including the click that follows a hover', () => {
    expect(readOrPlay(null, false, 'card-a', true)).toBe('read')
    expect(readOrPlay('card-a', true, 'card-a', true)).toBe('read')
  })

  it('plays on a later tap of the same card', () => {
    expect(readOrPlay('card-a', false, 'card-a', true)).toBe('play')
  })

  it('moves to a different card and does not play a card with nothing to do', () => {
    expect(readOrPlay('card-a', false, 'card-b', true)).toBe('read')
    expect(readOrPlay('card-a', false, 'card-a', false)).toBe('read')
  })
})

import { describe, expect, it } from 'vitest'
import { placeInspect, readOrPlay, type Box } from './inspect'

function hits(panel: { x: number; y: number }, size: { w: number; h: number }, box: Box) {
  const a = { ...panel, ...size }
  const x = Math.max(0, Math.min(a.x + a.w, box.x + box.w) - Math.max(a.x, box.x))
  const y = Math.max(0, Math.min(a.y + a.h, box.y + box.h) - Math.max(a.y, box.y))
  return x * y
}

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

describe('inspect placement', () => {
  const panel = { w: 156, h: 114 }

  it('sits under the pile when the gap above the hand is open', () => {
    const pile = { x: 174, y: 241, w: 42, h: 77 }
    const slots = { x: 114, y: 486, w: 162, h: 8 }
    const hand = { x: 78, y: 504, w: 150, h: 203 }
    const buttons = { x: 14, y: 774, w: 362, h: 54 }
    const at = placeInspect(panel, { w: 390, h: 844 }, pile, [slots, hand, buttons])
    expect(hits(at, panel, pile)).toBe(0)
    expect(hits(at, panel, hand)).toBe(0)
    expect(hits(at, panel, buttons)).toBe(0)
    expect(at.y).toBeGreaterThan(pile.y + pile.h)
    expect(at.y + panel.h).toBeLessThan(hand.y)
  })

  it('moves beside the pile when a modifier already fills the gap', () => {
    const pile = { x: 174, y: 320, w: 42, h: 77 }
    const extras = { x: 174, y: 425, w: 42, h: 57 }
    const slots = { x: 114, y: 486, w: 162, h: 8 }
    const hand = { x: 78, y: 504, w: 150, h: 203 }
    const buttons = { x: 14, y: 774, w: 362, h: 54 }
    const cpu = { x: 12, y: 220, w: 366, h: 73 }
    const at = placeInspect(panel, { w: 390, h: 844 }, pile, [cpu, extras, slots, hand, buttons])
    for (const box of [pile, extras, hand, buttons, cpu]) expect(hits(at, panel, box)).toBe(0)
  })

  it('stays off a desktop pile that has a modifier under it', () => {
    const wide = { w: 300, h: 120 }
    const pile = { x: 685, y: 282, w: 71, h: 116 }
    const extras = { x: 685, y: 446, w: 71, h: 96 }
    const hand = { x: 630, y: 564, w: 180, h: 243 }
    const buttons = { x: 360, y: 822, w: 720, h: 52 }
    const at = placeInspect(wide, { w: 1440, h: 900 }, pile, [extras, hand, buttons])
    for (const box of [pile, extras, hand, buttons]) expect(hits(at, wide, box)).toBe(0)
  })
})

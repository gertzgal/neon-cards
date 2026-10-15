import { describe, expect, it } from 'vitest'
import type { EkAction, Title } from '../rules'
import type { EkCard } from '../rules/types'
import { actionForName, actionForSeat, fiveAction, onCardTap, targetSeats } from './select'

const card = (id: string, title: Title): EkCard => ({ id, deck: 'exploding-kittens', face: { title } })

describe('onCardTap', () => {
  it('plays the only skip on the first tap', () => {
    const hand = [card('s', 'skip')]
    const play: EkAction = { type: 'play', title: 'skip' }
    expect(onCardTap(hand, [play, { type: 'draw' }], [], 's')).toEqual({ send: play, selected: [] })
  })

  it('selects one of two skips, then the second tap plays it', () => {
    const hand = [card('a', 'skip'), card('b', 'skip')]
    const play: EkAction = { type: 'play', title: 'skip' }
    const first = onCardTap(hand, [play], [], 'a')
    expect(first).toEqual({ send: null, selected: ['a'] })
    expect(onCardTap(hand, [play], first.selected, 'a')).toEqual({ send: play, selected: [] })
  })

  it('sends the menu pair when only one seat can be stolen from', () => {
    const hand = [card('a', 'tacocat'), card('b', 'tacocat')]
    const pair: EkAction = { type: 'pair', title: 'tacocat', target: 'cpu-1' }
    const first = onCardTap(hand, [pair], [], 'a')
    expect(first.selected).toEqual(['a'])
    expect(onCardTap(hand, [pair], first.selected, 'b').send).toBe(pair)
  })

  it('waits for a seat when two opponents can be targeted', () => {
    const hand = [card('f', 'favor')]
    const a: EkAction = { type: 'favor', target: 'cpu-1' }
    const b: EkAction = { type: 'favor', target: 'cpu-2' }
    const tap = onCardTap(hand, [a, b], [], 'f')
    expect(tap.send).toBeNull()
    expect(targetSeats(hand, [a, b], tap.selected)).toEqual(['cpu-1', 'cpu-2'])
    expect(actionForSeat(hand, [a, b], tap.selected, 'cpu-2')).toEqual({ send: b, ask: false })
  })

  it('asks for a name after the seat of a three', () => {
    const hand = [card('a', 'beard'), card('b', 'beard'), card('c', 'beard')]
    const named: EkAction = { type: 'three', title: 'beard', target: 'cpu-1', name: 'defuse' }
    let selected: string[] = []
    for (const id of ['a', 'b', 'c']) selected = onCardTap(hand, [named], selected, id).selected
    expect(actionForSeat(hand, [named], selected, 'cpu-1')).toEqual({ send: null, ask: true })
    expect(actionForName(hand, [named], selected, 'cpu-1', 'defuse')).toBe(named)
  })

  it('builds a five from the selection and the tapped discard, not the menu entry', () => {
    const hand = [card('a', 'attack'), card('b', 'skip'), card('c', 'shuffle'), card('d', 'future'), card('e', 'favor')]
    const menu: EkAction = { type: 'five', titles: ['attack', 'skip', 'shuffle', 'future', 'favor'], takeId: 'defuse-1' }
    let selected: string[] = []
    for (const id of ['e', 'a', 'c', 'b', 'd']) selected = onCardTap(hand, [menu], selected, id).selected
    const sent = fiveAction(hand, selected, 'kitten-9')
    expect(sent).toEqual({ type: 'five', titles: ['attack', 'skip', 'favor', 'shuffle', 'future'], takeId: 'kitten-9' })
    expect(sent).not.toBe(menu)
  })
})

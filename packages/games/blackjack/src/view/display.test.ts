import { describe, expect, it } from 'vitest'
import { blackjack, parseFace, type BlackjackAction, type VisibleCard } from '../rules'
import { newGame, play, SEAT } from '../rules/test-helpers'
import { applyEvent, chipsFor, displayFromView, formatMoney, totalLabel } from './display'

const cards = (...codes: string[]): VisibleCard[] =>
  codes.map((c, i) => (c === '??' ? { id: 'hole', deck: 'standard52', face: null } : { id: String(i), deck: 'standard52', face: parseFace(c) }))

describe('chipsFor', () => {
  it.each([
    [5, [5]],
    [50, [25, 25]],
    [130, [100, 25, 5]],
    [1250, [500, 500, 100, 100, 25, 25]],
    [0, []],
  ])('%i breaks into %j', (amount, chips) => {
    expect(chipsFor(amount)).toEqual(chips)
  })
})

describe('totalLabel', () => {
  it.each([
    [['8H', '8S'], '16'],
    [['AH', '6S'], '7/17'],
    [['AH', 'KS'], '21'],
    [['AH', '6S', 'KC'], '17'],
    [['9C', '??'], '9'],
    [['AC', '??'], '11'],
    [[], ''],
  ])('%j reads %s', (codes, label) => {
    expect(totalLabel(cards(...codes))).toBe(label)
  })
})

describe('formatMoney', () => {
  it('formats with thousands separators and a sign', () => {
    expect(formatMoney(1250)).toBe('$1,250')
    expect(formatMoney(-75)).toBe('-$75')
  })
})

describe('applyEvent', () => {
  const scenarios: [string, BlackjackAction['type'][]][] = [
    ['blackjack', []],
    ['bust', ['hit']],
    ['win', ['stand']],
    ['push', ['stand']],
    ['dealerbj', []],
    ['bjpush', []],
    ['double', ['double']],
    ['split', ['split', 'hit', 'stand', 'stand']],
    ['split', ['split', 'double', 'stand']],
    ['splitaces', ['split']],
    ['dealerbust', ['stand']],
  ]

  it.each(scenarios)('replaying %s %j lands on the server view', (rig, actions) => {
    const game = newGame({ rig })
    let display = displayFromView(blackjack.view(game.state, SEAT))
    let state = game.state
    for (const action of [{ type: 'bet', amount: 50 } as BlackjackAction, ...actions.map((type) => ({ type }) as BlackjackAction)]) {
      const out = play(state, game.rng, action)
      state = out.state
      display = out.events.reduce(applyEvent, display)
      expect(display).toEqual(displayFromView(out.view))
    }
  })

  it('shows the dealing stage between the bet and the first turn', () => {
    const { state, rng } = newGame({ rig: 'win' })
    const { events } = play(state, rng, { type: 'bet', amount: 50 })
    const midDeal = events.slice(0, 3).reduce(applyEvent, displayFromView(blackjack.view(state, SEAT)))
    expect(midDeal.stage).toBe('dealing')
    expect(midDeal.stack).toBe(1200)
    expect(midDeal.hands.map((h) => h.cards.map((c) => c.face && c.face.rank + c.face.suit))).toEqual([['10H']])
    expect(midDeal.dealer.map((c) => c.face && c.face.rank + c.face.suit)).toEqual(['9C'])
  })
})

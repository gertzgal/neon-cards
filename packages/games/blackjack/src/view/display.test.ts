import { describe, expect, it } from 'vitest'
import { blackjack, parseFace, type BlackjackAction, type VisibleCard } from '../rules'
import { newGame, play, rigged, SEAT } from '../rules/test-helpers'
import { applyEvent, bankrollOf, chipsFor, displayFromView, formatMoney, rebetChips, totalLabel } from './display'

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

describe('rebetChips', () => {
  it('puts the last bet back after a round, keeping the chips the player used', () => {
    const won = rigged('win', 50, ['stand'])
    expect(rebetChips(won.view, [25, 5, 5, 5, 5, 5])).toEqual([25, 5, 5, 5, 5, 5])
    expect(rebetChips(won.view, [])).toEqual([25, 25])
  })

  it('rebuilds the rebet from the view alone when the table remounts with no chip memory', () => {
    const resumed = blackjack.view(rigged('push', 130, ['stand']).state, SEAT)
    expect(resumed.phase).toBe('settling')
    expect(rebetChips(resumed, [])).toEqual([100, 25, 5])
    expect(rebetChips(blackjack.view(newGame().state, SEAT), [])).toEqual([])
  })

  it('places nothing when the stack no longer covers the last bet', () => {
    const lost = rigged('lose', 500, ['stand'], { bankroll: 600 })
    expect(lost.view.stack).toBe(100)
    expect(rebetChips(lost.view, [500])).toEqual([])
  })

  it('places nothing after going broke on an all-in and refilling', () => {
    const allIn = [500, 500, 100, 100, 25, 25] as const
    const broke = rigged('lose', 1250, ['stand'])
    expect(rebetChips(broke.view, allIn)).toEqual([])
    const refilled = play(broke.state, broke.rng, { type: 'refill' })
    expect(refilled.view.stack).toBe(1250)
    expect(rebetChips(refilled.view, allIn)).toEqual([])
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

  it('keeps the shown total while a pending face-down card is in flight', () => {
    const pending = { id: 'optimistic-0-2', deck: 'optimistic', face: null }
    expect(totalLabel([...cards('AH', '6S'), pending])).toBe('7/17')
    expect(totalLabel([...cards('10H', '6S'), pending])).toBe('16')
  })
})

describe('bankrollOf', () => {
  it('shows the wallet: felt chips and an in-play wager stay in the number until the round settles', () => {
    const seated = displayFromView(blackjack.view(newGame().state, SEAT))
    expect(bankrollOf(seated)).toBe(1250)

    const dealt = rigged('win', 100)
    const inPlay = displayFromView(dealt.view)
    expect(inPlay.stack).toBe(1150)
    expect(bankrollOf(inPlay)).toBe(1250)

    const doubled = displayFromView(rigged('split', 50, ['split', 'double']).view)
    expect(bankrollOf(doubled)).toBe(1250)

    const settled = displayFromView(rigged('win', 100, ['stand']).view)
    expect(settled.stage).toBe('settling')
    expect(bankrollOf(settled)).toBe(settled.stack)
    expect(bankrollOf(settled)).toBe(1350)
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

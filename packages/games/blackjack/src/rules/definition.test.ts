import { describe, expect, it } from 'vitest'
import { ConfigError, IllegalActionError } from '@neon-cards/engine'
import { blackjack } from './definition'
import { rules } from './index'
import { codes, newGame, play, rigged, SEAT, types } from './test-helpers'

describe('setup', () => {
  it('seats the player at the betting step with a full 6-deck shoe', () => {
    const { state } = newGame()
    const view = blackjack.view(state, SEAT)
    expect(blackjack.phase(state)).toBe('betting')
    expect(view.stack).toBe(1250)
    expect(view.legal).toEqual(['bet'])
    expect(view.shoe).toEqual({ remaining: 312, size: 312 })
    expect(view.hands).toEqual([])
    expect(view.dealer).toEqual({ cards: [], total: null, soft: false })
  })

  it('needs a non-house seat', () => {
    expect(() => blackjack.setup(blackjack.defaultConfig, [{ id: 'h', kind: 'house', name: 'House' }], newGame().rng)).toThrow(
      'Blackjack needs one player seat',
    )
  })
})

describe('config and seats', () => {
  it('seats one human and the house dealer, and the human always acts', () => {
    expect(blackjack.seatsFor(blackjack.defaultConfig)).toEqual([
      { id: 'player', kind: 'human', name: 'You' },
      { id: 'dealer', kind: 'house', name: 'Dealer' },
    ])
    expect(blackjack.seats).toEqual({ min: 2, max: 2 })
    expect(blackjack.toAct(newGame().state)).toBe('player')
    expect(blackjack.toAct(rigged('win', 50).state)).toBe('player')
    expect(blackjack.toAct(rigged('win', 50, ['stand']).state)).toBe('player')
  })

  it('parses a rig and a bankroll over the house defaults', () => {
    expect(blackjack.parseConfig(undefined)).toEqual({ decks: 6, minBet: 5, betStep: 5, bankroll: 1250, refillTo: 1250, reshuffleAt: 0.25 })
    expect(blackjack.parseConfig({ rig: 'split', bankroll: 300, decks: 1 })).toEqual({
      decks: 6,
      minBet: 5,
      betStep: 5,
      bankroll: 300,
      refillTo: 1250,
      reshuffleAt: 0.25,
      rig: 'split',
    })
  })

  it.each([
    ['a string', 'x', 'Config must be an object'],
    ['an array', [], 'Config must be an object'],
    ['an empty rig', { rig: '' }, 'rig must be a non-empty string'],
    ['an unknown card', { rig: 'AH,1Z' }, 'Bad card code "1Z"'],
    ['a fractional bankroll', { bankroll: 10.5 }, 'bankroll must be a whole number of chips'],
    ['a negative bankroll', { bankroll: -5 }, 'bankroll must be a whole number of chips'],
  ])('rejects %s', (_, input, message) => {
    expect(() => blackjack.parseConfig(input)).toThrow(message)
    expect(() => blackjack.parseConfig(input)).toThrow(ConfigError)
  })
})

describe('betting', () => {
  it('rejects bets that are too small, off-step, fractional, or above the stack', () => {
    const { state, rng } = newGame()
    const bet = (amount: number) => () => blackjack.apply(state, SEAT, { type: 'bet', amount }, rng)
    expect(bet(3)).toThrow('Bet must be at least 5')
    expect(bet(7)).toThrow('Bet must be a multiple of 5')
    expect(bet(12.5)).toThrow('Bet must be a whole number')
    expect(bet(1255)).toThrow('Bet exceeds stack')
    expect(bet(1250)).not.toThrow()
  })

  it('rejects play actions before a bet and actions from another seat', () => {
    const { state, rng } = newGame()
    expect(() => blackjack.apply(state, SEAT, { type: 'hit' }, rng)).toThrow(IllegalActionError)
    expect(() => blackjack.apply(state, SEAT, { type: 'hit' }, rng)).toThrow('"hit" is not legal now')
    expect(blackjack.legalActions(state, 'p2')).toEqual([])
    expect(() => blackjack.apply(state, 'p2', { type: 'bet', amount: 5 }, rng)).toThrow('"bet" is not legal now')
  })

  it('suggests the last bet, capped by the stack', () => {
    const first = rigged('win', 50, ['stand'])
    expect(blackjack.legalActions(first.state, SEAT)).toEqual([{ type: 'bet', amount: 50 }])
    const short = rigged('lose', 60, ['stand'], { bankroll: 100 })
    expect(short.view.stack).toBe(40)
    expect(blackjack.legalActions(short.state, SEAT)).toEqual([{ type: 'bet', amount: 40 }])
  })

  it('deals player, dealer up, player, dealer hole', () => {
    const { events, view } = rigged('win', 50)
    expect(types(events)).toEqual(['bet', 'deal', 'deal', 'deal', 'deal', 'turn'])
    expect(events[0]).toEqual({ type: 'bet', seat: SEAT, amount: 50, stack: 1200 })
    expect(events.slice(1, 5).map((e) => (e.type === 'deal' ? e.seat : ''))).toEqual([SEAT, 'dealer', SEAT, 'dealer'])
    expect(view.hands.map((h) => codes(h.cards))).toEqual([['10H', '9S']])
    expect(view.phase).toBe('playing')
    expect(view.legal).toEqual(['hit', 'stand', 'double'])
    expect(view.hands[0]).toMatchObject({ bet: 50, total: 19, soft: false, status: 'active' })
  })
})

describe('hidden information', () => {
  it('hides the hole card in the view and in the deal event', () => {
    const { state, events, view } = rigged('win', 50)
    const holeId = state.dealer[1]?.id
    expect(holeId).toMatch(/^standard52-\d+$/)
    expect(view.dealer).toEqual({
      cards: [state.dealer[0], { id: 'hole', deck: 'standard52', face: null }],
      total: 9,
      soft: false,
    })
    expect(events[4]).toEqual({ type: 'deal', seat: 'dealer', hand: 0, card: { id: 'hole', deck: 'standard52', face: null } })
    expect(JSON.stringify(view)).not.toContain(`"${holeId}"`)
    expect(JSON.stringify(events)).not.toContain(`"${holeId}"`)
    expect(view.shoe).toEqual({ remaining: 308, size: 312 })
  })

  it('shows the hole card once the dealer reveals it', () => {
    const { events, view } = rigged('win', 50, ['stand'])
    expect(codes(view.dealer.cards)).toEqual(['9C', '8D'])
    expect(view.dealer.total).toBe(17)
    const reveal = events.find((e) => e.type === 'reveal')
    expect(reveal && reveal.type === 'reveal' && codes([reveal.card])).toEqual(['8D'])
  })

  it('reports a soft total over only the face-up dealer card', () => {
    const { view } = rigged('soft17', 50)
    expect(view.dealer.total).toBe(11)
    expect(view.dealer.soft).toBe(true)
  })
})

describe('dealer peek', () => {
  it('peeks under a ten or an ace and plays on when there is no blackjack', () => {
    expect(types(rigged('lose', 50).events)).toEqual(['bet', 'deal', 'deal', 'deal', 'deal', 'peek', 'turn'])
    expect(types(rigged('soft17', 50).events)).toEqual(['bet', 'deal', 'deal', 'deal', 'deal', 'peek', 'turn'])
  })

  it('does not peek under a 2 through 9', () => {
    expect(types(rigged('win', 50).events)).not.toContain('peek')
  })

  it('ends the round at once on dealer blackjack and takes only the original bet', () => {
    const { events, view } = rigged('dealerbj', 50)
    expect(types(events)).toEqual(['bet', 'deal', 'deal', 'deal', 'deal', 'reveal', 'dealerBlackjack', 'handResult', 'roundEnd'])
    expect(view.phase).toBe('settling')
    expect(view.dealer.total).toBe(21)
    expect(view.hands[0]).toMatchObject({ status: 'stood', outcome: 'lose', payout: 0 })
    expect(view.stack).toBe(1200)
    expect(view.result).toEqual({ wagered: 50, payout: 0, net: -50 })
  })
})

describe('blackjack', () => {
  it('pays 3:2 immediately without the dealer drawing', () => {
    const { events, view } = rigged('blackjack', 50)
    expect(types(events)).toEqual(['bet', 'deal', 'deal', 'deal', 'deal', 'blackjack', 'reveal', 'handResult', 'roundEnd'])
    expect(events.at(-2)).toEqual({ type: 'handResult', seat: SEAT, hand: 0, outcome: 'blackjack', bet: 50, payout: 125 })
    expect(events.at(-1)).toEqual({ type: 'roundEnd', seat: SEAT, wagered: 50, payout: 125, net: 75, stack: 1325 })
    expect(codes(view.dealer.cards)).toEqual(['9C', '7D'])
    expect(view.hands[0]).toMatchObject({ status: 'blackjack', outcome: 'blackjack', total: 21, soft: true })
  })

  it.each([
    [5, 12, 7],
    [25, 62, 37],
    [100, 250, 150],
    [15, 37, 22],
  ])('a %i bet is paid %i back (net %i), rounding half chips down', (bet, payout, net) => {
    expect(rigged('blackjack', bet).view.result).toEqual({ wagered: bet, payout, net })
  })

  it('pushes against a dealer blackjack', () => {
    const { events, view } = rigged('bjpush', 50)
    expect(types(events)).toEqual([
      'bet', 'deal', 'deal', 'deal', 'deal', 'blackjack', 'reveal', 'dealerBlackjack', 'handResult', 'roundEnd',
    ])
    expect(view.hands[0]).toMatchObject({ outcome: 'push', payout: 50 })
    expect(view.stack).toBe(1250)
  })
})

describe('hit and stand', () => {
  it('busts over 21, and the dealer reveals without drawing', () => {
    const { events, view } = rigged('bust', 50, ['hit'])
    expect(types(events).slice(6)).toEqual(['deal', 'bust', 'reveal', 'handResult', 'roundEnd'])
    expect(events.find((e) => e.type === 'bust')).toEqual({ type: 'bust', seat: SEAT, hand: 0, total: 26 })
    expect(codes(view.dealer.cards)).toEqual(['9C', '7D'])
    expect(view.hands[0]).toMatchObject({ status: 'bust', total: 26, outcome: 'lose', payout: 0 })
    expect(view.stack).toBe(1200)
  })

  it('auto-stands on 21 after a hit', () => {
    const { events, view } = rigged('5H,9C,6S,7D,KC,2D', 50, ['hit'])
    expect(types(events).slice(6)).toEqual(['deal', 'reveal', 'deal', 'handResult', 'roundEnd'])
    expect(view.hands[0]).toMatchObject({ total: 21, status: 'stood', outcome: 'win', payout: 100 })
    expect(view.dealer.total).toBe(18)
    expect(view.stack).toBe(1300)
  })

  it.each([
    ['win', 'win', 100, 1300, 17],
    ['lose', 'lose', 0, 1200, 19],
    ['push', 'push', 50, 1250, 18],
    ['soft17', 'win', 100, 1300, 17],
  ])('rig %s: standing settles as %s', (rig, outcome, payout, stack, dealerTotal) => {
    const { view } = rigged(rig, 50, ['stand'])
    expect(view.hands[0]).toMatchObject({ outcome, payout })
    expect(view.stack).toBe(stack)
    expect(view.dealer.total).toBe(dealerTotal)
  })

  it('dealer stands on soft 17', () => {
    expect(codes(rigged('soft17', 50, ['stand']).view.dealer.cards)).toEqual(['AC', '6D'])
  })

  it('dealer hits soft 16', () => {
    const { view } = rigged('10H,AC,9S,5D,3C', 50, ['stand'])
    expect(codes(view.dealer.cards)).toEqual(['AC', '5D', '3C'])
    expect(view.dealer).toMatchObject({ total: 19, soft: true })
    expect(view.hands[0]).toMatchObject({ outcome: 'push', payout: 50 })
  })

  it('dealer busts and the player wins', () => {
    const { events, view } = rigged('dealerbust', 50, ['stand'])
    expect(events.find((e) => e.type === 'dealerBust')).toEqual({ type: 'dealerBust', seat: 'dealer', total: 25 })
    expect(view.hands[0]).toMatchObject({ total: 16, outcome: 'win', payout: 100 })
    expect(view.stack).toBe(1300)
  })
})

describe('double', () => {
  it('doubles the bet, deals exactly one card, then the dealer plays', () => {
    const { events, view } = rigged('double', 50, ['double'])
    expect(types(events).slice(6)).toEqual(['double', 'deal', 'reveal', 'deal', 'handResult', 'roundEnd'])
    expect(events[6]).toEqual({ type: 'double', seat: SEAT, hand: 0, amount: 50, stack: 1150 })
    expect(view.hands[0]).toMatchObject({ bet: 100, doubled: true, total: 21, status: 'stood', outcome: 'win', payout: 200 })
    expect(view.dealer.total).toBe(18)
    expect(view.stack).toBe(1350)
  })

  it('is not offered after a hit', () => {
    expect(rigged('5H,9C,2S,7D,2C', 50, ['hit']).view.legal).toEqual(['hit', 'stand'])
  })

  it('is not offered when the stack cannot cover it', () => {
    expect(rigged('win', 50, [], { bankroll: 60 }).view.legal).toEqual(['hit', 'stand'])
  })
})

describe('split', () => {
  it('splits a pair into two hands and plays them in order', () => {
    const afterSplit = rigged('split', 50, ['split'])
    expect(rigged('split', 50).view.legal).toEqual(['hit', 'stand', 'double', 'split'])
    expect(types(afterSplit.events).slice(6)).toEqual(['split', 'deal', 'deal', 'turn'])
    expect(afterSplit.events[6]).toEqual({ type: 'split', seat: SEAT, amount: 50, stack: 1150 })
    expect(afterSplit.view.hands.map((h) => codes(h.cards))).toEqual([['8H', '3C'], ['8S', '10D']])
    expect(afterSplit.view.hands.map((h) => h.total)).toEqual([11, 18])
    expect(afterSplit.view.active).toBe(0)
    expect(afterSplit.view.legal).toEqual(['hit', 'stand', 'double'])

    const { state, rng } = afterSplit
    const hit = play(state, rng, { type: 'hit' })
    expect(hit.view.hands.map((h) => h.total)).toEqual([13, 18])
    expect(hit.view.active).toBe(0)
    const standOne = play(hit.state, rng, { type: 'stand' })
    expect(standOne.events.at(-1)).toEqual({ type: 'turn', seat: SEAT, hand: 1 })
    expect(standOne.view.active).toBe(1)
    const done = play(standOne.state, rng, { type: 'stand' })
    expect(codes(done.view.dealer.cards)).toEqual(['9C', '7D', 'KH'])
    expect(done.view.hands.map((h) => [h.outcome, h.payout])).toEqual([['win', 100], ['win', 100]])
    expect(done.view.result).toEqual({ wagered: 100, payout: 200, net: 100 })
    expect(done.view.stack).toBe(1350)
  })

  it('allows a double after a split', () => {
    const { view } = rigged('split', 50, ['split', 'double', 'stand'])
    expect(view.hands.map((h) => [h.bet, h.total, h.outcome, h.payout])).toEqual([
      [100, 13, 'win', 200],
      [50, 18, 'win', 100],
    ])
    expect(view.result).toEqual({ wagered: 150, payout: 300, net: 150 })
    expect(view.stack).toBe(1400)
  })

  it('gives split aces one card each and pays their 21s 1:1', () => {
    const { events, view } = rigged('splitaces', 50, ['split'])
    expect(types(events).slice(6)).toEqual(['split', 'deal', 'deal', 'reveal', 'deal', 'handResult', 'handResult', 'roundEnd'])
    expect(view.hands.map((h) => [codes(h.cards), h.total, h.status, h.outcome, h.payout])).toEqual([
      [['AH', 'KC'], 21, 'stood', 'win', 100],
      [['AS', 'QD'], 21, 'stood', 'win', 100],
    ])
    expect(view.stack).toBe(1350)
  })

  it('treats a ten-card plus ace after a split as 21, not blackjack', () => {
    const { state, rng, events, view } = rigged('KH,9C,KS,7D,AC,5D,3S', 50, ['split'])
    expect(events.at(-1)).toEqual({ type: 'turn', seat: SEAT, hand: 1 })
    expect(view.hands[0]).toMatchObject({ total: 21, status: 'stood' })
    const done = play(state, rng, { type: 'stand' })
    expect(done.view.hands.map((h) => [h.outcome, h.payout])).toEqual([['win', 100], ['lose', 0]])
    expect(done.view.stack).toBe(1250)
  })

  it('splits any two ten-value cards', () => {
    expect(rigged('KH,9C,10S,7D', 50).view.legal).toEqual(['hit', 'stand', 'double', 'split'])
  })

  it('allows only one split', () => {
    expect(rigged('8H,9C,8S,7D,8C,10D', 50, ['split']).view.legal).toEqual(['hit', 'stand', 'double'])
  })

  it('is not offered when the stack cannot cover it', () => {
    expect(rigged('split', 50, [], { bankroll: 60 }).view.legal).toEqual(['hit', 'stand'])
  })
})

describe('refill', () => {
  it('offers only a refill once the stack is below the minimum bet', () => {
    const broke = rigged('lose', 50, ['stand'], { bankroll: 50 })
    expect(broke.view.stack).toBe(0)
    expect(blackjack.legalActions(broke.state, SEAT)).toEqual([{ type: 'refill' }])
    expect(() => blackjack.apply(broke.state, SEAT, { type: 'bet', amount: 5 }, broke.rng)).toThrow('"bet" is not legal now')
    const refilled = play(broke.state, broke.rng, { type: 'refill' })
    expect(refilled.events).toEqual([{ type: 'refill', seat: SEAT, amount: 1250, stack: 1250 }])
    expect(refilled.view.stack).toBe(1250)
    expect(refilled.view.legal).toEqual(['bet'])
    expect(refilled.view.phase).toBe('betting')
    expect(refilled.view.hands).toEqual([])
    expect(refilled.view.result).toBe(null)
  })

  it('tops a nearly broke stack up to the refill amount', () => {
    const { state, rng } = newGame({ bankroll: 3 })
    expect(play(state, rng, { type: 'refill' }).events).toEqual([{ type: 'refill', seat: SEAT, amount: 1247, stack: 1250 }])
  })

  it('is not offered while the stack covers the minimum bet', () => {
    const { state, rng } = newGame({ bankroll: 5 })
    expect(() => blackjack.apply(state, SEAT, { type: 'refill' }, rng)).toThrow('"refill" is not legal now')
  })
})

describe('shoe', () => {
  it('reshuffles before a round when fewer than 25% of cards remain', () => {
    const { state, rng } = newGame()
    const low = play({ ...state, shoe: state.shoe.slice(0, 77) }, rng, { type: 'bet', amount: 10 })
    expect(low.events[0]).toEqual({ type: 'shuffle', size: 312 })
    expect(low.view.shoe).toEqual({ remaining: 308, size: 312 })

    const enough = play({ ...state, shoe: state.shoe.slice(0, 78) }, rng, { type: 'bet', amount: 10 })
    expect(types(enough.events)).not.toContain('shuffle')
    expect(enough.view.shoe).toEqual({ remaining: 74, size: 312 })
  })

  it('gives a reshuffled shoe fresh card ids so they never collide with the previous shoe', () => {
    const { state, rng } = newGame()
    expect(state.shoe[0]?.id).toMatch(/^standard52-\d+$/)
    const low = play({ ...state, round: 6, shoe: state.shoe.slice(0, 10) }, rng, { type: 'bet', amount: 10 })
    expect(low.state.shoe.map((c) => c.id.replace(/-\d+$/, ''))).toEqual(Array(308).fill('standard52.r7'))
  })

  it('keeps every card id unique across a rigged shoe', () => {
    const { state } = rigged('split', 50)
    const ids = [...state.shoe, ...state.dealer, ...state.hands.flatMap((h) => h.cards)].map((c) => c.id)
    expect(ids).toHaveLength(312)
    expect(new Set(ids).size).toBe(312)
  })
})

describe('purity and replay', () => {
  it('does not mutate the input state', () => {
    const { state, rng } = newGame()
    const before = JSON.stringify(state)
    blackjack.apply(state, SEAT, { type: 'bet', amount: 25 }, rng)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('replays a session identically from the same seed and action log', () => {
    const run = (seed: number) => {
      const game = newGame({}, seed)
      const rng = game.rng
      let state = game.state
      const log = []
      for (let round = 0; round < 30; round++) {
        let out = play(state, rng, { type: 'bet', amount: 25 })
        while (out.view.phase === 'playing') {
          const action = (out.view.hands[out.view.active]?.total ?? 0) < 17 ? 'hit' : 'stand'
          out = play(out.state, rng, { type: action })
        }
        state = out.state
        log.push(out.view.result?.net)
      }
      return { state: JSON.stringify(state), log }
    }
    const a = run(42)
    expect(run(42)).toEqual(a)
    expect(run(43).state).not.toBe(a.state)
  })
})

describe('settle', () => {
  it('reports the round net for the seat once settled', () => {
    expect(blackjack.settle(rigged('blackjack', 50).state)).toEqual([{ seat: SEAT, delta: 75 }])
    expect(blackjack.settle(rigged('split', 50, ['split', 'double', 'stand']).state)).toEqual([{ seat: SEAT, delta: 150 }])
  })

  it('refuses before the round is settled', () => {
    expect(() => blackjack.settle(newGame().state)).toThrow('Round is not settled')
    expect(() => blackjack.settle(rigged('win', 50).state)).toThrow('Round is not settled')
  })

  it('starts the next round from the settled state', () => {
    const first = rigged('blackjack', 50)
    const second = play(first.state, first.rng, { type: 'bet', amount: 50 })
    expect(second.view.round).toBe(2)
    expect(second.view.stack).toBe(1400)
    expect(second.view.result).toEqual({ wagered: 50, payout: 125, net: 75 })
  })
})

describe('rules', () => {
  it('registers as a chips game with a 5 minimum bet and no settings', () => {
    expect(rules.definition).toBe(blackjack)
    expect(rules.meta).toEqual({
      title: 'Blackjack',
      description: 'Beat the dealer to 21. Blackjack pays 3:2, dealer stands on all 17s.',
      economy: 'chips',
      minBet: 5,
    })
  })
})

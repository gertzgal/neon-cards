import { describe, expect, it } from 'vitest'
import { soloSeats, createRng, IllegalActionError } from '@neon-cards/engine'
import { roundValue, scoreParts } from './cards'
import { flip7, HUMAN } from './definition'
import { RIGS } from './rigs'
import { card, game, give, keys, lineKeys, play, rigNext, status, table, types, type Game } from './test-helpers'
import type { Flip7State, SeatRound } from './types'

const hit = (g: Game) => play(g, { type: 'hit' })
const stay = (g: Game) => play(g, { type: 'stay' })
const to = (g: Game) => flip7.toAct(g.s)
const pending = (g: Game) => g.s.pending
const seatRound = (keysOf: string[], extra: Partial<SeatRound> = {}): SeatRound => {
  const round: SeatRound = { status: 'stayed', line: { numbers: [], modifiers: [], secondChance: null, freeze: null }, flip7: false, ...extra }
  for (const k of keysOf) {
    const c = card(k)
    if (c.face.kind === 'number') round.line.numbers.push(c)
    else round.line.modifiers.push(c)
  }
  return round
}
/** Stays every CPU until the human is to act again (or the round ends). */
function cpusStay(g: Game): Game {
  while (to(g) !== null && to(g) !== HUMAN && g.s.stage === 'playing') g = stay(g)
  return g
}

describe('setup and the initial deal', () => {
  it('starts ready, with nobody to act until the opening deal, and no cards out', () => {
    const { s } = table(RIGS.bust)
    expect(s.stage).toBe('ready')
    expect(flip7.toAct(s)).toBeNull()
    expect(flip7.opening?.(s)).toEqual({ type: 'nextRound' })
    expect(flip7.legalActions(s, HUMAN)).toEqual([])
    expect(flip7.phase(s)).toBe('playing')
    expect(s.draw).toHaveLength(94)
  })

  it('deals one card face up to each seat from the dealer\'s left, ending with the dealer', () => {
    const g = game('you=5;cpu-1=6;cpu-2=7')
    expect(g.last.filter((e) => e.type === 'CardDealt').map((e) => (e.type === 'CardDealt' ? [e.seat, e.source] : []))).toEqual([
      ['you', 'initial'],
      ['cpu-1', 'initial'],
      ['cpu-2', 'initial'],
    ])
    expect([lineKeys(g.s, 'you'), lineKeys(g.s, 'cpu-1'), lineKeys(g.s, 'cpu-2')]).toEqual([['5'], ['6'], ['7']])
    expect(pending(g)).toEqual({ kind: 'hitOrStay', seat: 'you' })
  })

  it('deals from the last seat on every seed, so the first card goes to the first seat', () => {
    const config = flip7.parseConfig({})
    const seats = soloSeats(flip7, config)
    const dealers = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => flip7.setup(config, seats, createRng(seed)).dealer)
    expect(new Set(dealers)).toEqual(new Set([seats[seats.length - 1]?.id]))
  })
})

describe('config and seats', () => {
  it('defaults to two medium CPUs and builds seats in turn order', () => {
    const config = flip7.parseConfig({})
    expect(config).toEqual({ opponents: 2, difficulty: 'medium' })
    expect(soloSeats(flip7, flip7.parseConfig({ opponents: 3, difficulty: 'hard' }))).toEqual([
      { id: 'you', kind: 'human', name: 'You' },
      { id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'hard' },
      { id: 'cpu-2', kind: 'cpu', name: 'CPU 2', difficulty: 'hard' },
      { id: 'cpu-3', kind: 'cpu', name: 'CPU 3', difficulty: 'hard' },
    ])
  })

  it('rejects bad settings and bad rigs', () => {
    expect(() => flip7.parseConfig({ opponents: 4 })).toThrow('opponents must be one of')
    expect(() => flip7.parseConfig({ difficulty: 'expert' })).toThrow('difficulty must be one of')
    expect(() => flip7.parseConfig({ rig: 'you=13' })).toThrow('unknown rig face "13"')
    expect(() => flip7.parseConfig({ rig: 5 })).toThrow('rig must be a non-empty string')
  })
})

describe('hit, stay, and scoring', () => {
  it('banks the line on stay', () => {
    let g = game('you=9;cpu=1')
    g = stay(g)
    expect(g.last).toEqual([{ type: 'Stayed', seat: 'you', banked: 9 }])
    expect(status(g.s, 'you')).toBe('stayed')
    expect(to(g)).toBe('cpu-1')
  })

  it('E1: a bust scores 0 and its cards stay on the table until the round ends', () => {
    let g = game('you=5,+4,5;cpu=12')
    g = hit(cpusStay(hit(g)))
    expect(types(g.last)).toEqual(['CardDealt', 'Busted', 'RoundScored'])
    expect(status(g.s, 'you')).toBe('busted')
    expect(lineKeys(g.s, 'you')).toEqual(['5', '5'])
    expect(flip7.view(g.s, 'you').seats['you']?.roundValue).toBe(0)
    expect(g.s.stage).toBe('roundOver')
    expect(g.s.lastScores?.find((r) => r.seat === 'you')).toMatchObject({ busted: true, round: 0, total: 0 })
    expect(flip7.phase(g.s)).toBe('settling')
    const discardsBefore = g.s.discard.length
    g = play(g, { type: 'nextRound' })
    expect(g.s.discard.length).toBeGreaterThanOrEqual(discardsBefore + 3)
    expect(keys(g.s.discard)).toEqual(expect.arrayContaining(['5', '5', '+4']))
  })

  it('E7: x2 doubles only the number cards, and + modifiers add after', () => {
    let g = game(RIGS.mods)
    for (let i = 0; i < 3; i++) g = cpusStay(hit(g))
    expect(flip7.view(g.s, 'you').seats['you']?.roundValue).toBe(26)
    expect(roundValue(seatRound(['12', '11', '10', '3']))).toBe(36)
    expect(roundValue(seatRound(['12', '11', '10', '3', 'x2']))).toBe(72)
    expect(roundValue(seatRound(['12', '11', '10', '3', '+10']))).toBe(46)
  })

  it('E8: modifiers alone still score their +, and x2 alone scores 0', () => {
    expect(roundValue(seatRound(['+2', '+6', 'x2']))).toBe(8)
    expect(roundValue(seatRound(['x2']))).toBe(0)
    let g = game('you=+2,+6,x2;cpu=12')
    g = cpusStay(hit(g))
    g = cpusStay(hit(g))
    g = stay(g)
    expect(g.last).toContainEqual({ type: 'Stayed', seat: 'you', banked: 8 })
  })

  it('E23: the 0 counts as a unique number worth 0', () => {
    let g = game('you=0,1,2,3,4,5,6;cpu=12')
    for (let i = 0; i < 5; i++) g = cpusStay(hit(g))
    g = hit(g)
    expect(types(g.last)).toEqual(['CardDealt', 'Flip7Achieved', 'RoundScored'])
    expect(g.s.lastScores?.find((r) => r.seat === 'you')).toMatchObject({ numbers: 21, flip7Bonus: 15, round: 36, total: 36 })
  })

  it('scores the maximum line: 7 high numbers, x2, every +, and Flip 7 is 171', () => {
    expect(scoreParts(seatRound(['12', '11', '10', '9', '8', '7', '6', 'x2', '+2', '+4', '+6', '+8', '+10'], { flip7: true })).value).toBe(171)
  })
})

describe('Flip 7', () => {
  it('ends the round for everyone at once, with +15 for the flipper and line scores for the rest', () => {
    let g = game(RIGS.flip7)
    for (let i = 0; i < 5; i++) g = cpusStay(hit(g))
    expect(g.s.stage).toBe('playing')
    g = hit(g)
    expect(g.last).toContainEqual({ type: 'Flip7Achieved', seat: 'you', numbers: [1, 2, 3, 4, 5, 6, 7] })
    expect(g.s.stage).toBe('roundOver')
    expect(g.s.totals).toEqual({ you: 43, 'cpu-1': 12, 'cpu-2': 12 })
    expect(g.s.rounds['you']?.flip7).toBe(true)
    expect(flip7.toAct(g.s)).toBeNull()
    expect(flip7.opening?.(g.s)).toEqual({ type: 'nextRound' })
    expect(flip7.legalActions(g.s, HUMAN)).toEqual([])
  })

  it('E5: an unused Second Chance is discarded when the round ends', () => {
    let g = game('you=S,4;cpu=12')
    g = cpusStay(hit(g))
    g = stay(g)
    expect(g.s.stage).toBe('roundOver')
    g = play(g, { type: 'nextRound' })
    expect(keys(g.s.discard)).toContain('S')
    expect(g.s.rounds['you']?.line.secondChance).toBeNull()
  })
})

describe('Freeze', () => {
  it('E2: a Freeze dealt in the initial deal can freeze a seat that has not been dealt yet', () => {
    let g = game('you=F;cpu=12')
    expect(pending(g)).toMatchObject({ kind: 'target', seat: 'you' })
    expect(flip7.legalActions(g.s, 'you')).toEqual([
      { type: 'target', to: 'you' },
      { type: 'target', to: 'cpu-1' },
      { type: 'target', to: 'cpu-2' },
    ])
    g = play(g, { type: 'target', to: 'cpu-2' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'Frozen', 'CardDealt'])
    expect(g.last[1]).toMatchObject({ type: 'Frozen', seat: 'cpu-2', by: 'you', banked: 0 })
    expect(status(g.s, 'cpu-2')).toBe('frozen')
    expect(lineKeys(g.s, 'cpu-2')).toEqual([])
    expect(keys([g.s.rounds['cpu-2']?.line.freeze ?? card('0')])).toEqual(['F'])
  })

  it('E3: a seat may freeze itself, banking its line', () => {
    let g = game('you=3,F;cpu=12')
    g = hit(g)
    g = play(g, { type: 'target', to: 'you' })
    expect(g.last).toContainEqual(expect.objectContaining({ type: 'Frozen', seat: 'you', by: 'you', banked: 3 }))
    expect(status(g.s, 'you')).toBe('frozen')
  })

  it('E10: the only active seat must take its own Freeze, with no decision', () => {
    let h = game('you=3,4,F;cpu=12', 1)
    h = cpusStay(hit(h))
    expect(pending(h)).toEqual({ kind: 'hitOrStay', seat: 'you' })
    h = hit(h)
    expect(types(h.last)).toEqual(['CardDealt', 'ActionTargeted', 'Frozen', 'RoundScored'])
    expect(h.last[1]).toMatchObject({ seat: 'you', to: 'you' })
  })

  it('E18: a Second Chance does not block a Freeze', () => {
    let h = game('you=S,F;cpu=12')
    h = hit(h)
    h = play(h, { type: 'target', to: 'you' })
    expect(status(h.s, 'you')).toBe('frozen')
  })

  it('E22: stayed, busted, and frozen seats are not legal targets', () => {
    let h = game('you=4,5,F;cpu=12,1')
    h = stay(hit(h))
    h = hit(h)
    expect(status(h.s, 'cpu-1')).toBe('stayed')
    expect(to(h)).toBe('you')
    h = hit(h)
    expect(pending(h)).toMatchObject({ kind: 'target', seat: 'you' })
    expect(flip7.view(h.s, 'you').legalTargets).not.toContain('cpu-1')
    expect(() => play(h, { type: 'target', to: 'cpu-1' })).toThrow(IllegalActionError)
  })
})

describe('Flip Three', () => {
  it('E13 + E14: a Flip Three in the initial deal hits any seat; a seat holding cards when the deal reaches it is asked instead', () => {
    let g = game('you=T;cpu-1=9;cpu-2=1,2,3')
    g = play(g, { type: 'target', to: 'cpu-2' })
    expect(types(g.last)).toEqual([
      'ActionTargeted',
      'FlipThreeStarted',
      'CardDealt',
      'CardDealt',
      'CardDealt',
      'FlipThreeEnded',
      'CardDealt',
    ])
    expect(lineKeys(g.s, 'cpu-2')).toEqual(['1', '2', '3'])
    expect(lineKeys(g.s, 'cpu-1')).toEqual(['9'])
    expect(pending(g)).toEqual({ kind: 'hitOrStay', seat: 'cpu-2' })
    g = stay(g)
    expect(status(g.s, 'cpu-2')).toBe('stayed')
    // The deal is over; the hit/stay loop starts left of the dealer. You hold nothing, so you must hit.
    expect(pending(g)).toEqual({ kind: 'hitOrStay', seat: 'you' })
    expect(flip7.legalActions(g.s, 'you')).toEqual([{ type: 'hit' }])
  })

  it('E9: the resolved Flip Three card goes to the discard pile', () => {
    let g = game('you=T;cpu-1=1,2,3;cpu-2=4')
    g = play(g, { type: 'target', to: 'cpu-1' })
    expect(keys(g.s.discard)).toEqual(['T'])
  })

  it('E15: the next turn goes to the seat after the one dealt the Flip Three', () => {
    let g = game('you=4,T;cpu-1=6;cpu-2=7,1,2,3')
    g = hit(g)
    expect(pending(g)).toMatchObject({ kind: 'target', seat: 'you' })
    g = play(g, { type: 'target', to: 'cpu-2' })
    expect(lineKeys(g.s, 'cpu-2')).toEqual(['7', '1', '2', '3'])
    expect(pending(g)).toEqual({ kind: 'hitOrStay', seat: 'cpu-1' })
  })

  it('E16: a bust on the first card stops the Flip Three', () => {
    let g = game('you=4,T;cpu-1=6,6,1,2;cpu-2=7')
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'FlipThreeStarted', 'CardDealt', 'Busted', 'FlipThreeEnded'])
    expect(g.last[4]).toMatchObject({ result: 'bust' })
    expect(lineKeys(g.s, 'cpu-1')).toEqual(['6', '6'])
  })

  it('E16: a Flip 7 on the second card ends the round at once', () => {
    let g = game('you=4,T;cpu-1=0;cpu-2=7')
    g = { ...g, s: rigNext(give(g.s, 'cpu-1', '1', '2', '3', '5'), 'cpu-1', '8', '9', '10') }
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'FlipThreeStarted', 'CardDealt', 'CardDealt', 'Flip7Achieved', 'RoundScored'])
    expect(g.s.stage).toBe('roundOver')
    expect(g.s.rounds['cpu-1']?.flip7).toBe(true)
  })

  it('E17: a Second Chance flipped during a Flip Three is kept and can save a repeat in the same Flip Three', () => {
    let h = game('you=4,T;cpu-1=5,S,5,7;cpu-2=1')
    h = play(hit(h), { type: 'target', to: 'cpu-1' })
    expect(types(h.last)).toEqual([
      'ActionTargeted',
      'FlipThreeStarted',
      'CardDealt',
      'SecondChanceGained',
      'CardDealt',
      'SecondChanceUsed',
      'CardDealt',
      'FlipThreeEnded',
    ])
    expect(lineKeys(h.s, 'cpu-1')).toEqual(['5', '7'])
    expect(status(h.s, 'cpu-1')).toBe('active')
  })

  it('E11: a Freeze flipped during a Flip Three waits, then its target hands it out', () => {
    let g = game('you=4,T;cpu-1=6,F,1,2;cpu-2=7')
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'FlipThreeStarted', 'CardDealt', 'CardSetAside', 'CardDealt', 'CardDealt', 'FlipThreeEnded'])
    expect(pending(g)).toMatchObject({ kind: 'assign', seat: 'cpu-1' })
    expect(flip7.view(g.s, 'you').limbo).toEqual([{ kind: 'action', action: 'freeze' }])
    const cardId = g.s.pending?.kind === 'assign' ? g.s.pending.card.id : ''
    g = play(g, { type: 'assign', cardId, to: 'cpu-2' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'Frozen'])
    expect(status(g.s, 'cpu-2')).toBe('frozen')
    expect(pending(g)).toEqual({ kind: 'hitOrStay', seat: 'cpu-1' })
  })

  it('E11: a bust during the Flip Three discards the set-aside cards', () => {
    let g = game('you=4,T;cpu-1=6,F,6;cpu-2=7')
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    expect(types(g.last)).toEqual([
      'ActionTargeted',
      'FlipThreeStarted',
      'CardDealt',
      'CardSetAside',
      'CardDealt',
      'Busted',
      'SetAsideDiscarded',
      'FlipThreeEnded',
    ])
    expect(keys(g.s.discard)).toEqual(['T', 'F'])
  })

  it('E12: set-aside cards are all assigned in flip order before any resolves; Freeze then Flip Three on one seat wastes the Flip Three', () => {
    let g = game('you=4,T;cpu-1=6,F,T,1;cpu-2=7')
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    const first = g.s.pending?.kind === 'assign' ? g.s.pending.card : null
    expect(keys(first ? [first] : [])).toEqual(['F'])
    expect(() => play(g, { type: 'assign', cardId: 'nope', to: 'cpu-2' })).toThrow('flip order')
    g = play(g, { type: 'assign', cardId: first?.id ?? '', to: 'cpu-2' })
    expect(types(g.last)).toEqual(['ActionTargeted'])
    expect(status(g.s, 'cpu-2')).toBe('active')
    const second = g.s.pending?.kind === 'assign' ? g.s.pending.card : null
    g = play(g, { type: 'assign', cardId: second?.id ?? '', to: 'cpu-2' })
    expect(types(g.last)).toEqual(['ActionTargeted', 'Frozen', 'ActionDiscarded'])
    expect(keys(g.s.discard)).toEqual(['T', 'T'])
  })

  it('E12: two Flip Threes on one seat resolve one after the other, nested set-asides first', () => {
    let g = game('you=4,T;cpu-1=6,T,T,0;cpu-2=7,1,2,3,5,8,9')
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    for (let i = 0; i < 2; i++) {
      const c = g.s.pending?.kind === 'assign' ? g.s.pending.card : null
      g = play(g, { type: 'assign', cardId: c?.id ?? '', to: 'cpu-2' })
    }
    expect(lineKeys(g.s, 'cpu-2')).toEqual(['7', '1', '2', '3', '5', '8', '9'])
    expect(g.s.rounds['cpu-2']?.flip7).toBe(true)
    expect(g.s.stage).toBe('roundOver')
  })

  it('E21: a Flip 7 with cards set aside discards them and ends the round', () => {
    let g = game('you=4,T;cpu-1=0;cpu-2=7')
    g = { ...g, s: rigNext(give(g.s, 'cpu-1', '1', '2', '3', '5', '6'), 'cpu-1', 'F', '8') }
    g = play(hit(g), { type: 'target', to: 'cpu-1' })
    expect(types(g.last)).toEqual([
      'ActionTargeted',
      'FlipThreeStarted',
      'CardDealt',
      'CardSetAside',
      'CardDealt',
      'Flip7Achieved',
      'SetAsideDiscarded',
      'RoundScored',
    ])
    expect(keys(g.s.discard)).toEqual(['T', 'F'])
  })
})

describe('Second Chance', () => {
  it('E4: a Second Chance cancels a repeat, both cards are discarded, and the turn ends', () => {
    let g = game(RIGS.second)
    g = hit(hit(hit(g)))
    expect(to(g)).toBe('you')
    g = hit(g)
    expect(types(g.last)).toEqual(['CardDealt', 'SecondChanceUsed'])
    expect(keys(g.s.discard)).toEqual(['S', '4'])
    expect(lineKeys(g.s, 'you')).toEqual(['4'])
    expect(status(g.s, 'you')).toBe('active')
    expect(to(g)).toBe('cpu-1')
  })

  it('a second Second Chance must go to an active seat without one; with several, the holder picks', () => {
    let g = game('you=S,S;cpu=12')
    g = cpusStay(g)
    g = hit(g)
    expect(pending(g)).toMatchObject({ kind: 'passSecondChance', seat: 'you' })
    expect(flip7.legalActions(g.s, 'you')).toEqual([
      { type: 'passSecondChance', to: 'cpu-1' },
      { type: 'passSecondChance', to: 'cpu-2' },
    ])
    g = play(g, { type: 'passSecondChance', to: 'cpu-2' })
    expect(types(g.last)).toEqual(['SecondChancePassed'])
    expect(g.s.rounds['cpu-2']?.line.secondChance).not.toBeNull()
  })

  it('E19: a second Second Chance is discarded when nobody else can take it', () => {
    let h = game('you=S,S;cpu=12', 1)
    h = hit(h)
    expect(types(h.last)).toEqual(['CardDealt', 'SecondChancePassed'])
    let k = game('you=S,7,S;cpu=12', 1)
    k = stay(hit(k))
    k = hit(k)
    expect(types(k.last)).toEqual(['CardDealt', 'SecondChanceDiscarded'])
  })
})

describe('turns, decisions, and legality', () => {
  it('E20: with no cards in front of you, you must hit', () => {
    let g = game('you=F;cpu=12')
    g = play(g, { type: 'target', to: 'cpu-1' })
    expect(flip7.legalActions(g.s, 'you')).toEqual([{ type: 'hit' }])
    expect(() => stay(g)).toThrow('stay needs a card')
  })

  it('rejects a seat that is not to act and actions that do not fit the decision', () => {
    const g = game(RIGS.bust)
    expect(flip7.legalActions(g.s, 'cpu-1')).toEqual([])
    expect(() => play(g, { type: 'hit' }, 'cpu-1')).toThrow('"cpu-1" is not to act')
    expect(() => play(g, { type: 'target', to: 'cpu-1' })).toThrow('target is not legal now')
    expect(() => play(g, { type: 'nextRound' })).toThrow(IllegalActionError)
  })

  it('loops the hit/stay turns around the table until nobody is active, then rotates the dealer', () => {
    let g = game('you=1;cpu=2,3')
    expect(g.s.dealer).toBe('cpu-2')
    g = stay(g)
    g = stay(g)
    expect(to(g)).toBe('cpu-2')
    g = hit(g)
    expect(to(g)).toBe('cpu-2')
    g = stay(g)
    expect(g.s.stage).toBe('roundOver')
    g = play(g, { type: 'nextRound' })
    expect(g.s.dealer).toBe('you')
    expect(g.s.round).toBe(2)
    expect(g.last[0]).toEqual({ type: 'RoundStarted', round: 2, dealer: 'you', tiebreak: false })
    expect((g.last[1] as { seat: string }).seat).toBe('cpu-1')
  })
})

describe('game end', () => {
  it('ends the game at 200 or more with a single leader', () => {
    let g = game(RIGS.win)
    g = cpusStay(hit(g))
    g = stay(g)
    expect(g.s.totals['you']).toBe(211)
    expect(g.last).toContainEqual({ type: 'GameWon', seat: 'you', total: 211 })
    expect(g.s.stage).toBe('gameOver')
    expect(flip7.phase(g.s)).toBe('over')
    expect(flip7.toAct(g.s)).toBeNull()
    expect(flip7.settle(g.s)).toEqual([
      { seat: 'you', delta: 0 },
      { seat: 'cpu-1', delta: 0 },
      { seat: 'cpu-2', delta: 0 },
    ])
  })

  it('E6: a tie for the lead at 200 or more makes everyone play another round', () => {
    let g = game('you=10;cpu-1=10;cpu-2=1;total:you=190;total:cpu-1=190')
    g = stay(stay(stay(g)))
    expect(g.s.totals).toEqual({ you: 200, 'cpu-1': 200, 'cpu-2': 1 })
    expect(g.last).toContainEqual({ type: 'TiebreakRound', tied: ['you', 'cpu-1'] })
    expect(g.s.stage).toBe('roundOver')
    expect(g.s.winner).toBeNull()
    g = play(g, { type: 'nextRound' })
    expect(g.last[0]).toMatchObject({ type: 'RoundStarted', tiebreak: true })
  })
})

describe('deck exhaustion', () => {
  function emptyDraw(s: Flip7State, discardKeys: string[]): Flip7State {
    return { ...s, draw: [], discard: discardKeys.map((k) => card(k)) }
  }

  it('reshuffles the discard pile when the draw pile runs out, leaving table cards in place', () => {
    let g = game('you=5;cpu=12')
    g = { ...g, s: emptyDraw(g.s, ['8']) }
    g = hit(g)
    expect(types(g.last)).toEqual(['DeckReshuffled', 'CardDealt'])
    expect(g.last[0]).toEqual({ type: 'DeckReshuffled', count: 1 })
    expect(lineKeys(g.s, 'you')).toEqual(['5', '8'])
  })

  it('ends the round with no Flip 7 if both piles are empty', () => {
    let g = game('you=5;cpu=12')
    g = { ...g, s: emptyDraw(g.s, []) }
    g = hit(g)
    expect(types(g.last)).toEqual(['RoundScored'])
    expect(g.s.totals['you']).toBe(5)
  })
})

describe('view', () => {
  it('hides the draw pile order and shows only its size, the public discards, and every line', () => {
    const g = game(RIGS.flip3)
    const v = flip7.view(g.s, 'you')
    expect(Object.keys(v)).not.toContain('draw')
    expect(JSON.stringify(v)).not.toContain(g.s.draw[0]?.id)
    expect(v.drawCount).toBe(g.s.draw.length)
    expect(v.pending).toMatchObject({ kind: 'target', seat: 'you' })
    expect(v.legalTargets).toEqual(['you', 'cpu-1', 'cpu-2'])
    expect(v.limbo).toEqual([{ kind: 'action', action: 'flipThree' }])
  })

  it('keeps state, view, and events plain JSON', () => {
    const g = game(RIGS.flip3)
    expect(JSON.parse(JSON.stringify(g.s))).toEqual(g.s)
    expect(JSON.parse(JSON.stringify(g.log))).toEqual(g.log)
  })

  it('never mutates the input state', () => {
    const g = game(RIGS.bust)
    const before = JSON.stringify(g.s)
    hit(g)
    expect(JSON.stringify(g.s)).toBe(before)
  })
})

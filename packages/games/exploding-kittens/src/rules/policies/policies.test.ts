import type { Rng, SeatId } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { policies } from '../index'
import type { EkAction, EkCard, EkView, PendingView, Title } from '../types'
import { pTop } from './count'

const { easy, medium, hard } = policies

let cardSeq = 0

function card(title: Title): EkCard {
  cardSeq += 1
  return { id: `card-${cardSeq}`, deck: 'exploding-kittens', face: { title } }
}

function many(title: Title, count: number): EkCard[] {
  return Array.from({ length: count }, () => card(title))
}

/** Ints are returned in order. Each call must be inside the requested range. */
function scripted(ints: number[]): Rng {
  let index = 0
  return {
    next: () => 0,
    int(maxExclusive) {
      const value = ints[index]
      index += 1
      if (value === undefined || value < 0 || value >= maxExclusive) {
        throw new Error(`scripted int ${String(value)} is outside 0..${maxExclusive}`)
      }
      return value
    },
    state: () => 'scripted',
  }
}

function explodingRng(): Rng {
  return {
    next: () => {
      throw new Error('policy read rng.next')
    },
    int: () => {
      throw new Error('policy read rng')
    },
    state: () => 'unused',
  }
}

function viewOf(patch: Partial<EkView> & Pick<EkView, 'me' | 'hand' | 'pending'>): EkView {
  const order = patch.order ?? ['you', 'cpu-1', 'cpu-2']
  const seats: EkView['seats'] = {}
  for (const id of order) seats[id] = { alive: true, count: id === patch.me ? patch.hand.length : 8 }
  return {
    me: patch.me,
    order,
    seats: patch.seats ?? seats,
    hand: patch.hand,
    drawCount: patch.drawCount ?? 20,
    discard: patch.discard ?? [],
    turn: patch.turn === undefined ? patch.me : patch.turn,
    owed: patch.owed ?? 0,
    pending: patch.pending,
    knownTop: patch.knownTop ?? [],
    plantedIndex: patch.plantedIndex === undefined ? null : patch.plantedIndex,
    winner: patch.winner ?? null,
    actions: patch.actions ?? [],
  }
}

function turn(me: SeatId, hand: EkCard[], owed = 0): { view: EkView; legal: EkAction[] } {
  const legal: EkAction[] = [{ type: 'draw' }]
  const pending: PendingView = { kind: 'turn', seat: me }
  return { view: viewOf({ me, hand, owed, pending }), legal }
}

describe('Easy', () => {
  it('draws a known top kitten when rng says draw', () => {
    const kitten = card('kitten')
    const { view, legal } = turn('cpu-1', [card('attack'), card('skip')])
    view.knownTop = [kitten]
    legal.push({ type: 'play', title: 'attack' }, { type: 'play', title: 'skip' })
    const draw = legal[0]
    expect(easy.choose(view, legal, scripted([0]))).toBe(draw)
  })

  it('nopes when rng.int(4) is 0 and otherwise passes, without reading the effect', () => {
    const pending: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'you',
      effect: { type: 'favor', target: 'cpu-1' },
      nopes: 0,
      top: 'you',
    }
    const view = viewOf({ me: 'cpu-1', hand: [card('nope')], pending, turn: 'you' })
    const legal: EkAction[] = [{ type: 'pass' }, { type: 'nope' }]
    expect(easy.choose(view, legal, scripted([0]))).toBe(legal[1])
    expect(easy.choose(view, legal, scripted([1]))).toBe(legal[0])
    const passOnly: EkAction[] = [{ type: 'pass' }]
    expect(easy.choose(view, passOnly, scripted([0]))).toBe(passOnly[0])
  })

  it('drops favor, five, three, and Attack while owed is not 0', () => {
    const { view, legal } = turn('cpu-1', [card('attack'), card('skip'), card('favor')], 2)
    legal.push(
      { type: 'play', title: 'attack' },
      { type: 'play', title: 'skip' },
      { type: 'favor', target: 'you' },
      { type: 'three', title: 'tacocat', target: 'you', name: 'defuse' },
      { type: 'five', titles: ['nope', 'attack', 'skip', 'shuffle', 'future'], takeId: 'x' },
    )
    const skip = legal[2]
    expect(easy.choose(view, legal, scripted([1, 1, 0]))).toBe(skip)
  })

  it('picks a defuse index uniformly from the menu', () => {
    const legal: EkAction[] = [
      { type: 'defuse', index: 0 },
      { type: 'defuse', index: 1 },
      { type: 'defuse', index: 4 },
    ]
    const view = viewOf({
      me: 'cpu-1',
      hand: [card('defuse')],
      drawCount: 4,
      owed: 0,
      pending: { kind: 'defuse', seat: 'cpu-1', kitten: card('kitten') },
    })
    expect(easy.choose(view, legal, scripted([2]))).toBe(legal[2])
  })
})

describe('Medium', () => {
  it('shuffles a known top kitten when owed is 2', () => {
    const { view, legal } = turn('cpu-1', [card('attack'), card('shuffle'), card('skip')], 2)
    view.knownTop = [card('kitten')]
    legal.push({ type: 'play', title: 'attack' }, { type: 'play', title: 'shuffle' }, { type: 'play', title: 'skip' })
    const shuffle = legal[2]
    expect(medium.choose(view, legal, explodingRng())).toBe(shuffle)
  })

  it('attacks a known top kitten only on a fresh turn', () => {
    const { view, legal } = turn('cpu-1', [card('attack'), card('shuffle')])
    view.knownTop = [card('kitten')]
    legal.push({ type: 'play', title: 'attack' }, { type: 'play', title: 'shuffle' })
    expect(medium.choose(view, legal, explodingRng())).toBe(legal[1])
  })

  it('peeks when the top is unknown and otherwise pairs at the largest other hand', () => {
    const future = { type: 'play', title: 'future' } as const
    const pairYou = { type: 'pair', title: 'tacocat', target: 'you' } as const
    const pairCpu = { type: 'pair', title: 'tacocat', target: 'cpu-2' } as const
    const favor = { type: 'favor', target: 'you' } as const
    const { view, legal } = turn('cpu-1', [card('future'), card('tacocat'), card('tacocat'), card('favor')])
    view.seats = {
      you: { alive: true, count: 5 },
      'cpu-1': { alive: true, count: 4 },
      'cpu-2': { alive: true, count: 5 },
    }
    legal.push(future, favor, pairYou, pairCpu)
    expect(medium.choose(view, legal, explodingRng())).toBe(future)

    const noPeek = legal.filter((action) => action !== future)
    expect(medium.choose({ ...view, knownTop: [card('skip')] }, noPeek, explodingRng())).toBe(pairCpu)
  })

  it('buries a defused kitten at the bottom and gives the lowest rank', () => {
    const defuse = card('defuse')
    const kitten = card('kitten')
    const legal: EkAction[] = [
      { type: 'defuse', index: 0 },
      { type: 'defuse', index: 3 },
    ]
    const view = viewOf({
      me: 'cpu-1',
      hand: [defuse],
      drawCount: 3,
      owed: 2,
      pending: { kind: 'defuse', seat: 'cpu-1', kitten },
    })
    expect(medium.choose(view, legal, explodingRng())).toBe(legal[1])

    const nope = card('nope')
    const earlier = card('tacocat')
    const later = card('tacocat')
    const giveLegal: EkAction[] = [
      { type: 'give', cardId: later.id },
      { type: 'give', cardId: nope.id },
      { type: 'give', cardId: earlier.id },
    ]
    const giveView = viewOf({
      me: 'cpu-1',
      hand: [nope, earlier, later],
      pending: { kind: 'give', seat: 'cpu-1', to: 'you' },
      turn: 'cpu-1',
    })
    expect(easy.choose(giveView, giveLegal, scripted([]))).toBe(giveLegal[2])
    expect(medium.choose(giveView, giveLegal, explodingRng())).toBe(giveLegal[2])
    expect(hard.choose(giveView, giveLegal, explodingRng())).toBe(giveLegal[2])
  })

  it('nopes a bad effect on an even count and a good effect on an odd count', () => {
    const attack: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'you',
      effect: { type: 'attack' },
      nopes: 0,
      top: 'you',
    }
    const view = viewOf({ me: 'cpu-1', hand: [card('nope')], pending: attack, turn: 'you' })
    const legal: EkAction[] = [{ type: 'pass' }, { type: 'nope' }]
    expect(medium.choose(view, legal, explodingRng())).toBe(legal[1])
    expect(medium.choose({ ...view, pending: { ...attack, nopes: 1 } }, legal, explodingRng())).toBe(legal[0])

    const ownSkip: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'cpu-1',
      effect: { type: 'skip' },
      nopes: 1,
      top: 'you',
    }
    expect(medium.choose({ ...view, pending: ownSkip, turn: 'cpu-1' }, legal, explodingRng())).toBe(legal[1])

    const shuffle: PendingView = { ...attack, effect: { type: 'shuffle' }, nopes: 0 }
    expect(medium.choose({ ...view, pending: shuffle }, legal, explodingRng())).toBe(legal[0])
  })
})

describe('Hard', () => {
  it('pTop equals a hand-counted unseen multiset', () => {
    const hand = [card('defuse'), card('tacocat'), card('nope')]
    const discard = [card('attack'), card('kitten')]
    const base = viewOf({
      me: 'cpu-1',
      hand,
      discard,
      drawCount: 20,
      pending: { kind: 'turn', seat: 'cpu-1' },
    })
    // 3 players. Removed: 2 kittens, 1 defuse.
    // Unseen kitten 4-2-1=1, and 47 other unseen cards. 1/48.
    expect(pTop(base)).toBe(1 / 48)
    expect(pTop({ ...base, plantedIndex: 4 })).toBe(0)
    expect(pTop({ ...base, plantedIndex: 0 })).toBe(1)
    expect(pTop({ ...base, knownTop: [card('kitten')] })).toBe(1)
    expect(pTop({ ...base, knownTop: [card('skip')] })).toBe(0)
    expect(pTop({ ...base, knownTop: [], drawCount: 0 })).toBe(0)

    const two = viewOf({
      me: 'you',
      order: ['you', 'cpu-1'],
      hand: [],
      drawCount: 10,
      pending: { kind: 'turn', seat: 'you' },
    })
    // 2 players. Removed: 3 kittens, 2 defuses. One kitten remains in a pool of 51.
    expect(pTop(two)).toBe(1 / 51)

    const four = viewOf({
      me: 'you',
      order: ['you', 'cpu-1', 'cpu-2', 'cpu-3'],
      hand: [],
      drawCount: 10,
      pending: { kind: 'turn', seat: 'you' },
    })
    // 4 players. Removed: 1 kitten, 0 defuses. Three kittens remain in a pool of 55.
    expect(pTop(four)).toBe(3 / 55)
  })

  it('nopes an Attack aimed at them when nopes is 0 and passes when nopes is 1', () => {
    const pending: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'you',
      effect: { type: 'attack' },
      nopes: 0,
      top: 'you',
    }
    const view = viewOf({
      me: 'cpu-1',
      hand: [card('nope')],
      pending,
      turn: 'you',
      seats: {
        you: { alive: true, count: 6 },
        'cpu-2': { alive: false, count: 0 },
        'cpu-1': { alive: true, count: 3 },
      },
    })
    const legal: EkAction[] = [{ type: 'pass' }, { type: 'nope' }]
    expect(hard.choose(view, legal, explodingRng())).toBe(legal[1])
    expect(hard.choose({ ...view, pending: { ...pending, nopes: 1 } }, legal, explodingRng())).toBe(legal[0])
  })

  it('nopes a Nope of its own Attack and a shuffle that would erase a safe top', () => {
    const legal: EkAction[] = [{ type: 'pass' }, { type: 'nope' }]
    const own: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'cpu-1',
      effect: { type: 'attack' },
      nopes: 1,
      top: 'you',
    }
    const view = viewOf({ me: 'cpu-1', hand: [card('nope')], pending: own, turn: 'cpu-1' })
    expect(hard.choose(view, legal, explodingRng())).toBe(legal[1])
    expect(hard.choose({ ...view, pending: { ...own, nopes: 2 } }, legal, explodingRng())).toBe(legal[0])

    const safe = card('skip')
    const shuffle: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'you',
      effect: { type: 'shuffle' },
      nopes: 0,
      top: 'you',
    }
    expect(hard.choose({ ...view, pending: shuffle, knownTop: [safe], turn: 'you' }, legal, explodingRng())).toBe(legal[1])

    const prize = card('defuse')
    const five: PendingView = {
      kind: 'nope',
      seat: 'cpu-1',
      actor: 'cpu-2',
      effect: { type: 'five', titles: ['nope', 'attack', 'skip', 'shuffle', 'future'], takeId: prize.id },
      nopes: 0,
      top: 'cpu-2',
    }
    expect(hard.choose({ ...view, pending: five, discard: [prize], turn: 'cpu-2' }, legal, explodingRng())).toBe(legal[1])

    const future: PendingView = { ...own, effect: { type: 'future' }, nopes: 1 }
    expect(hard.choose({ ...view, pending: future }, legal, explodingRng())).toBe(legal[0])
  })

  it('places a kitten on top when the defuse ends the turn, and at the bottom when it does not', () => {
    const legal: EkAction[] = [
      { type: 'defuse', index: 0 },
      { type: 'defuse', index: 6 },
    ]
    const kitten = card('kitten')
    const fresh = viewOf({
      me: 'cpu-1',
      hand: [card('defuse')],
      drawCount: 6,
      owed: 0,
      pending: { kind: 'defuse', seat: 'cpu-1', kitten },
    })
    expect(hard.choose(fresh, legal, explodingRng())).toBe(legal[0])
    expect(hard.choose({ ...fresh, owed: 1 }, legal, explodingRng())).toBe(legal[0])
    expect(hard.choose({ ...fresh, owed: 2 }, legal, explodingRng())).toBe(legal[1])
  })

  it('takes the listed five before anything else, and shuffles a scary unknown top', () => {
    const five: EkAction = { type: 'five', titles: ['kitten', 'nope', 'attack', 'skip', 'favor'], takeId: 'defuse-1' }
    const { view, legal } = turn('cpu-1', [card('attack'), card('shuffle')])
    view.knownTop = [card('kitten')]
    legal.push({ type: 'play', title: 'attack' }, { type: 'play', title: 'shuffle' }, five)
    expect(hard.choose(view, legal, explodingRng())).toBe(five)

    const scaryHand = [card('shuffle'), card('future'), card('skip'), card('attack')]
    const scary = viewOf({
      me: 'cpu-1',
      order: ['you', 'cpu-1'],
      hand: scaryHand,
      // 2 players: one kitten and four defuses stay unseen, so pTop is 1/5.
      discard: [
        ...many('nope', 5),
        ...many('attack', 3),
        ...many('skip', 3),
        ...many('favor', 4),
        ...many('shuffle', 3),
        ...many('future', 4),
        ...many('tacocat', 4),
        ...many('hairyPotato', 4),
        ...many('rainbowRalphing', 4),
        ...many('beard', 4),
        ...many('cattermelon', 4),
      ],
      drawCount: 5,
      pending: { kind: 'turn', seat: 'cpu-1' },
    })
    const scaryLegal: EkAction[] = [
      { type: 'draw' },
      { type: 'play', title: 'attack' },
      { type: 'play', title: 'skip' },
      { type: 'play', title: 'shuffle' },
      { type: 'play', title: 'future' },
    ]
    expect(hard.choose(scary, scaryLegal, explodingRng())).toBe(scaryLegal[3])
  })
})

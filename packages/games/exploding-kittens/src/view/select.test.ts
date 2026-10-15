import { describe, expect, it } from 'vitest'
import type { EkAction, Title } from '../rules'
import type { EkCard } from '../rules/types'
import { fiveAction, playChoice, toggleRaised } from './select'

const card = (id: string, title: Title): EkCard => ({ id, deck: 'exploding-kittens', face: { title } })

describe('toggleRaised', () => {
  it('raises a card, and a second tap lowers it without playing', () => {
    const raised = toggleRaised([], 's')
    expect(raised).toEqual(['s'])
    expect(toggleRaised(raised, 's')).toEqual([])
  })

  it('keeps the most recently raised card last', () => {
    const raised = toggleRaised(toggleRaised([], 'a'), 'b')
    expect(raised).toEqual(['a', 'b'])
    expect(toggleRaised(raised, 'a')).toEqual(['b'])
  })
})

describe('playChoice', () => {
  it('plays one skip from the menu', () => {
    const hand = [card('s', 'skip')]
    const play: EkAction = { type: 'play', title: 'skip' }
    expect(playChoice(hand, [play, { type: 'draw' }], ['s'], 'turn', [])).toEqual({
      action: play,
      reason: null,
      targets: [],
      names: [],
    })
  })

  it('does not play a lone cat', () => {
    const hand = [card('t', 'tacocat')]
    const choice = playChoice(hand, [{ type: 'draw' }], ['t'], 'turn', [])
    expect(choice.action).toBeNull()
    expect(choice.reason).toBe('Need a matching pair.')
  })

  it('plays a pair when the menu has one target', () => {
    const hand = [card('a', 'tacocat'), card('b', 'tacocat')]
    const pair: EkAction = { type: 'pair', title: 'tacocat', target: 'cpu-1' }
    expect(playChoice(hand, [pair], ['a', 'b'], 'turn', []).action).toBe(pair)
  })

  it('asks for a player when a pair has two targets', () => {
    const hand = [card('a', 'tacocat'), card('b', 'tacocat')]
    const a: EkAction = { type: 'pair', title: 'tacocat', target: 'cpu-1' }
    const b: EkAction = { type: 'pair', title: 'tacocat', target: 'cpu-2' }
    const open = playChoice(hand, [a, b], ['a', 'b'], 'turn', [])
    expect(open.action).toBeNull()
    expect(open.reason).toBe('Pick a player.')
    expect(open.targets).toEqual(['cpu-1', 'cpu-2'])
    expect(playChoice(hand, [a, b], ['a', 'b'], 'turn', [], { target: 'cpu-2' }).action).toBe(b)
  })

  it('rejects two different cards', () => {
    const hand = [card('a', 'skip'), card('b', 'attack')]
    const actions: EkAction[] = [
      { type: 'play', title: 'skip' },
      { type: 'play', title: 'attack' },
    ]
    const choice = playChoice(hand, actions, ['a', 'b'], 'turn', [])
    expect(choice.action).toBeNull()
    expect(choice.reason).toBe('Need a matching pair.')
  })

  it('names a card for a three once the only player is known', () => {
    const hand = [card('a', 'beard'), card('b', 'beard'), card('c', 'beard')]
    const named: EkAction = { type: 'three', title: 'beard', target: 'cpu-1', name: 'defuse' }
    const open = playChoice(hand, [named], ['a', 'b', 'c'], 'turn', [])
    expect(open.action).toBeNull()
    expect(open.reason).toBe('Name a card.')
    expect(open.names).toEqual(['defuse'])
    expect(playChoice(hand, [named], ['a', 'b', 'c'], 'turn', [], { name: 'defuse' }).action).toBe(named)
  })

  it('plays a five from the raised cards and the top discard', () => {
    const hand = [card('a', 'attack'), card('b', 'skip'), card('c', 'shuffle'), card('d', 'future'), card('e', 'favor')]
    const discard = [card('prize', 'defuse')]
    const sent = playChoice(hand, [{ type: 'draw' }], ['e', 'a', 'c', 'b', 'd'], 'turn', discard).action
    expect(sent).toEqual(fiveAction(hand, ['e', 'a', 'c', 'b', 'd'], 'prize'))
  })

  it('plays a raised Nope during a Nope window', () => {
    const hand = [card('n', 'nope'), card('s', 'skip')]
    const nope: EkAction = { type: 'nope' }
    expect(playChoice(hand, [{ type: 'pass' }, nope], ['n'], 'nope', []).action).toBe(nope)
    expect(playChoice(hand, [{ type: 'pass' }, nope], ['s'], 'nope', []).reason).toBe('Play a Nope.')
  })

  it('gives the one raised card', () => {
    const hand = [card('a', 'skip'), card('b', 'favor')]
    const give: EkAction = { type: 'give', cardId: 'b' }
    expect(playChoice(hand, [give, { type: 'give', cardId: 'a' }], ['b'], 'give', []).action).toBe(give)
    expect(playChoice(hand, [give], ['a', 'b'], 'give', []).reason).toBe('Give one card.')
  })
})

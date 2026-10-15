import { createRng, replay } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { ekDeck } from './deck'
import { rules } from './index'
import { cardIds, cardsOf, choose, ek, openSession, playGame, step } from './test-helpers'
import type { RigName, Title } from './types'

const GAMES: { seed: string; players: 2 | 3 | 4; rig?: RigName }[] = [
  { seed: 'ek-fuzz-0', players: 2 },
  { seed: 'ek-fuzz-1', players: 3 },
  { seed: 'ek-fuzz-2', players: 4 },
  { seed: 'ek-fuzz-3', players: 2, rig: 'nope' },
  { seed: 'ek-fuzz-4', players: 3, rig: 'kitten' },
  { seed: 'ek-fuzz-5', players: 4, rig: 'explode' },
  { seed: 'ek-fuzz-6', players: 2 },
  { seed: 'ek-fuzz-7', players: 3 },
  { seed: 'ek-fuzz-8', players: 4 },
  { seed: 'ek-fuzz-9', players: 2, rig: 'favor' },
  { seed: 'ek-fuzz-10', players: 3, rig: 'five' },
  { seed: 'ek-fuzz-11', players: 4 },
]

function titles(seed: string, players: 2 | 3 | 4, rig?: RigName): Title[] {
  return cardsOf(openSession(seed, players, rig).state)
    .map((card) => card.face.title)
    .sort()
}

describe('fuzzed full games', () => {
  it('conserves the deck, ends with one winner, and includes a nope chain and a defuse', () => {
    const deck = ekDeck.build().map((face) => face.title).sort()
    let defuses = 0
    let maxNopes = 0
    for (const game of GAMES) {
      expect(titles(game.seed, game.players, game.rig)).toEqual(deck)
      const played = playGame(game.seed, game.players, game.rig)
      const { session } = played
      expect(session.state.winner).toBeTruthy()
      expect(session.state.order.filter((seat) => session.state.seats[seat]?.alive)).toEqual([session.state.winner])
      expect(ek.phase(session.state)).toBe('over')
      expect(ek.toAct(session.state)).toBeNull()
      expect(new Set(cardIds(session.state)).size).toBe(56)
      expect(cardsOf(session.state).map((card) => card.face.title).sort()).toEqual(deck)
      defuses += played.defuses
      maxNopes = Math.max(maxNopes, played.maxNopes)
    }
    expect(defuses).toBeGreaterThan(0)
    expect(maxNopes).toBeGreaterThanOrEqual(2)
    expect(GAMES).toHaveLength(12)
  })
})

describe('seeded replay', () => {
  it('the same seed reproduces the same public event log', () => {
    for (const game of GAMES) {
      const first = playGame(game.seed, game.players, game.rig)
      const second = playGame(game.seed, game.players, game.rig)
      expect(second.session.events).toEqual(first.session.events)
      expect(second.session.state.draw.map((card) => card.id)).toEqual(first.session.state.draw.map((card) => card.id))
      const rebuilt = replay(rules, {
        seed: game.seed,
        config: first.session.config,
        seats: rules.definition.seatsFor(first.session.config),
        log: first.session.log,
      })
      expect(rebuilt.events.filter((event) => event.type !== 'turn')).toEqual(first.session.events)
      expect(rebuilt.match.state.winner).toBe(first.session.state.winner)
    }
  })

  it('a second run does not call a policy', () => {
    const game = GAMES[3]
    if (!game) throw new Error('missing fuzz game')
    const played = playGame(game.seed, game.players, game.rig)
    const spy = {
      choose() {
        throw new Error('replay ran a policy')
      },
    }
    const ruled = { ...rules, policies: { easy: spy, medium: spy, hard: spy } }
    const rebuilt = replay(ruled, { seed: game.seed, config: played.session.config, seats: rules.definition.seatsFor(played.session.config), log: played.session.log })
    expect(rebuilt.events.filter((event) => event.type !== 'turn')).toEqual(played.session.events)
  })
})

describe('E53 conservation across a full game', () => {
  it('E53 keeps the 56 ids partitioned at 2, 3, and 4 seats and removed stays constant', () => {
    for (const players of [2, 3, 4] as const) {
      const session = openSession(`e53-${players}`, players)
      const origin = cardIds(session.state)
      const removed = session.state.removed.map((card) => card.id).sort()
      expect(new Set(origin).size).toBe(56)
      const actor = createRng(`e53-${players}:actor`)
      let guard = 0
      while (session.state.pending) {
        if (guard++ > 4000) throw new Error(`e53-${players} did not end`)
        const choice = choose(session.state, actor)
        step(session, choice.action, choice.seat)
        expect(cardIds(session.state)).toEqual(origin)
        expect(session.state.removed.map((card) => card.id).sort()).toEqual(removed)
      }
      expect(session.state.winner).toBeTruthy()
    }
  })
})


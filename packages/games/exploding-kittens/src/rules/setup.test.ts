import { buildShoe, ConfigError, createRng, startMatch } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import { COUNTS, FACE_LABEL, ekDeck } from './deck'
import { rules } from './index'
import { cardIds, ek, holds, HUMAN, keyHits, openSession } from './test-helpers'
import { RIGS, TITLE_ORDER, type Title } from './types'

const LABELS: Record<Title, string> = {
  kitten: 'EXPLODING KITTEN',
  defuse: 'DEFUSE',
  nope: 'NOPE',
  attack: 'ATTACK',
  skip: 'SKIP',
  favor: 'FAVOR',
  shuffle: 'SHUFFLE',
  future: 'SEE THE FUTURE',
  tacocat: 'TACOCAT',
  hairyPotato: 'HAIRY POTATO CAT',
  rainbowRalphing: 'RAINBOW-RALPHING CAT',
  beard: 'BEARD CAT',
  cattermelon: 'CATTERMELON',
}

describe('deck', () => {
  it('builds 56 faces in TITLE_ORDER', () => {
    const faces = ekDeck.build()
    expect(faces).toHaveLength(56)
    expect(TITLE_ORDER).toHaveLength(13)
    let cursor = 0
    for (const title of TITLE_ORDER) {
      const count = COUNTS[title]
      expect(faces.slice(cursor, cursor + count).every((face) => face.title === title)).toBe(true)
      cursor += count
    }
    expect(FACE_LABEL).toEqual(LABELS)
  })

  it('gives shoe ids that do not encode a title', () => {
    const shoe = buildShoe(ekDeck, 1, createRng('ids'))
    expect(new Set(shoe.map((card) => card.id)).size).toBe(56)
    for (const card of shoe) {
      expect(card.deck).toBe('exploding-kittens')
      expect(card.id).toMatch(/^exploding-kittens-\d+$/)
      expect(card.id.split('-').at(-1)).not.toBe(card.face.title)
    }
  })
})

describe('config and seats', () => {
  it('parses opponents, difficulty, and a known rig', () => {
    expect(ek.defaultConfig).toEqual({ opponents: 2, difficulty: 'medium' })
    expect(ek.parseConfig({})).toEqual({ opponents: 2, difficulty: 'medium' })
    expect(ek.parseConfig({ opponents: 1, difficulty: 'hard', rig: 'kitten' })).toEqual({
      opponents: 1,
      difficulty: 'hard',
      rig: 'kitten',
    })
    expect(RIGS).toEqual(['kitten', 'explode', 'nope', 'favor', 'five'])
    expect(rules.meta).toMatchObject({
      title: 'Exploding Kittens',
      description: 'Draw cards. Do not explode. Last one alive wins.',
      economy: 'score',
    })
    expect(rules.meta.minBet).toBeUndefined()
    expect(rules.definition.seats).toEqual({ min: 2, max: 4 })
    expect(rules.definition.id).toBe('exploding-kittens')
    expect(rules.definition.version).toBe(1)
  })

  it('rejects an unknown rig', () => {
    expect(() => ek.parseConfig({ rig: 'imploding' })).toThrow(ConfigError)
    expect(() => ek.parseConfig({ rig: '' })).toThrow(ConfigError)
    expect(() => ek.parseConfig({ rig: 1 })).toThrow(ConfigError)
  })

  it('seats the human first, then CPUs at one difficulty', () => {
    const seats = ek.seatsFor({ opponents: 3, difficulty: 'easy' })
    expect(seats.map((seat) => seat.id)).toEqual(['you', 'cpu-1', 'cpu-2', 'cpu-3'])
    expect(seats[0]).toEqual({ id: 'you', kind: 'human', name: 'You' })
    expect(seats[1]).toEqual({ id: 'cpu-1', kind: 'cpu', name: 'CPU 1', difficulty: 'easy' })
  })

  it('setup throws unless there is exactly one human', () => {
    const config = ek.parseConfig({})
    const seats = ek.seatsFor(config)
    const rng = createRng('humans')
    expect(() => ek.setup(config, seats.map((seat) => ({ ...seat, kind: 'cpu' as const })), rng)).toThrow(Error)
    expect(() =>
      ek.setup(
        config,
        seats.map((seat) => ({ ...seat, kind: 'human' as const })),
        createRng('humans-2'),
      ),
    ).toThrow(Error)
  })
})

describe('E65 setup counts', () => {
  it('E65 matches draw size, hand size, one defuse, and removed counts at 2, 3, and 4 seats', () => {
    const table = {
      2: { draw: 35, kittens: 1, removedKittens: 3, removedDefuses: 2 },
      3: { draw: 29, kittens: 2, removedKittens: 2, removedDefuses: 1 },
      4: { draw: 23, kittens: 3, removedKittens: 1, removedDefuses: 0 },
    } as const
    for (const players of [2, 3, 4] as const) {
      const { state } = openSession(`e65-${players}`, players)
      const expectRow = table[players]
      expect(state.draw).toHaveLength(expectRow.draw)
      expect(state.discard).toEqual([])
      expect(state.draw.filter((card) => card.face.title === 'kitten')).toHaveLength(expectRow.kittens)
      for (const seat of state.order) {
        expect(state.seats[seat]?.hand).toHaveLength(8)
        expect(state.seats[seat]?.hand.filter((card) => card.face.title === 'defuse')).toHaveLength(1)
        expect(state.seats[seat]?.hand.some((card) => card.face.title === 'kitten')).toBe(false)
        expect(state.seats[seat]?.alive).toBe(true)
      }
      expect(state.removed.filter((card) => card.face.title === 'kitten')).toHaveLength(expectRow.removedKittens)
      expect(state.removed.filter((card) => card.face.title === 'defuse')).toHaveLength(expectRow.removedDefuses)
      expect(new Set(cardIds(state)).size).toBe(56)
      expect(state.turn).toBe(HUMAN)
      expect(state.owed).toBe(0)
      expect(state.pending).toEqual({ kind: 'turn', seat: HUMAN })
      expect(state.winner).toBeNull()
      for (const seat of state.order) expect(state.known[seat]).toEqual({ top: [], planted: null })
    }
  })
})

describe('E66 opening', () => {
  it('E66 the human is to act after setup and startMatch emits nothing', () => {
    const config = ek.parseConfig({ opponents: 2, difficulty: 'medium' })
    const started = startMatch(rules, { config: config, seats: rules.definition.seatsFor(config), seed: 'e66' })
    expect(started.events).toEqual([])
    expect(ek.toAct(started.match.state)).toBe(HUMAN)
    expect(started.match.state.seats[HUMAN]?.hand).toHaveLength(8)
    expect(ek.phase(started.match.state)).toBe('playing')
    expect(ek.view(started.match.state, HUMAN).hand).toHaveLength(8)
  })
})

describe('rigs', () => {
  it('kitten, explode, nope, favor, and five only swap cards that already exist', () => {
    const plain = openSession('rigs', 2)
    const yours = plain.state.seats[HUMAN]?.hand.find((card) => card.face.title === 'defuse')
    const cpuDefuse = plain.state.seats['cpu-1']?.hand.find((card) => card.face.title === 'defuse')
    if (!yours || !cpuDefuse) throw new Error('setup defuse missing')

    const kitten = openSession('rigs', 2, 'kitten')
    expect(kitten.state.draw[0]?.face.title).toBe('kitten')
    expect(holds(kitten.state, HUMAN, 'defuse')).toBe(true)
    expect(cardIds(kitten.state)).toEqual(cardIds(plain.state))

    const explode = openSession('rigs', 2, 'explode')
    expect(explode.state.draw[0]?.face.title).toBe('kitten')
    expect(holds(explode.state, HUMAN, 'defuse')).toBe(false)
    expect(explode.state.seats['cpu-1']?.hand.some((card) => card.id === yours.id)).toBe(true)
    expect(cardIds(explode.state)).toEqual(cardIds(plain.state))

    const nope = openSession('rigs', 2, 'nope')
    expect(holds(nope.state, HUMAN, 'nope')).toBe(true)
    expect(holds(nope.state, 'cpu-1', 'attack')).toBe(true)
    expect(holds(nope.state, 'cpu-1', 'nope')).toBe(true)
    expect(nope.state.draw[0]?.face.title).toBe('tacocat')
    expect(nope.state.seats[HUMAN]?.hand.some((card) => card.id === yours.id)).toBe(true)
    expect(cardIds(nope.state)).toEqual(cardIds(plain.state))

    const favor = openSession('rigs', 2, 'favor')
    expect(holds(favor.state, HUMAN, 'favor')).toBe(true)
    expect(favor.state.seats['cpu-1']?.hand.length).toBeGreaterThanOrEqual(2)
    expect(favor.state.seats[HUMAN]?.hand.some((card) => card.id === yours.id)).toBe(true)
    expect(cardIds(favor.state)).toEqual(cardIds(plain.state))

    const five = openSession('rigs', 2, 'five')
    expect(five.state.discard.some((card) => card.id === cpuDefuse.id)).toBe(true)
    expect(five.state.seats[HUMAN]?.hand.some((card) => card.id === cpuDefuse.id)).toBe(false)
    expect(new Set(five.state.seats[HUMAN]?.hand.map((card) => card.face.title)).size).toBeGreaterThanOrEqual(5)
    expect(cardIds(five.state)).toEqual(cardIds(plain.state))
  })
})

describe('server authority', () => {
  it('a client view has no opponent hand faces and no deck order', () => {
    const { state } = openSession('privacy', 3)
    const view = ek.view(state, HUMAN)
    const blob = JSON.stringify(view)
    for (const seat of ['cpu-1', 'cpu-2']) {
      expect(view.seats[seat]).toEqual({ alive: true, count: 8 })
      for (const card of state.seats[seat]?.hand ?? []) expect(blob).not.toContain(`"${card.id}"`)
    }
    expect(keyHits(view, 'draw')).toEqual([])
    expect(keyHits(view, 'removed')).toEqual([])
    expect(keyHits(view, 'index')).toEqual([])
    expect(view.hand).toHaveLength(8)
    expect(view.knownTop).toEqual([])
    expect(view.plantedIndex).toBeNull()
    expect(view.me).toBe(HUMAN)
  })
})

describe('package entry', () => {
  it('exports rules and does not export the nope module', async () => {
    const barrel = await import('./index')
    const root = await import('../index')
    expect(barrel.rules.definition.id).toBe('exploding-kittens')
    expect(root.rules).toBe(barrel.rules)
    expect('nopeQueue' in barrel).toBe(false)
    expect('openNope' in barrel).toBe(false)
    expect(Object.keys(barrel.policies).sort()).toEqual(['easy', 'hard', 'medium'])
  })

  it('Easy, Medium, and Hard are policies on rules', () => {
    expect(rules.policies?.easy.choose).toEqual(expect.any(Function))
    expect(rules.policies?.medium.choose).toEqual(expect.any(Function))
    expect(rules.policies?.hard.choose).toEqual(expect.any(Function))
  })
})

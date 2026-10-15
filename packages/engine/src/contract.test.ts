import { describe, expect, it } from 'vitest'
import { IllegalActionError, NotYourTurnError, type GameDefinition, type GameRules } from './index'

type CoinConfig = { flips: 1 | 3 }
type CoinState = { left: number; heads: number }
type CoinAction = { type: 'flip' }

const coin: GameDefinition<CoinConfig, CoinState, CoinAction, CoinState, 'coin'> = {
  id: 'coin',
  name: 'Coin',
  version: 1,
  deck: { id: 'coin', build: () => ['coin'] },
  seats: { min: 1, max: 1 },
  house: [],
  defaultConfig: { flips: 1 },
  parseConfig: (input) => {
    const flips = (input as { flips?: unknown } | null)?.flips ?? 1
    if (flips !== 1 && flips !== 3) throw new Error('flips must be 1 or 3')
    return { flips }
  },
  setup: (config) => ({ left: config.flips, heads: 0 }),
  toAct: (s) => (s.left > 0 ? 'p1' : null),
  legalActions: (s, seat) => (s.left > 0 && seat === 'p1' ? [{ type: 'flip' }] : []),
  apply: (s, _seat, _action, rng) => {
    if (s.left === 0) throw new IllegalActionError('no flips left')
    const heads = rng.int(2)
    return { state: { left: s.left - 1, heads: s.heads + heads }, events: [{ type: 'flip', seat: 'p1', heads }] }
  },
  view: (s) => s,
  phase: (s) => (s.left > 0 ? 'playing' : 'settling'),
  settle: (s) => [{ seat: 'p1', delta: s.heads }],
}

const coinRules: GameRules<CoinConfig, CoinState, CoinAction, CoinState, 'coin'> = {
  definition: coin,
  meta: { title: 'Coin', description: 'Flip a coin.', economy: 'score' },
}

describe('contract', () => {
  it('lets a concretely typed game sit in an untyped registry', () => {
    const registry: GameRules[] = [coinRules]
    const found = registry.find((r) => r.definition.id === 'coin')
    expect(found?.meta.economy).toBe('score')
    expect(found?.definition.parseConfig({ flips: 3 })).toEqual({ flips: 3 })
    expect(() => found?.definition.parseConfig({ flips: 2 })).toThrow('flips must be 1 or 3')
  })

  it('names its errors so the server can map them to status codes', () => {
    const illegal = new IllegalActionError('no flips left')
    const turn = new NotYourTurnError('p2 is not to act')
    expect([illegal.name, illegal.message, illegal instanceof Error]).toEqual(['IllegalActionError', 'no flips left', true])
    expect([turn.name, turn instanceof NotYourTurnError, turn instanceof IllegalActionError]).toEqual([
      'NotYourTurnError',
      true,
      false,
    ])
  })
})

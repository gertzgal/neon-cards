import { describe, expect, it } from 'vitest'
import { createRng, type Policy } from '@neon-cards/engine'
import type { Flip7Action, Flip7View } from '../types'
import { easy, easyThreshold } from './easy'
import { hard } from './hard'
import { medium } from './medium'
import { legalFor, makeView, type ViewSpec } from './view-fixtures'

const choose = (policy: Policy<Flip7View, Flip7Action>, spec: ViewSpec, seed = 'p'): Flip7Action => {
  const view = makeView(spec)
  const legal = legalFor(view)
  const action = policy.choose(view, legal, createRng(seed))
  expect(legal).toContainEqual(action)
  return action
}

const mine = (cards: string[], total = 0): ViewSpec => ({ seats: { you: { cards: ['2'] }, 'cpu-1': { cards, total } } })
const HIT = { type: 'hit' }
const STAY = { type: 'stay' }
const target = (to: string) => ({ type: 'target', to })

describe('every policy', () => {
  it('hits with an empty line, and returns the only target when it is itself', () => {
    for (const policy of [easy, medium, hard]) {
      expect(choose(policy, mine([]))).toEqual(HIT)
      const alone: ViewSpec = {
        seats: { you: { status: 'stayed', cards: ['4'] }, 'cpu-1': { cards: ['3'] } },
        pending: { kind: 'target', card: 'F' },
      }
      expect(choose(policy, alone)).toEqual(target('cpu-1'))
      expect(choose(policy, { ...alone, pending: { kind: 'target', card: 'T' } })).toEqual(target('cpu-1'))
    }
  })
})

describe('easy', () => {
  it('fixes a threshold of 15..25 per seat from the view alone, the same every round of a game', () => {
    const view = makeView(mine(['3']))
    const t = easyThreshold(view)
    expect(t).toBeGreaterThanOrEqual(15)
    expect(t).toBeLessThanOrEqual(25)
    expect(easyThreshold({ ...view, round: 2, dealer: 'you' })).toBe(t)
    const all = new Set(['cpu-1', 'cpu-2', 'cpu-3'].flatMap((me) => ['you', 'cpu-1', 'cpu-2', 'cpu-3'].map((dealer) =>
      easyThreshold({ ...view, me, dealer, order: ['you', 'cpu-1', 'cpu-2', 'cpu-3'] }))))
    expect(all.size).toBeGreaterThan(3)
  })

  it('hits under its threshold and stays over it, except for a 10% whim', () => {
    let hitsLow = 0
    let staysHigh = 0
    for (let i = 0; i < 200; i++) {
      if (choose(easy, mine(['1', '2']), `low${i}`).type === 'hit') hitsLow++
      if (choose(easy, mine(['12', '11', '10']), `high${i}`).type === 'stay') staysHigh++
    }
    expect(hitsLow).toBeGreaterThanOrEqual(180)
    expect(hitsLow).toBeLessThan(200)
    expect(staysHigh).toBeGreaterThanOrEqual(180)
    expect(staysHigh).toBeLessThan(200)
  })

  it('aims Freeze and Flip Three at a random opponent, never itself while one is active', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      for (const card of ['F', 'T']) {
        const a = choose(easy, { seats: { you: {}, 'cpu-1': { cards: ['3'] }, 'cpu-2': {} }, pending: { kind: 'target', card } }, `t${i}`)
        seen.add((a as { to: string }).to)
      }
    }
    expect([...seen].sort()).toEqual(['cpu-2', 'you'])
  })
})

describe('medium', () => {
  it('hits under 25% visible bust odds and stays over', () => {
    expect(choose(medium, mine(['12', '11']))).toEqual(HIT) // 21/92
    expect(choose(medium, mine(['12', '11', '10']))).toEqual(STAY) // 30/91
  })

  it('chases Flip 7 at six unique numbers up to 40%', () => {
    expect(choose(medium, mine(['4', '5', '6', '7', '8']))).toEqual(STAY) // 25/89
    expect(choose(medium, mine(['3', '4', '5', '6', '7', '8']))).toEqual(HIT) // 27/88
  })

  it('protects a round that reaches 200 by dropping to 10%', () => {
    expect(choose(medium, mine(['6', '7'], 0))).toEqual(HIT) // 11/92
    expect(choose(medium, mine(['6', '7'], 190))).toEqual(STAY)
  })

  it('hits on with a Second Chance until the round is worth 35', () => {
    expect(choose(medium, mine(['12', '11', '10', 'S']))).toEqual(HIT)
    expect(choose(medium, mine(['12', '11', '10', '+2', 'S']))).toEqual(STAY)
  })

  it('freezes the opponent with the highest total', () => {
    const spec: ViewSpec = {
      seats: { you: { total: 150, cards: ['9'] }, 'cpu-1': { cards: ['3'] }, 'cpu-2': { total: 100, cards: ['10', '11'] } },
      pending: { kind: 'target', card: 'F' },
    }
    expect(choose(medium, spec)).toEqual(target('you'))
  })

  it('gives Flip Three to the opponent with the most numbers, but never one at five or more', () => {
    const spec = (a: string[], b: string[]): ViewSpec => ({
      seats: { you: { cards: a }, 'cpu-1': { cards: ['3'] }, 'cpu-2': { cards: b } },
      pending: { kind: 'target', card: 'T' },
    })
    expect(choose(medium, spec(['1', '2'], ['4', '5', '6']))).toEqual(target('cpu-2'))
    expect(choose(medium, spec(['1', '2', '3', '4', '5'], ['4', '5', '6']))).toEqual(target('cpu-2'))
    expect(choose(medium, spec(['1', '2', '3', '4', '5'], ['4', '5', '6', '7', '8']))).toEqual(target('cpu-1'))
  })

  it('passes a Second Chance to the lowest total', () => {
    const spec: ViewSpec = {
      seats: { you: { total: 120, cards: ['9'] }, 'cpu-1': { cards: ['3', 'S'] }, 'cpu-2': { total: 40, cards: ['10'] } },
      pending: { kind: 'passSecondChance', card: 'S' },
    }
    expect(choose(medium, spec)).toEqual({ type: 'passSecondChance', to: 'cpu-2' })
  })
})

describe('hard', () => {
  it('hits a small line and stays on a big one', () => {
    expect(choose(hard, mine(['1']))).toEqual(HIT)
    expect(choose(hard, mine(['12', '11', '10', '9']))).toEqual(STAY)
  })

  it('stays when staying locks a win', () => {
    const spec = (total: number): ViewSpec => ({
      seats: { you: { total: 100, cards: ['3'] }, 'cpu-1': { total, cards: ['12'] }, 'cpu-2': { status: 'stayed', total: 150, cards: ['8'] } },
    })
    expect(choose(hard, spec(0))).toEqual(HIT)
    expect(choose(hard, spec(190))).toEqual(STAY)
  })

  it('hits when a locked opponent already wins if it stays', () => {
    const spec = (oppTotal: number): ViewSpec => ({
      seats: { you: { status: 'stayed', total: oppTotal, cards: ['10', '12'] }, 'cpu-1': { total: 150, cards: ['12', '11', '10', '9', '8'] } },
    })
    expect(choose(hard, spec(100))).toEqual(STAY)
    expect(choose(hard, spec(180))).toEqual(HIT)
  })

  it('freezes a high total on a low line, but never a seat that would bank a win', () => {
    const spec = (youTotal: number, youCards: string[]): ViewSpec => ({
      seats: { you: { total: youTotal, cards: youCards }, 'cpu-1': { cards: ['3'] }, 'cpu-2': { total: 50, cards: ['10', '11'] } },
      pending: { kind: 'target', card: 'F' },
    })
    expect(choose(hard, spec(150, ['2']))).toEqual(target('you'))
    expect(choose(hard, spec(190, ['12']))).toEqual(target('cpu-2'))
  })

  it('gives Flip Three to the big risky line, not to a line one card from Flip 7', () => {
    const spec: ViewSpec = {
      seats: { you: { cards: ['0', '1', '2', '3', '4', '5'] }, 'cpu-1': { cards: ['2'] }, 'cpu-2': { cards: ['12', '11', '10', '9', '8'] } },
      pending: { kind: 'target', card: 'T' },
    }
    expect(choose(hard, spec)).toEqual(target('cpu-2'))
    expect(choose(hard, { ...spec, pending: { kind: 'assign', card: 'T' } })).toMatchObject({ type: 'assign', to: 'cpu-2' })
  })

  it('takes its own Flip Three when every opponent would gain from it', () => {
    const spec: ViewSpec = {
      seats: { you: { cards: ['0', '1', '2', '3', '4', '5'] }, 'cpu-1': { cards: ['1'] }, 'cpu-2': { cards: ['0', '1', '2', '3', '4', '6'] } },
      pending: { kind: 'target', card: 'T' },
    }
    expect(choose(hard, spec)).toEqual(target('cpu-1'))
  })

  it('passes a Second Chance to the seat it helps least', () => {
    const spec: ViewSpec = {
      seats: { you: { cards: ['12', '11', '10'] }, 'cpu-1': { cards: ['3', 'S'] }, 'cpu-2': { total: 150, cards: ['2'] } },
      pending: { kind: 'passSecondChance', card: 'S' },
    }
    expect(choose(hard, spec)).toEqual({ type: 'passSecondChance', to: 'cpu-2' })
  })

  it('decides in well under 5 ms: 200 decisions in under a second', () => {
    const view = makeView(mine(['3', '5', '+4']))
    const legal = legalFor(view)
    const rng = createRng('speed')
    const start = Date.now()
    for (let i = 0; i < 200; i++) hard.choose(view, legal, rng)
    expect(Date.now() - start).toBeLessThan(1000)
  })
})

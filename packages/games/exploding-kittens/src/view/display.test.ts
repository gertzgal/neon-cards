import type { GameEvent } from '@neon-cards/engine'
import { describe, expect, it } from 'vitest'
import type { EkView, Title } from '../rules'
import type { EkCard } from '../rules/types'
import { applyEvent, displayFromView, owedBadge } from './display'

const card = (id: string, title: Title): EkCard => ({ id, deck: 'exploding-kittens', face: { title } })

function view(): EkView {
  return {
    me: 'you',
    order: ['you', 'cpu-1'],
    seats: { you: { alive: true, count: 1 }, 'cpu-1': { alive: true, count: 2 } },
    hand: [card('s', 'skip')],
    drawCount: 10,
    discard: [],
    turn: 'you',
    owed: 0,
    pending: { kind: 'turn', seat: 'you' },
    knownTop: [card('top', 'tacocat')],
    plantedIndex: 4,
    winner: null,
    actions: [],
  }
}

describe('display', () => {
  it('paints owed 0 as one turn', () => {
    expect(owedBadge(0)).toBe(1)
    expect(owedBadge(2)).toBe(2)
  })

  it('moves a played card onto the discard and remembers it for a cancel', () => {
    const played: GameEvent = { type: 'Played', seat: 'you', cards: [card('s', 'skip')] }
    const next = applyEvent(displayFromView(view()), played, 'you')
    expect(next.hand).toEqual([])
    expect(next.discard.map((item) => item.id)).toEqual(['s'])
    const dimmed = applyEvent(next, { type: 'Cancelled', seat: 'you', nopes: 1 }, 'you')
    expect(dimmed.dimmed).toEqual(['s'])
    expect(dimmed.discard.map((item) => item.id)).toEqual(['s'])
  })

  it('deals your draw face down and shifts a peeked top', () => {
    const drawn = applyEvent(
      displayFromView(view()),
      { type: 'Drew', seat: 'you', card: { id: 'top', deck: 'exploding-kittens', face: null } },
      'you',
    )
    expect(drawn.hand.map((item) => item.face)).toEqual([{ title: 'skip' }, null])
    expect(drawn.knownTop).toEqual([])
    expect(drawn.plantedIndex).toBe(3)
    expect(drawn.drawCount).toBe(9)
  })

  it('counts a CPU draw as one more back', () => {
    const drawn = applyEvent(
      displayFromView(view()),
      { type: 'Drew', seat: 'cpu-1', card: { id: 'x', deck: 'exploding-kittens', face: null } },
      'you',
    )
    expect(drawn.seats['cpu-1']?.count).toBe(3)
    expect(drawn.drawnId['cpu-1']).toBe('x')
    expect(drawn.hand).toHaveLength(1)
  })

  it('does not learn a CPU defuse index', () => {
    const start = displayFromView(view())
    const defused = applyEvent(
      start,
      {
        type: 'Defused',
        seat: 'cpu-1',
        defuse: card('d', 'defuse'),
        kitten: card('k', 'kitten'),
      },
      'you',
    )
    expect(defused.plantedIndex).toBeNull()
    expect(defused.knownTop).toEqual([])
    expect(defused.pileBack?.face).toBeNull()
    expect(defused.drawCount).toBe(11)
    expect(JSON.stringify(defused)).not.toContain('"index"')
  })

  it('leaves your planted index for the server view to fill in', () => {
    const defused = applyEvent(
      displayFromView(view()),
      { type: 'Defused', seat: 'you', defuse: card('s', 'defuse'), kitten: card('k', 'kitten') },
      'you',
    )
    expect(defused.plantedIndex).toBe(4)
    expect(defused.pileBack?.id).toBe('k')
    expect(defused.hand).toEqual([])
  })

  it('empties a dead seat and lays the hand on the discard', () => {
    const boom = applyEvent(
      displayFromView(view()),
      { type: 'Exploded', seat: 'cpu-1', kitten: card('k', 'kitten'), hand: [card('a', 'attack'), card('b', 'beard')] },
      'you',
    )
    expect(boom.seats['cpu-1']).toEqual({ alive: false, count: 0 })
    expect(boom.discard.map((item) => item.id)).toEqual(['a', 'b', 'k'])
  })
})

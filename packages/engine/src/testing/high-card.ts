import { buildShoe, faceDown } from '../deck'
import { standard52, type Rank, type StandardFace } from '../decks/standard52'
import { IllegalActionError } from '../errors'
import { parseSettings } from '../settings'
import type { Card, CardView, Difficulty, GameDefinition, GameEvent, GameRules, Policy, Seat, SeatId, SettingSpec } from '../types'

// Test-only multi-seat game. Each seat holds one face-down card and on its turn keeps it or swaps it for
// the next card in the shoe. After the last seat, every card is revealed and the highest rank scores a
// point (ties all score). The human starts each next round from 'settling'. The third round ends the game.

export const HUMAN = 'you'
export const ROUNDS = 3

export interface HighCardConfig {
  opponents: 1 | 2 | 3
  difficulty: Difficulty
  /** Where the human sits in turn order, so tests can put CPU turns before the human's. */
  position: 'first' | 'last'
}

export type HighCardAction = { type: 'keep' } | { type: 'swap' } | { type: 'next' }

export interface HighCardState {
  order: SeatId[]
  shoe: Card<StandardFace>[]
  hands: Record<SeatId, Card<StandardFace>>
  /** Index into `order` of the seat to act while playing. */
  turn: number
  round: number
  phase: 'playing' | 'settling' | 'over'
  scores: Record<SeatId, number>
  winners: SeatId[]
}

export interface HighCardView {
  seat: SeatId
  round: number
  phase: HighCardState['phase']
  toAct: SeatId | null
  hands: Record<SeatId, CardView<StandardFace>>
  scores: Record<SeatId, number>
  winners: SeatId[]
}

const settings: SettingSpec[] = [
  {
    key: 'opponents',
    label: 'Opponents',
    options: [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ],
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  },
  {
    key: 'position',
    label: 'Seat',
    options: [
      { value: 'first', label: 'First' },
      { value: 'last', label: 'Last' },
    ],
  },
]

const defaultConfig: HighCardConfig = { opponents: 1, difficulty: 'easy', position: 'first' }

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

export const rankValue = (card: Card<StandardFace>) => RANK_VALUE[card.face.rank]

function deal(state: HighCardState): { state: HighCardState; events: GameEvent[] } {
  const shoe = [...state.shoe]
  const hands: Record<SeatId, Card<StandardFace>> = {}
  const events = state.order.map((seat) => {
    const card = shoe.shift()
    if (!card) throw new Error('shoe ran out')
    hands[seat] = card
    return { type: 'deal', seat, card: faceDown(card) }
  })
  return { state: { ...state, shoe, hands, turn: 0, phase: 'playing', winners: [] }, events }
}

const toAct = (s: HighCardState): SeatId | null =>
  s.phase === 'playing' ? (s.order[s.turn] ?? null) : s.phase === 'settling' ? HUMAN : null

const definition: GameDefinition<HighCardConfig, HighCardState, HighCardAction, HighCardView, StandardFace> = {
  id: 'high-card',
  name: 'High Card',
  version: 1,
  deck: standard52,
  seats: { min: 2, max: 4 },
  defaultConfig,
  parseConfig: (input) => parseSettings(settings, defaultConfig, input),
  seatsFor(config) {
    const cpus: Seat[] = Array.from({ length: config.opponents }, (_, i) => ({
      id: `cpu-${i + 1}`,
      kind: 'cpu',
      name: `CPU ${i + 1}`,
      difficulty: config.difficulty,
    }))
    const human: Seat = { id: HUMAN, kind: 'human', name: 'You' }
    return config.position === 'first' ? [human, ...cpus] : [...cpus, human]
  },
  setup(_config, seats, rng) {
    const order = seats.map((s) => s.id)
    const empty: HighCardState = {
      order,
      shoe: buildShoe(standard52, 1, rng),
      hands: {},
      turn: 0,
      round: 1,
      phase: 'playing',
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      winners: [],
    }
    return deal(empty).state
  },
  toAct,
  legalActions(s, seat) {
    if (toAct(s) !== seat) return []
    return s.phase === 'settling' ? [{ type: 'next' }] : [{ type: 'keep' }, { type: 'swap' }]
  },
  apply(s, seat, action) {
    if (toAct(s) !== seat) throw new IllegalActionError(`"${seat}" is not to act`)
    if (s.phase === 'settling') {
      if (action.type !== 'next') throw new IllegalActionError(`${action.type} is not legal between rounds`)
      const dealt = deal({ ...s, round: s.round + 1 })
      return { state: dealt.state, events: [{ type: 'round', round: s.round + 1 }, ...dealt.events] }
    }
    if (action.type !== 'keep' && action.type !== 'swap') throw new IllegalActionError(`${action.type} is not legal while playing`)
    let next: HighCardState = { ...s, turn: s.turn + 1 }
    const events: GameEvent[] = []
    if (action.type === 'swap') {
      const [card, ...shoe] = s.shoe
      if (!card) throw new Error('shoe ran out')
      next = { ...next, shoe, hands: { ...s.hands, [seat]: card } }
      events.push({ type: 'swap', seat, card: faceDown(card) })
    } else {
      events.push({ type: 'keep', seat })
    }
    if (next.turn < next.order.length) return { state: next, events }

    for (const id of next.order) events.push({ type: 'reveal', seat: id, card: next.hands[id] })
    const best = Math.max(...next.order.map((id) => rankValue(next.hands[id] as Card<StandardFace>)))
    const winners = next.order.filter((id) => rankValue(next.hands[id] as Card<StandardFace>) === best)
    const scores = { ...next.scores }
    for (const id of winners) scores[id] = (scores[id] ?? 0) + 1
    events.push({ type: 'roundEnd', winners })
    const phase = next.round === ROUNDS ? 'over' : 'settling'
    return { state: { ...next, scores, winners, phase }, events }
  },
  view(s, seat) {
    const revealed = s.phase !== 'playing'
    const hands = Object.fromEntries(
      Object.entries(s.hands).map(([id, card]) => [id, revealed || id === seat ? card : faceDown(card)]),
    )
    return { seat, round: s.round, phase: s.phase, toAct: toAct(s), hands, scores: s.scores, winners: s.winners }
  },
  phase: (s) => s.phase,
  settle: (s) => s.order.map((seat) => ({ seat, delta: s.winners.includes(seat) ? 1 : 0 })),
}

const own = (view: HighCardView) => view.hands[view.seat] as Card<StandardFace>
const swapBelow = (threshold: number): Policy<HighCardView, HighCardAction> => ({
  choose: (view, legal) => legal.find((a) => a.type === (rankValue(own(view)) < threshold ? 'swap' : 'keep')) ?? (legal[0] as HighCardAction),
})

export const highCard: GameRules<HighCardConfig, HighCardState, HighCardAction, HighCardView, StandardFace> = {
  definition,
  policies: {
    easy: { choose: (_view, legal, rng) => legal[rng.int(legal.length)] as HighCardAction },
    medium: swapBelow(8),
    hard: swapBelow(10),
  },
  meta: { title: 'High Card', description: 'Test-only multi-seat game.', economy: 'score', settings },
}

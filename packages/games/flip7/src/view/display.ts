import type { SeatId } from '@neon-cards/engine'
import type { F7Card, Flip7Event, Flip7View, RoundScore, SeatStatus, Stage } from '../rules'

export interface DisplaySeat {
  status: SeatStatus
  numbers: F7Card[]
  modifiers: F7Card[]
  secondChance: F7Card | null
  freeze: F7Card | null
  flip7: boolean
  total: number
}

/** What the table draws. Built from the view, then advanced one event at a time during playback. */
export interface Display {
  order: SeatId[]
  seats: Record<SeatId, DisplaySeat>
  stage: Stage
  round: number
  dealer: SeatId
  drawCount: number
  /** An action card waiting for (or flying to) its target, and the seat holding it. */
  held: { seat: SeatId; card: F7Card } | null
  /** Freeze and Flip Three cards set aside by a Flip Three, then handed out. */
  tray: F7Card[]
  flipThree: { seat: SeatId; remaining: number } | null
  lastScores: RoundScore[] | null
  winner: SeatId | null
  tiebreak: boolean
}

export function displayFromView(view: Flip7View): Display {
  const p = view.pending
  const held = p && (p.kind === 'target' || p.kind === 'passSecondChance') ? { seat: p.seat, card: p.card } : null
  return {
    order: view.order,
    seats: Object.fromEntries(
      view.order.map((id) => {
        const s = view.seats[id]
        if (!s) throw new Error(`view has no seat ${id}`)
        return [
          id,
          {
            status: s.status,
            numbers: s.line.numbers,
            modifiers: s.line.modifiers,
            secondChance: s.line.secondChance,
            freeze: s.line.freeze,
            flip7: s.flip7,
            total: s.total,
          },
        ]
      }),
    ),
    stage: view.stage,
    round: view.round,
    dealer: view.dealer,
    drawCount: view.drawCount,
    held,
    tray: view.setAside,
    flipThree: view.flipThree ? { seat: view.flipThree.seat, remaining: view.flipThree.remaining } : null,
    lastScores: view.lastScores,
    winner: view.winner,
    tiebreak: view.tiebreak,
  }
}

const emptySeat = (total: number): DisplaySeat => ({
  status: 'active',
  numbers: [],
  modifiers: [],
  secondChance: null,
  freeze: null,
  flip7: false,
  total,
})

const without = (cards: F7Card[], id: string) => cards.filter((c) => c.id !== id)

/** Pure: the display after one event. Unknown events (the engine's `turn`) change nothing. */
export function applyEvent(d: Display, event: Flip7Event | { type: string }): Display {
  const e = event as Flip7Event
  const seat = (id: SeatId, patch: Partial<DisplaySeat>): Display => {
    const s = d.seats[id]
    return s ? { ...d, seats: { ...d.seats, [id]: { ...s, ...patch } } } : d
  }
  switch (e.type) {
    case 'RoundStarted':
      return {
        ...d,
        stage: 'playing',
        round: e.round,
        dealer: e.dealer,
        tiebreak: e.tiebreak,
        lastScores: null,
        held: null,
        tray: [],
        flipThree: null,
        seats: Object.fromEntries(d.order.map((id) => [id, emptySeat(d.seats[id]?.total ?? 0)])),
      }
    case 'CardDealt': {
      const s = d.seats[e.seat]
      if (!s) return d
      const next: Display = {
        ...d,
        drawCount: Math.max(0, d.drawCount - 1),
        flipThree: e.source === 'flipThree' && d.flipThree ? { ...d.flipThree, remaining: d.flipThree.remaining - 1 } : d.flipThree,
      }
      const face = e.card.face
      if (face.kind === 'number') return { ...next, seats: { ...d.seats, [e.seat]: { ...s, numbers: [...s.numbers, e.card] } } }
      if (face.kind === 'modifier') return { ...next, seats: { ...d.seats, [e.seat]: { ...s, modifiers: [...s.modifiers, e.card] } } }
      return { ...next, held: { seat: e.seat, card: e.card } }
    }
    case 'Busted':
      return seat(e.seat, { status: 'busted' })
    case 'Stayed':
      return seat(e.seat, { status: 'stayed' })
    case 'SecondChanceGained':
      return { ...seat(e.seat, { secondChance: e.card }), held: null }
    case 'SecondChancePassed':
      return { ...seat(e.to, { secondChance: e.card }), held: null }
    case 'SecondChanceDiscarded':
      return { ...d, held: null }
    case 'SecondChanceUsed': {
      const s = d.seats[e.seat]
      if (!s) return d
      return seat(e.seat, { secondChance: null, numbers: without(s.numbers, e.card.id) })
    }
    case 'ActionTargeted':
      return { ...d, held: { seat: e.to, card: e.card }, tray: without(d.tray, e.card.id) }
    case 'Frozen':
      return { ...seat(e.seat, { status: 'frozen', freeze: e.card }), held: d.held?.card.id === e.card.id ? null : d.held }
    case 'FlipThreeStarted':
      return { ...d, held: null, flipThree: { seat: e.seat, remaining: 3 } }
    case 'CardSetAside':
      return { ...d, held: null, tray: [...d.tray, e.card] }
    case 'FlipThreeEnded':
      return { ...d, flipThree: null }
    case 'SetAsideDiscarded':
      return { ...d, tray: d.tray.filter((c) => !e.cards.some((x) => x.id === c.id)) }
    case 'ActionDiscarded':
      return { ...d, held: d.held?.card.id === e.card.id ? null : d.held }
    case 'Flip7Achieved':
      return seat(e.seat, { flip7: true })
    case 'DeckReshuffled':
      return { ...d, drawCount: e.count }
    case 'RoundScored':
      return {
        ...d,
        stage: 'roundOver',
        held: null,
        tray: [],
        flipThree: null,
        lastScores: e.scores,
        seats: Object.fromEntries(
          d.order.map((id) => {
            const s = d.seats[id] as DisplaySeat
            return [id, { ...s, total: e.scores.find((r) => r.seat === id)?.total ?? s.total }]
          }),
        ),
      }
    case 'TiebreakRound':
      return { ...d, tiebreak: true }
    case 'GameWon':
      return { ...d, stage: 'gameOver', winner: e.seat }
    default:
      return d
  }
}

/** The card a tap hit: on a seat, held in the middle, or set aside. The draw pile is none of these. */
export function cardOnTable(display: Display, id: string): F7Card | null {
  for (const seat of Object.values(display.seats)) {
    const cards = [...seat.numbers, ...seat.modifiers]
    if (seat.secondChance) cards.push(seat.secondChance)
    if (seat.freeze) cards.push(seat.freeze)
    const found = cards.find((card) => card.id === id)
    if (found) return found
  }
  if (display.held?.card.id === id) return display.held.card
  return display.tray.find((card) => card.id === id) ?? null
}

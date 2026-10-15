import type { CardView, GameEvent, SeatId } from '@neon-cards/engine'
import type { EkFace, EkView, Title } from '../rules'
import type { EkCard } from '../rules/types'

export interface SeatBits {
  alive: boolean
  count: number
}

/** What the table paints while a batch plays. The snap back to the server view replaces it. */
export interface Display {
  order: SeatId[]
  seats: Record<SeatId, SeatBits>
  hand: CardView<EkFace>[]
  drawCount: number
  discard: EkCard[]
  turn: SeatId | null
  owed: number
  knownTop: EkCard[]
  plantedIndex: number | null
  winner: SeatId | null
  dimmed: string[]
  /** Card ids from the play that a later Cancelled dims. */
  lastPlayed: string[]
  /** Face-down id just dealt to a CPU, so the fly can find that back. */
  drawnId: Record<SeatId, string>
  /** Kitten back sitting on the pile during a defuse slide. */
  pileBack: CardView<EkFace> | null
  /** Kitten just drawn, before it is buried or explodes. */
  revealed: EkCard | null
}

export const owedBadge = (owed: number) => (owed === 0 ? 1 : owed)

export function displayFromView(view: EkView): Display {
  const seats: Record<SeatId, SeatBits> = {}
  for (const id of view.order) {
    const seat = view.seats[id]
    seats[id] = { alive: seat?.alive ?? false, count: seat?.count ?? 0 }
  }
  return {
    order: [...view.order],
    seats,
    hand: view.hand.map(copyCard),
    drawCount: view.drawCount,
    discard: view.discard.map(copyCard),
    turn: view.turn,
    owed: view.owed,
    knownTop: view.knownTop.map(copyCard),
    plantedIndex: view.plantedIndex,
    winner: view.winner,
    dimmed: [],
    lastPlayed: [],
    drawnId: {},
    pileBack: null,
    revealed: null,
  }
}

export function applyEvent(display: Display, event: GameEvent, human: SeatId): Display {
  const d = clone(display)
  switch (event.type) {
    case 'Played': {
      const cards = cardList(event['cards'])
      take(d, event.seat, cards, human)
      d.discard.push(...cards)
      d.lastPlayed = cards.map((card) => card.id)
      break
    }
    case 'Noped': {
      const card = cardOf(event['card'])
      if (card) {
        take(d, event.seat, [card], human)
        d.discard.push(card)
      }
      break
    }
    case 'Cancelled':
      d.dimmed = [...d.dimmed, ...d.lastPlayed]
      break
    case 'Drew': {
      const card = cardOf(event['card'])
      if (!card || !event.seat) break
      noteDraw(d, card.id)
      d.drawCount = Math.max(0, d.drawCount - 1)
      if (event.seat === human) d.hand.push({ ...card, face: null })
      else gainBack(d, event.seat, card.id)
      break
    }
    case 'DrewKitten': {
      const card = cardOf(event['card'])
      if (!card) break
      noteDraw(d, card.id)
      d.drawCount = Math.max(0, d.drawCount - 1)
      d.revealed = card
      break
    }
    case 'Defused': {
      const defuse = cardOf(event['defuse'])
      const kitten = cardOf(event['kitten'])
      if (defuse) {
        take(d, event.seat, [defuse], human)
        d.discard.push(defuse)
      }
      d.drawCount += 1
      d.pileBack = kitten ? { id: kitten.id, deck: kitten.deck, face: null } : null
      d.revealed = null
      if (event.seat !== human) clearKnown(d)
      break
    }
    case 'Exploded': {
      const hand = cardList(event['hand'])
      const kitten = cardOf(event['kitten'])
      if (event.seat === human) d.hand = []
      else if (event.seat) {
        const seat = d.seats[event.seat]
        if (seat) seat.count = 0
      }
      if (event.seat) {
        const seat = d.seats[event.seat]
        if (seat) seat.alive = false
      }
      d.discard.push(...hand)
      if (kitten) d.discard.push(kitten)
      d.revealed = null
      if (event.seat === human) clearKnown(d)
      break
    }
    case 'Attacked': {
      const to = str(event, 'to')
      const owed = num(event, 'owed')
      if (to) d.turn = to
      if (owed !== null) d.owed = owed
      break
    }
    case 'Shuffled':
    case 'Reshuffled': {
      const count = num(event, 'count')
      if (count !== null) d.drawCount = count
      if (event.type === 'Reshuffled') d.discard = []
      clearKnown(d)
      break
    }
    case 'Took': {
      const card = cardOf(event['card'])
      if (!card || !event.seat) break
      d.discard = d.discard.filter((item) => item.id !== card.id)
      give(d, event.seat, card, human)
      break
    }
    case 'Asked': {
      if (event['hit'] !== true) break
      const card = cardOf(event['card'])
      const from = str(event, 'from')
      const to = str(event, 'to')
      if (!card || !from || !to) break
      take(d, from, [card], human)
      give(d, to, card, human)
      break
    }
    case 'Gave':
    case 'Stole': {
      const from = str(event, 'from')
      const to = str(event, 'to')
      if (from && from !== human) loseBack(d, from)
      if (to && to !== human) gainBack(d, to, null)
      break
    }
    case 'Peeked':
      clearKnown(d)
      break
    case 'Won':
      if (event.seat) d.winner = event.seat
      d.turn = null
      break
    default:
      break
  }
  return d
}

function copyCard<F>(card: { id: string; deck: string; face: F }): { id: string; deck: string; face: F } {
  return { id: card.id, deck: card.deck, face: card.face ? { ...card.face } : card.face }
}

function clone(display: Display): Display {
  const seats: Record<SeatId, SeatBits> = {}
  for (const [id, seat] of Object.entries(display.seats)) seats[id] = { ...seat }
  return {
    ...display,
    seats,
    hand: display.hand.map(copyCard),
    discard: display.discard.map(copyCard),
    knownTop: display.knownTop.map(copyCard),
    dimmed: [...display.dimmed],
    lastPlayed: [...display.lastPlayed],
    drawnId: { ...display.drawnId },
    pileBack: display.pileBack ? { ...display.pileBack } : null,
    revealed: display.revealed ? copyCard(display.revealed) : null,
  }
}

function clearKnown(display: Display) {
  display.knownTop = []
  display.plantedIndex = null
}

function noteDraw(display: Display, id: string) {
  if (display.knownTop[0]?.id === id) display.knownTop = display.knownTop.slice(1)
  if (display.plantedIndex === null) return
  if (display.plantedIndex <= 0) display.plantedIndex = null
  else display.plantedIndex -= 1
}

function take(display: Display, seat: SeatId | undefined, cards: readonly EkCard[], human: SeatId) {
  if (!seat) return
  if (seat === human) {
    const ids = new Set(cards.map((card) => card.id))
    display.hand = display.hand.filter((card) => !ids.has(card.id))
    return
  }
  loseBack(display, seat, cards.length)
}

function give(display: Display, seat: SeatId, card: EkCard, human: SeatId) {
  if (seat === human) display.hand.push(card)
  else gainBack(display, seat, card.id)
}

function loseBack(display: Display, seat: SeatId, n = 1) {
  const row = display.seats[seat]
  if (!row) return
  row.count = Math.max(0, row.count - n)
  display.drawnId = Object.fromEntries(Object.entries(display.drawnId).filter(([id]) => id !== seat))
}

function gainBack(display: Display, seat: SeatId, id: string | null) {
  const row = display.seats[seat]
  if (!row) return
  row.count += 1
  if (id) display.drawnId[seat] = id
}

function str(event: GameEvent, key: string): string | null {
  const value = event[key]
  return typeof value === 'string' ? value : null
}

function num(event: GameEvent, key: string): number | null {
  const value = event[key]
  return typeof value === 'number' ? value : null
}

function cardOf(value: unknown): EkCard | null {
  if (!value || typeof value !== 'object') return null
  const card = value as { id?: unknown; deck?: unknown; face?: unknown }
  if (typeof card.id !== 'string' || typeof card.deck !== 'string') return null
  if (card.face === null) return { id: card.id, deck: card.deck, face: null as unknown as EkFace }
  if (!card.face || typeof card.face !== 'object' || !('title' in card.face) || typeof card.face.title !== 'string') return null
  return { id: card.id, deck: card.deck, face: { title: card.face.title as Title } }
}

function cardList(value: unknown): EkCard[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const card = cardOf(item)
    return card ? [card] : []
  })
}

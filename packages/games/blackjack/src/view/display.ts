import { handValue, type BlackjackFace } from '../rules'
import type { BlackjackEvent, BlackjackView, HandStatus, Outcome, RoundResult, VisibleCard } from '../rules'

/** What the table shows. The event player steps it one server event at a time. */
export type Stage = 'betting' | 'dealing' | 'playing' | 'dealer' | 'settling'

export interface DisplayHand {
  cards: VisibleCard[]
  bet: number
  status: HandStatus
  doubled: boolean
  outcome: Outcome | null
  payout: number | null
}

export interface Display {
  stage: Stage
  stack: number
  dealer: VisibleCard[]
  hands: DisplayHand[]
  active: number
  result: RoundResult | null
}

const STAGE_OF_PHASE = { betting: 'betting', playing: 'playing', settling: 'settling' } as const

export function displayFromView(view: BlackjackView): Display {
  return {
    stage: STAGE_OF_PHASE[view.phase],
    stack: view.stack,
    dealer: view.dealer.cards,
    hands: view.hands.map(({ cards, bet, status, doubled, outcome, payout }) => ({ cards, bet, status, doubled, outcome, payout })),
    active: view.active,
    result: view.result,
  }
}

function emptyHand(bet: number, cards: VisibleCard[] = []): DisplayHand {
  return { cards, bet, status: 'active', doubled: false, outcome: null, payout: null }
}

function updateHand(d: Display, index: number, patch: (h: DisplayHand) => Partial<DisplayHand>): Display {
  return { ...d, hands: d.hands.map((h, i) => (i === index ? { ...h, ...patch(h) } : h)) }
}

// Hands play in order, so moving past a hand that is still active means it finished unbusted.
function finishHandsBefore(d: Display, index: number): Display {
  return { ...d, hands: d.hands.map((h, i) => (i < index && h.status === 'active' ? { ...h, status: 'stood' } : h)) }
}

export function applyEvent(d: Display, e: BlackjackEvent): Display {
  switch (e.type) {
    case 'bet':
      return { stage: 'dealing', stack: e.stack, dealer: [], hands: [emptyHand(e.amount)], active: -1, result: null }
    case 'deal':
      if (e.seat === 'dealer') return { ...d, dealer: [...d.dealer, e.card] }
      return updateHand(d, e.hand, (h) => ({ cards: [...h.cards, e.card] }))
    case 'reveal':
      return {
        ...finishHandsBefore(d, d.hands.length),
        stage: 'dealer',
        dealer: d.dealer.map((c, i) => (i === 1 ? e.card : c)),
      }
    case 'turn':
      return { ...finishHandsBefore(d, e.hand), stage: 'playing', active: e.hand }
    case 'stand':
      return updateHand(d, e.hand, () => ({ status: 'stood' }))
    case 'double':
      return { ...updateHand(d, e.hand, (h) => ({ bet: h.bet + e.amount, doubled: true })), stack: e.stack }
    case 'split': {
      const [a, b] = d.hands[0]?.cards ?? []
      if (!a || !b) return d
      return { ...d, stack: e.stack, active: 0, hands: [emptyHand(e.amount, [a]), emptyHand(e.amount, [b])] }
    }
    case 'bust':
      return updateHand(d, e.hand, () => ({ status: 'bust' }))
    case 'blackjack':
      return updateHand(d, e.hand, () => ({ status: 'blackjack' }))
    case 'handResult':
      return updateHand(d, e.hand, () => ({ outcome: e.outcome, payout: e.payout }))
    case 'roundEnd':
      return { ...d, stage: 'settling', stack: e.stack, active: -1, result: { wagered: e.wagered, payout: e.payout, net: e.net } }
    case 'refill':
      return { ...d, stack: e.stack }
    case 'shuffle':
    case 'peek':
    case 'dealerBlackjack':
    case 'dealerBust':
      return d
  }
}

const shown = (cards: VisibleCard[]) => cards.flatMap((c) => (c.face ? [c.face as BlackjackFace] : []))

/** Badge text: "7/17" while a soft total can still go either way, otherwise the total; empty with no cards. */
export function totalLabel(cards: VisibleCard[]): string {
  const faces = shown(cards)
  if (!faces.length) return ''
  const { total, soft } = handValue(faces)
  return soft && total < 21 && faces.length === cards.length ? `${total - 10}/${total}` : String(total)
}

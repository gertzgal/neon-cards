import { buildShoe, ConfigError, IllegalActionError, type GameDefinition, type Rng, type Seat, type SeatId, type Settlement } from '@neon-cards/engine'
import { handValue, isNatural, rankValue, standard52, type BlackjackCard, type BlackjackFace } from './cards'
import { rigFaces } from './rigs'
import {
  DEALER,
  type ActionType,
  type BlackjackAction,
  type BlackjackConfig,
  type BlackjackEvent,
  type BlackjackState,
  type BlackjackView,
  type Hand,
  type Outcome,
  type VisibleCard,
} from './types'

export const defaultConfig: BlackjackConfig = {
  decks: 6,
  minBet: 5,
  betStep: 5,
  bankroll: 1250,
  refillTo: 1250,
  reshuffleAt: 0.25,
}

const HOLE_ID = 'hole'

export const PLAYER = 'player'

/** Clients may only pick a dev rig; the server sets `bankroll` from the wallet. Everything else is house rules. */
function parseConfig(input: unknown): BlackjackConfig {
  if (input === undefined || input === null) return { ...defaultConfig }
  if (typeof input !== 'object' || Array.isArray(input)) throw new ConfigError('Config must be an object')
  const { rig, bankroll } = input as Record<string, unknown>
  const config: BlackjackConfig = { ...defaultConfig }
  if (rig !== undefined) {
    if (typeof rig !== 'string' || !rig) throw new ConfigError('rig must be a non-empty string')
    try {
      rigFaces(rig)
    } catch (err) {
      throw new ConfigError(err instanceof Error ? err.message : String(err))
    }
    config.rig = rig
  }
  if (bankroll !== undefined) {
    if (typeof bankroll !== 'number' || !Number.isInteger(bankroll) || bankroll < 0) {
      throw new ConfigError('bankroll must be a whole number of chips')
    }
    config.bankroll = bankroll
  }
  return config
}

const faces = (cards: readonly BlackjackCard[]) => cards.map((c) => c.face)

function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No item at index ${index}`)
  return item
}

function setup(config: BlackjackConfig, seats: Seat[], rng: Rng): BlackjackState {
  const player = seats.find((s) => s.kind !== 'house')
  if (!player) throw new Error('Blackjack needs one player seat')
  const shoe = buildShoe(standard52, config.decks, rng)
  return {
    config,
    seat: player.id,
    phase: 'betting',
    round: 0,
    stack: config.bankroll,
    lastBet: 0,
    shoe,
    shoeSize: shoe.length,
    dealer: [],
    holeRevealed: false,
    hands: [],
    active: -1,
    result: null,
  }
}

function canSplit(state: BlackjackState, hand: Hand): boolean {
  const [a, b] = hand.cards
  return (
    state.hands.length === 1 &&
    a !== undefined &&
    b !== undefined &&
    hand.cards.length === 2 &&
    rankValue(a.face.rank) === rankValue(b.face.rank) &&
    state.stack >= hand.bet
  )
}

function legalTypes(state: BlackjackState, seat: SeatId): ActionType[] {
  if (seat !== state.seat) return []
  if (state.phase === 'playing') {
    const hand = at(state.hands, state.active)
    const types: ActionType[] = ['hit', 'stand']
    if (hand.cards.length === 2 && state.stack >= hand.bet) types.push('double')
    if (canSplit(state, hand)) types.push('split')
    return types
  }
  return state.stack < state.config.minBet ? ['refill'] : ['bet']
}

function suggestedBet(state: BlackjackState): number {
  const { minBet, betStep } = state.config
  const affordable = Math.floor(state.stack / betStep) * betStep
  return Math.max(minBet, Math.min(state.lastBet || minBet, affordable))
}

function legalActions(state: BlackjackState, seat: SeatId): BlackjackAction[] {
  return legalTypes(state, seat).map((type) =>
    type === 'bet' ? { type, amount: suggestedBet(state) } : ({ type } as BlackjackAction),
  )
}

function betError(state: BlackjackState, amount: number): string | null {
  const { minBet, betStep } = state.config
  if (!Number.isInteger(amount)) return 'Bet must be a whole number'
  if (amount < minBet) return `Bet must be at least ${minBet}`
  if (amount % betStep !== 0) return `Bet must be a multiple of ${betStep}`
  if (amount > state.stack) return 'Bet exceeds stack'
  return null
}

/** Mutable working copy of one `apply` call: the cloned state plus the events it emits. */
class Table {
  readonly events: BlackjackEvent[] = []
  constructor(
    readonly s: BlackjackState,
    readonly rng: Rng,
  ) {}

  emit(e: BlackjackEvent) {
    this.events.push(e)
  }

  reshuffle() {
    this.s.shoe = buildShoe(standard52, this.s.config.decks, this.rng, `${standard52.id}.r${this.s.round}`)
    this.s.shoeSize = this.s.shoe.length
    this.emit({ type: 'shuffle', size: this.s.shoeSize })
  }

  stackRig(rig: string): void {
    const wanted = rigFaces(rig)
    const pull = (face: BlackjackFace) =>
      this.s.shoe.findIndex((c) => c.face.rank === face.rank && c.face.suit === face.suit)
    const pulled: BlackjackCard[] = []
    for (const face of wanted) {
      const i = pull(face)
      if (i < 0) {
        this.reshuffle()
        return this.stackRig(rig)
      }
      pulled.push(...this.s.shoe.splice(i, 1))
    }
    this.s.shoe.unshift(...pulled)
  }

  draw(): BlackjackCard {
    const card = this.s.shoe.shift()
    if (!card) throw new Error('Shoe is empty')
    return card
  }

  dealPlayer(hand: number) {
    const card = this.draw()
    at(this.s.hands, hand).cards.push(card)
    this.emit({ type: 'deal', seat: this.s.seat, hand, card })
  }

  dealDealer(faceDown = false) {
    const card = this.draw()
    this.s.dealer.push(card)
    const shown: VisibleCard = faceDown ? { id: HOLE_ID, deck: card.deck, face: null } : card
    this.emit({ type: 'deal', seat: DEALER, hand: 0, card: shown })
  }

  revealHole() {
    this.s.holeRevealed = true
    this.emit({
      type: 'reveal',
      seat: DEALER,
      card: at(this.s.dealer, 1),
      total: handValue(faces(this.s.dealer)).total,
    })
  }

  startRound(amount: number) {
    const s = this.s
    s.round++
    s.dealer = []
    s.holeRevealed = false
    s.result = null
    if (s.shoe.length < s.shoeSize * s.config.reshuffleAt) this.reshuffle()
    if (s.config.rig) this.stackRig(s.config.rig)

    s.stack -= amount
    s.lastBet = amount
    s.hands = [newHand(amount, false)]
    this.emit({ type: 'bet', seat: s.seat, amount, stack: s.stack })

    this.dealPlayer(0)
    this.dealDealer()
    this.dealPlayer(0)
    this.dealDealer(true)

    const up = at(s.dealer, 0).face.rank
    const dealerNatural = isNatural(faces(s.dealer))
    const playerNatural = isNatural(faces(at(s.hands, 0).cards))
    if (rankValue(up) >= 10 && !dealerNatural) this.emit({ type: 'peek', seat: DEALER })
    if (playerNatural) {
      at(s.hands, 0).status = 'blackjack'
      this.emit({ type: 'blackjack', seat: s.seat, hand: 0 })
    }
    if (dealerNatural || playerNatural) {
      this.revealHole()
      if (dealerNatural) this.emit({ type: 'dealerBlackjack', seat: DEALER })
      return this.resolve()
    }
    s.phase = 'playing'
    s.active = 0
    this.emit({ type: 'turn', seat: s.seat, hand: 0 })
  }

  /** Marks the active hand finished if it busted or reached 21; returns whether it finished. */
  settleHandAfterCard(index: number): boolean {
    const hand = at(this.s.hands, index)
    const { total } = handValue(faces(hand.cards))
    if (total > 21) {
      hand.status = 'bust'
      this.emit({ type: 'bust', seat: this.s.seat, hand: index, total })
      return true
    }
    if (total === 21) {
      hand.status = 'stood'
      return true
    }
    return false
  }

  hit() {
    this.dealPlayer(this.s.active)
    if (this.settleHandAfterCard(this.s.active)) this.advance()
  }

  stand() {
    at(this.s.hands, this.s.active).status = 'stood'
    this.emit({ type: 'stand', seat: this.s.seat, hand: this.s.active })
    this.advance()
  }

  double() {
    const s = this.s
    const hand = at(s.hands, s.active)
    s.stack -= hand.bet
    this.emit({ type: 'double', seat: s.seat, hand: s.active, amount: hand.bet, stack: s.stack })
    hand.bet *= 2
    hand.doubled = true
    this.dealPlayer(s.active)
    if (!this.settleHandAfterCard(s.active)) hand.status = 'stood'
    this.advance()
  }

  split() {
    const s = this.s
    const original = at(s.hands, 0)
    const [first, second] = original.cards as [BlackjackCard, BlackjackCard]
    s.stack -= original.bet
    this.emit({ type: 'split', seat: s.seat, amount: original.bet, stack: s.stack })
    s.hands = [newHand(original.bet, true, first), newHand(original.bet, true, second)]
    this.dealPlayer(0)
    this.dealPlayer(1)
    if (first.face.rank === 'A') {
      for (const hand of s.hands) hand.status = 'stood'
    } else {
      this.settleHandAfterCard(0)
      this.settleHandAfterCard(1)
    }
    s.active = -1
    this.advance()
  }

  advance() {
    const s = this.s
    const next = s.hands.findIndex((h) => h.status === 'active')
    if (next >= 0) {
      if (next !== s.active) {
        s.active = next
        this.emit({ type: 'turn', seat: s.seat, hand: next })
      }
      return
    }
    s.active = -1
    this.revealHole()
    if (s.hands.some((h) => h.status !== 'bust')) {
      while (handValue(faces(s.dealer)).total < 17) this.dealDealer()
      const { total } = handValue(faces(s.dealer))
      if (total > 21) this.emit({ type: 'dealerBust', seat: DEALER, total })
    }
    this.resolve()
  }

  resolve() {
    const s = this.s
    const dealerNatural = isNatural(faces(s.dealer))
    const dealerTotal = handValue(faces(s.dealer)).total
    let wagered = 0
    let payout = 0
    s.hands.forEach((hand, index) => {
      if (hand.status === 'active') hand.status = 'stood'
      const outcome = outcomeOf(hand, dealerNatural, dealerTotal)
      hand.outcome = outcome
      hand.payout = PAYOUT[outcome](hand.bet)
      wagered += hand.bet
      payout += hand.payout
      this.emit({ type: 'handResult', seat: s.seat, hand: index, outcome, bet: hand.bet, payout: hand.payout })
    })
    s.stack += payout
    s.result = { wagered, payout, net: payout - wagered }
    s.phase = 'settling'
    s.active = -1
    this.emit({ type: 'roundEnd', seat: s.seat, wagered, payout, net: payout - wagered, stack: s.stack })
  }

  refill() {
    const s = this.s
    const amount = s.config.refillTo - s.stack
    s.stack = s.config.refillTo
    s.lastBet = 0
    s.phase = 'betting'
    s.dealer = []
    s.hands = []
    s.holeRevealed = false
    s.result = null
    this.emit({ type: 'refill', seat: s.seat, amount, stack: s.stack })
  }
}

function newHand(bet: number, fromSplit: boolean, first?: BlackjackCard): Hand {
  return {
    cards: first ? [first] : [],
    bet,
    status: 'active',
    doubled: false,
    fromSplit,
    outcome: null,
    payout: null,
  }
}

// Blackjack pays 3:2, rounded down to whole chips.
const PAYOUT: Record<Outcome, (bet: number) => number> = {
  blackjack: (bet) => bet + Math.floor((bet * 3) / 2),
  win: (bet) => bet * 2,
  push: (bet) => bet,
  lose: () => 0,
}

function outcomeOf(hand: Hand, dealerNatural: boolean, dealerTotal: number): Outcome {
  if (hand.status === 'bust') return 'lose'
  if (hand.status === 'blackjack') return dealerNatural ? 'push' : 'blackjack'
  if (dealerNatural) return 'lose'
  const total = handValue(faces(hand.cards)).total
  if (dealerTotal > 21 || total > dealerTotal) return 'win'
  return total === dealerTotal ? 'push' : 'lose'
}

function apply(state: BlackjackState, seat: SeatId, action: BlackjackAction, rng: Rng) {
  if (!legalTypes(state, seat).includes(action.type)) {
    throw new IllegalActionError(`"${action.type}" is not legal now`)
  }
  if (action.type === 'bet') {
    const err = betError(state, action.amount)
    if (err) throw new IllegalActionError(err)
  }
  const table = new Table(JSON.parse(JSON.stringify(state)) as BlackjackState, rng)
  switch (action.type) {
    case 'bet':
      table.startRound(action.amount)
      break
    case 'hit':
      table.hit()
      break
    case 'stand':
      table.stand()
      break
    case 'double':
      table.double()
      break
    case 'split':
      table.split()
      break
    case 'refill':
      table.refill()
      break
  }
  return { state: table.s, events: table.events }
}

function view(state: BlackjackState, seat: SeatId): BlackjackView {
  const dealerCards: VisibleCard[] = state.dealer.map((c, i) =>
    i === 1 && !state.holeRevealed ? { id: HOLE_ID, deck: c.deck, face: null } : c,
  )
  const shownDealer = dealerCards.flatMap((c) => (c.face ? [c.face] : []))
  const dealerValue = handValue(shownDealer)
  return {
    phase: state.phase,
    round: state.round,
    stack: state.stack,
    minBet: state.config.minBet,
    betStep: state.config.betStep,
    lastBet: state.lastBet,
    dealer: {
      cards: dealerCards,
      total: shownDealer.length ? dealerValue.total : null,
      soft: dealerValue.soft,
    },
    hands: state.hands.map((h) => ({ ...h, cards: [...h.cards], ...handValue(faces(h.cards)) })),
    active: state.active,
    legal: legalTypes(state, seat),
    result: state.result,
    shoe: { remaining: state.shoe.length, size: state.shoeSize },
  }
}

function settle(state: BlackjackState): Settlement[] {
  if (state.phase !== 'settling' || !state.result) throw new Error('Round is not settled')
  return [{ seat: state.seat, delta: state.result.net }]
}

function staked(state: BlackjackState, seat: SeatId): number {
  if (state.phase !== 'playing' || seat !== state.seat) return 0
  return state.hands.reduce((total, hand) => total + hand.bet, 0)
}

export const blackjack: GameDefinition<
  BlackjackConfig,
  BlackjackState,
  BlackjackAction,
  BlackjackView,
  BlackjackFace
> = {
  id: 'blackjack',
  name: 'Blackjack',
  version: 1,
  deck: standard52,
  seats: { min: 2, max: 2 },
  defaultConfig,
  parseConfig,
  house: [{ id: DEALER, name: 'Dealer' }],
  setup,
  // The player can always act: bet, refill, or play the hand. The dealer plays inside apply().
  toAct: (state) => state.seat,
  legalActions,
  apply,
  view,
  phase: (state) => state.phase,
  settle,
  staked,
}

import type { SeatId } from '@neon-cards/engine'
import type { EkCard, EkState, RigName, Title } from './types'

const HUMAN = 'you'

/**
 * Post-shuffle swaps. No rng, so the same seed's card ids match an unrigged setup.
 * A swap never takes the last defuse in `you`'s hand, except `explode`, which moves that defuse to `cpu-1`.
 */

interface Slot {
  get(): EkCard
  set(card: EkCard): void
}

function slots(state: EkState): Slot[] {
  const out: Slot[] = []
  for (const seat of state.order) {
    const hand = state.seats[seat]?.hand
    if (!hand) continue
    for (let i = 0; i < hand.length; i++) {
      out.push({
        get: () => hand[i] as EkCard,
        set: (card) => {
          hand[i] = card
        },
      })
    }
  }
  for (const zone of ['draw', 'discard', 'removed'] as const) {
    const pile = state[zone]
    for (let i = 0; i < pile.length; i++) {
      out.push({
        get: () => pile[i] as EkCard,
        set: (card) => {
          pile[i] = card
        },
      })
    }
  }
  return out
}

function swap(a: Slot, b: Slot): void {
  const left = a.get()
  const right = b.get()
  a.set(right)
  b.set(left)
}

function soleDefuse(state: EkState, seat: SeatId): string | null {
  const cards = state.seats[seat]?.hand.filter((card) => card.face.title === 'defuse') ?? []
  return cards.length === 1 ? (cards[0]?.id ?? null) : null
}

function ensureDrawTop(state: EkState, title: Title, locked: Set<string>, protect: string | null): void {
  const current = state.draw[0]
  if (current?.face.title === title) {
    locked.add(current.id)
    return
  }
  const all = slots(state)
  const usable = (slot: Slot, preferDraw: boolean) => {
    const card = slot.get()
    if (card.face.title !== title) return false
    if (locked.has(card.id) || card.id === protect) return false
    if (preferDraw && !state.draw.includes(card)) return false
    return true
  }
  const donor = all.find((slot) => usable(slot, true)) ?? all.find((slot) => usable(slot, false))
  const top = all.find((slot) => slot.get().id === current?.id)
  if (!donor || !top) throw new Error(`rig cannot place ${title} on top of the draw`)
  swap(donor, top)
  locked.add(top.get().id)
}

function ensureInHand(state: EkState, seat: SeatId, title: Title, locked: Set<string>, protect: string | null): void {
  const hand = state.seats[seat]?.hand
  if (!hand) throw new Error(`rig missing seat ${seat}`)
  const held = hand.find((card) => card.face.title === title)
  if (held) {
    locked.add(held.id)
    return
  }
  const all = slots(state)
  const donor = all.find((slot) => {
    const card = slot.get()
    return card.face.title === title && !locked.has(card.id) && card.id !== protect && !hand.includes(card)
  })
  const recipient = all.find((slot) => {
    const card = slot.get()
    return hand.includes(card) && !locked.has(card.id) && card.id !== protect
  })
  if (!donor || !recipient) throw new Error(`rig cannot put ${title} in ${seat}'s hand`)
  swap(donor, recipient)
  locked.add(recipient.get().id)
}

function moveCpuDefuseToDiscard(state: EkState): string {
  const hand = state.seats['cpu-1']?.hand
  if (!hand) throw new Error('five rig needs cpu-1')
  const index = hand.findIndex((card) => card.face.title === 'defuse')
  const card = index >= 0 ? hand[index] : undefined
  if (!card) throw new Error('cpu-1 has no defuse to discard')
  hand.splice(index, 1)
  state.discard.push(card)
  return card.id
}

function diversify(state: EkState, locked: Set<string>, protect: string | null): void {
  const hand = state.seats[HUMAN]?.hand
  if (!hand) throw new Error('five rig needs you')
  while (new Set(hand.map((card) => card.face.title)).size < 5) {
    const counts = new Map<Title, number>()
    for (const card of hand) counts.set(card.face.title, (counts.get(card.face.title) ?? 0) + 1)
    const have = new Set(hand.map((card) => card.face.title))
    const all = slots(state)
    const recipient = all.find((slot) => {
      const card = slot.get()
      return hand.includes(card) && (counts.get(card.face.title) ?? 0) >= 2 && !locked.has(card.id) && card.id !== protect
    })
    const donor = all.find((slot) => {
      const card = slot.get()
      return !hand.includes(card) && !have.has(card.face.title) && !locked.has(card.id) && card.id !== protect
    })
    if (!recipient || !donor) throw new Error('five rig cannot give you five titles')
    swap(donor, recipient)
  }
}

/** Thirteen cards is the desktop bar: the old straight row put exactly three of them past x=1440. */
const CROWD_HAND = 13

function fillHand(state: EkState, count: number, locked: Set<string>, protect: string | null): void {
  const hand = state.seats[HUMAN]?.hand
  if (!hand) throw new Error('crowd rig needs you')
  while (hand.length < count) {
    const index = state.draw.findIndex((card) => card.face.title !== 'kitten' && card.id !== protect && !locked.has(card.id))
    const card = index >= 0 ? state.draw.splice(index, 1)[0] : undefined
    if (!card) throw new Error('crowd rig cannot fill the hand')
    hand.push(card)
    locked.add(card.id)
  }
}

export function applyRig(state: EkState, rig: RigName): void {
  const locked = new Set<string>()
  const protect = soleDefuse(state, HUMAN)
  if (rig === 'crowd') {
    fillHand(state, CROWD_HAND, locked, protect)
    ensureDrawTop(state, 'kitten', locked, protect)
    return
  }
  if (rig === 'kitten') {
    ensureDrawTop(state, 'kitten', locked, protect)
    return
  }
  if (rig === 'explode') {
    ensureDrawTop(state, 'kitten', locked, protect)
    const yours = protect ? state.seats[HUMAN]?.hand.find((card) => card.id === protect) : undefined
    if (!yours) throw new Error('explode rig needs your defuse')
    const all = slots(state)
    const from = all.find((slot) => slot.get().id === yours.id)
    const onto = all.find((slot) => {
      const card = slot.get()
      return state.seats['cpu-1']?.hand.includes(card) && card.face.title !== 'defuse' && !locked.has(card.id)
    })
    if (!from || !onto) throw new Error('explode rig cannot move your defuse to cpu-1')
    swap(from, onto)
    return
  }
  if (rig === 'nope') {
    ensureDrawTop(state, 'tacocat', locked, protect)
    ensureInHand(state, HUMAN, 'nope', locked, protect)
    ensureInHand(state, 'cpu-1', 'attack', locked, protect)
    ensureInHand(state, 'cpu-1', 'nope', locked, protect)
    return
  }
  if (rig === 'favor') {
    ensureInHand(state, HUMAN, 'favor', locked, protect)
    return
  }
  const discarded = moveCpuDefuseToDiscard(state)
  locked.add(discarded)
  diversify(state, locked, protect)
}

import {
  buildShoe,
  ConfigError,
  faceDown,
  IllegalActionError,
  parseSettings,
  shuffle,
  type GameDefinition,
  type GameEvent,
  type Rng,
  type Seat,
  type SeatId,
  type SettingSpec,
} from '@neon-cards/engine'
import { ekDeck } from './deck'
import { openNope, passNope, playNope, type NopeCtx } from './nope'
import { applyRig } from './rigs'
import {
  PLAY_TITLES,
  RIGS,
  TITLE_ORDER,
  type Effect,
  type EkAction,
  type EkCard,
  type EkConfig,
  type EkFace,
  type EkState,
  type EkView,
  type Pending,
  type PendingView,
  type PlayTitle,
  type RigName,
  type Title,
} from './types'

export const HUMAN = 'you'

export const settings: SettingSpec[] = [
  {
    key: 'opponents',
    label: 'Opponents',
    options: [1, 2, 3].map((n) => ({ value: n, label: String(n) })),
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
]

export const defaultConfig: EkConfig = { opponents: 2, difficulty: 'medium' }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function illegal(message: string): never {
  throw new IllegalActionError(message)
}

function isRig(value: string): value is RigName {
  return (RIGS as readonly string[]).includes(value)
}

function isTitle(value: string): value is Title {
  return (TITLE_ORDER as readonly string[]).includes(value)
}

function isPlayTitle(value: string): value is PlayTitle {
  return (PLAY_TITLES as readonly string[]).includes(value)
}

function parseConfig(input: unknown): EkConfig {
  const config = parseSettings(settings, defaultConfig, input)
  const rig = input && typeof input === 'object' && !Array.isArray(input) ? (input as { rig?: unknown }).rig : undefined
  if (rig === undefined) return { opponents: config.opponents, difficulty: config.difficulty }
  if (typeof rig !== 'string' || !isRig(rig)) throw new ConfigError('rig must be a known name')
  return { opponents: config.opponents, difficulty: config.difficulty, rig }
}

function emptyKnown(order: SeatId[]): EkState['known'] {
  const known: EkState['known'] = {}
  for (const seat of order) known[seat] = { top: [], planted: null }
  return known
}

function setup(config: EkConfig, seats: Seat[], rng: Rng): EkState {
  const humans = seats.filter((seat) => seat.kind === 'human')
  if (humans.length !== 1) throw new Error('setup needs exactly one human')
  const human = humans[0]?.id ?? HUMAN
  const order = seats.map((seat) => seat.id)
  const shoe = buildShoe(ekDeck, 1, rng)
  const kittens: EkCard[] = []
  const defuses: EkCard[] = []
  const pile: EkCard[] = []
  for (const card of shoe) {
    if (card.face.title === 'kitten') kittens.push(card)
    else if (card.face.title === 'defuse') defuses.push(card)
    else pile.push(card)
  }
  const hands: Record<SeatId, EkCard[]> = {}
  for (const seat of order) hands[seat] = pile.splice(0, 7)
  for (const seat of order) {
    const defuse = defuses.shift()
    if (!defuse) throw new Error('setup ran out of defuses')
    hands[seat]?.push(defuse)
  }
  const extras = seats.length === 4 ? defuses.length : 2
  pile.push(...defuses.splice(0, extras))
  const removed = [...defuses]
  const buried = seats.length - 1
  pile.push(...kittens.splice(0, buried))
  removed.push(...kittens)
  const state: EkState = {
    order,
    human,
    seats: Object.fromEntries(order.map((id) => [id, { hand: hands[id] ?? [], alive: true }])),
    draw: shuffle(pile, rng),
    discard: [],
    removed,
    turn: human,
    owed: 0,
    pending: { kind: 'turn', seat: human },
    known: emptyKnown(order),
    winner: null,
  }
  if (config.rig) applyRig(state, config.rig)
  return state
}

function toAct(state: EkState): SeatId | null {
  const pending = state.pending
  if (!pending) return null
  if (pending.kind === 'nope') return pending.queue[pending.index] ?? null
  return pending.seat
}

function holds(state: EkState, seat: SeatId, title: Title): boolean {
  return state.seats[seat]?.hand.some((card) => card.face.title === title) ?? false
}

function countOf(hand: readonly EkCard[], title: Title): number {
  return hand.reduce((n, card) => n + (card.face.title === title ? 1 : 0), 0)
}

function otherLiving(state: EkState, seat: SeatId): SeatId[] {
  return state.order.filter((id) => id !== seat && state.seats[id]?.alive === true)
}

function topDefuse(discard: readonly EkCard[]): EkCard | undefined {
  for (let i = discard.length - 1; i >= 0; i--) {
    const card = discard[i]
    if (card?.face.title === 'defuse') return card
  }
  return undefined
}

/** The one menu five: earliest five non-defuse titles in TITLE_ORDER, taking the topmost discarded defuse. */
function menuFive(state: EkState, seat: SeatId): EkAction | null {
  const hand = state.seats[seat]?.hand ?? []
  if (hand.some((card) => card.face.title === 'defuse')) return null
  const prize = topDefuse(state.discard)
  if (!prize) return null
  const titles = TITLE_ORDER.filter((title) => title !== 'defuse' && hand.some((card) => card.face.title === title)).slice(0, 5)
  if (titles.length < 5) return null
  return { type: 'five', titles: [...titles], takeId: prize.id }
}

function legalActions(state: EkState, seat: SeatId): EkAction[] {
  if (seat !== toAct(state)) return []
  const pending = state.pending
  if (!pending) return []
  if (pending.kind === 'nope') {
    const menu: EkAction[] = [{ type: 'pass' }]
    if (holds(state, seat, 'nope')) menu.push({ type: 'nope' })
    return menu
  }
  if (pending.kind === 'give') {
    return (state.seats[seat]?.hand ?? []).map((card) => ({ type: 'give', cardId: card.id }))
  }
  if (pending.kind === 'defuse') {
    const menu: EkAction[] = []
    for (let index = 0; index <= state.draw.length; index++) menu.push({ type: 'defuse', index })
    return menu
  }
  const hand = state.seats[seat]?.hand ?? []
  const menu: EkAction[] = [{ type: 'draw' }]
  for (const title of PLAY_TITLES) if (holds(state, seat, title)) menu.push({ type: 'play', title })
  const targets = otherLiving(state, seat)
  if (holds(state, seat, 'favor')) for (const target of targets) menu.push({ type: 'favor', target })
  for (const title of TITLE_ORDER) {
    if (countOf(hand, title) < 2) continue
    for (const target of targets) menu.push({ type: 'pair', title, target })
  }
  for (const title of TITLE_ORDER) {
    if (countOf(hand, title) < 3) continue
    for (const target of targets) for (const name of TITLE_ORDER) menu.push({ type: 'three', title, target, name })
  }
  const five = menuFive(state, seat)
  if (five) menu.push(five)
  return menu
}

function nextLiving(state: EkState, from: SeatId): SeatId {
  const start = state.order.indexOf(from)
  for (let step = 1; step <= state.order.length; step++) {
    const id = state.order[(start + step) % state.order.length] as SeatId
    if (state.seats[id]?.alive) return id
  }
  throw new Error('no living seat')
}

function finishTurn(ctx: NopeCtx, seat: SeatId): void {
  const left = ctx.s.owed === 0 ? 1 : ctx.s.owed
  const remaining = left - 1
  if (remaining === 0) {
    const next = nextLiving(ctx.s, seat)
    ctx.s.turn = next
    ctx.s.owed = 0
    ctx.s.pending = { kind: 'turn', seat: next }
    return
  }
  ctx.s.turn = seat
  ctx.s.owed = remaining
  ctx.s.pending = { kind: 'turn', seat }
}

function backToTurn(state: EkState, seat: SeatId): void {
  state.turn = seat
  state.pending = { kind: 'turn', seat }
}

function clearKnown(state: EkState, seat: SeatId): void {
  state.known[seat] = { top: [], planted: null }
}

function clearAllKnown(state: EkState): void {
  for (const seat of state.order) clearKnown(state, seat)
}

/** Every seat drops a drawn leading id and moves `planted` up. A planted 0 was the card just drawn. */
function onDraw(state: EkState, cardId: string): void {
  for (const seat of state.order) {
    const known = state.known[seat]
    if (!known) continue
    if (known.top[0] === cardId) known.top.shift()
    if (known.planted === null) continue
    if (known.planted <= 0) known.planted = null
    else known.planted -= 1
  }
}

/**
 * Own insert. `index` is the draw index the kitten is spliced into.
 * A previously buried kitten at or below `index` moves one deeper. A new bury replaces the old index.
 * A planted index the prefix now covers is cleared.
 */
function onOwnInsert(state: EkState, seat: SeatId, index: number, kittenId: string): void {
  const known = state.known[seat] ?? { top: [], planted: null }
  state.known[seat] = known
  if (known.planted !== null && known.planted >= index) known.planted += 1
  if (index <= known.top.length) known.top.splice(index, 0, kittenId)
  else known.planted = index
  if (known.planted !== null && known.planted < known.top.length) known.planted = null
}

function onOtherInsert(state: EkState, actor: SeatId): void {
  for (const seat of state.order) if (seat !== actor) clearKnown(state, seat)
}

function livingTarget(state: EkState, seat: SeatId, target: SeatId): boolean {
  return target !== seat && state.seats[target]?.alive === true
}

function pullTitle(hand: EkCard[], title: Title, n: number): EkCard[] {
  const taken: EkCard[] = []
  const keep: EkCard[] = []
  for (const card of hand) {
    if (taken.length < n && card.face.title === title) taken.push(card)
    else keep.push(card)
  }
  if (taken.length < n) illegal(`hand has fewer than ${n} ${title}`)
  hand.length = 0
  hand.push(...keep)
  return taken
}

function sortedTitles(titles: readonly Title[]): Title[] {
  return [...titles].sort((a, b) => TITLE_ORDER.indexOf(a) - TITLE_ORDER.indexOf(b))
}

function playFive(hand: EkCard[], titles: readonly Title[]): EkCard[] {
  const cards: EkCard[] = []
  for (const title of titles) {
    const card = hand.find((item) => item.face.title === title)
    if (!card) illegal(`hand has no ${title}`)
    cards.push(card)
  }
  const ids = new Set(cards.map((card) => card.id))
  const keep = hand.filter((card) => !ids.has(card.id))
  hand.length = 0
  hand.push(...keep)
  return cards
}

function assertFive(state: EkState, seat: SeatId, titles: readonly string[], takeId: string): Title[] {
  if (titles.length !== 5) illegal('five needs five titles')
  const named: Title[] = []
  for (const title of titles) {
    if (!isTitle(title)) illegal(`unknown title ${title}`)
    named.push(title)
  }
  if (new Set(named).size !== 5) illegal('five titles must be distinct')
  const hand = state.seats[seat]?.hand
  if (!hand) illegal('no hand')
  for (const title of named) if (!hand.some((card) => card.face.title === title)) illegal(`hand has no ${title}`)
  const legal = new Set(state.discard.map((card) => card.id))
  for (const title of named) {
    const card = hand.find((item) => item.face.title === title)
    if (card) legal.add(card.id)
  }
  if (!legal.has(takeId)) illegal('takeId is not in the discard or the five')
  return sortedTitles(named)
}

function resolveEffect(ctx: NopeCtx, actor: SeatId, effect: Effect): void {
  const { s } = ctx
  if (effect.type === 'skip') {
    finishTurn(ctx, actor)
    return
  }
  if (effect.type === 'attack') {
    const owed = s.owed === 0 ? 2 : s.owed + 2
    const to = nextLiving(s, actor)
    s.turn = to
    s.owed = owed
    s.pending = { kind: 'turn', seat: to }
    ctx.events.push({ type: 'Attacked', from: actor, to, owed })
    return
  }
  if (effect.type === 'shuffle') {
    s.draw = shuffle(s.draw, ctx.rng)
    clearAllKnown(s)
    ctx.events.push({ type: 'Shuffled', count: s.draw.length })
    backToTurn(s, actor)
    return
  }
  if (effect.type === 'future') {
    const n = Math.min(3, s.draw.length)
    s.known[actor] = { top: s.draw.slice(0, n).map((card) => card.id), planted: null }
    ctx.events.push({ type: 'Peeked', seat: actor, count: n })
    backToTurn(s, actor)
    return
  }
  if (effect.type === 'favor') {
    const target = s.seats[effect.target]
    const hand = target?.hand ?? []
    if (!target?.alive) illegal('favor target is not alive')
    if (hand.length === 0) {
      ctx.events.push({ type: 'Whiff', seat: actor })
      backToTurn(s, actor)
      return
    }
    if (hand.length === 1) {
      const card = hand.shift()
      if (!card) illegal('favor target has no card')
      s.seats[actor]?.hand.push(card)
      ctx.events.push({ type: 'Gave', from: effect.target, to: actor })
      backToTurn(s, actor)
      return
    }
    s.pending = { kind: 'give', seat: effect.target, to: actor }
    return
  }
  if (effect.type === 'pair') {
    const hand = s.seats[effect.target]?.hand ?? []
    if (hand.length === 0) {
      ctx.events.push({ type: 'Whiff', seat: actor })
      backToTurn(s, actor)
      return
    }
    const card = hand.splice(ctx.rng.int(hand.length), 1)[0]
    if (!card) illegal('pair stole nothing')
    s.seats[actor]?.hand.push(card)
    ctx.events.push({ type: 'Stole', from: effect.target, to: actor })
    backToTurn(s, actor)
    return
  }
  if (effect.type === 'three') {
    const hand = s.seats[effect.target]?.hand ?? []
    const at = hand.findIndex((card) => card.face.title === effect.name)
    if (at < 0) {
      ctx.events.push({ type: 'Asked', from: actor, to: effect.target, title: effect.name, hit: false })
    } else {
      const card = hand.splice(at, 1)[0]
      if (!card) illegal('three moved nothing')
      s.seats[actor]?.hand.push(card)
      ctx.events.push({ type: 'Asked', from: actor, to: effect.target, title: effect.name, hit: true, card })
    }
    backToTurn(s, actor)
    return
  }
  if (effect.type !== 'five') illegal(`unresolved effect ${effect.type}`)
  const at = s.discard.findIndex((card) => card.id === effect.takeId)
  const card = at >= 0 ? s.discard.splice(at, 1)[0] : undefined
  if (!card) illegal('five takeId is not in the discard')
  s.seats[actor]?.hand.push(card)
  ctx.events.push({ type: 'Took', seat: actor, card })
  backToTurn(s, actor)
}

function beginPlay(ctx: NopeCtx, actor: SeatId, cards: EkCard[], effect: Effect): void {
  ctx.s.discard.push(...cards)
  ctx.events.push({ type: 'Played', seat: actor, cards, effect })
  openNope(ctx, actor, effect, () => resolveEffect(ctx, actor, effect))
}

function requireTurn(pending: Pending): void {
  if (pending.kind !== 'turn') illegal(`${pending.kind} is not a turn`)
}

function drawCard(ctx: NopeCtx, seat: SeatId): void {
  const { s } = ctx
  if (s.draw.length === 0 && s.discard.length > 0) {
    const count = s.discard.length
    s.draw = shuffle(s.discard, ctx.rng)
    s.discard = []
    clearAllKnown(s)
    ctx.events.push({ type: 'Reshuffled', count })
  }
  if (s.draw.length === 0) {
    ctx.events.push({ type: 'Drew', seat, card: null })
    finishTurn(ctx, seat)
    return
  }
  const card = s.draw[0]
  if (!card) illegal('draw is empty')
  onDraw(s, card.id)
  s.draw.shift()
  if (card.face.title !== 'kitten') {
    s.seats[seat]?.hand.push(card)
    ctx.events.push({ type: 'Drew', seat, card: faceDown(card) })
    finishTurn(ctx, seat)
    return
  }
  ctx.events.push({ type: 'DrewKitten', seat, card })
  if (holds(s, seat, 'defuse')) {
    s.pending = { kind: 'defuse', seat, kitten: card }
    return
  }
  explode(ctx, seat, card)
}

function explode(ctx: NopeCtx, seat: SeatId, kitten: EkCard): void {
  const { s } = ctx
  const hand = [...(s.seats[seat]?.hand ?? [])]
  s.discard.push(...hand, kitten)
  const who = s.seats[seat]
  if (who) who.hand = []
  if (who) who.alive = false
  ctx.events.push({ type: 'Exploded', seat, kitten, hand })
  clearKnown(s, seat)
  const living = s.order.filter((id) => s.seats[id]?.alive)
  if (living.length === 1) {
    const winner = living[0] as SeatId
    s.winner = winner
    s.pending = null
    s.turn = null
    ctx.events.push({ type: 'Won', seat: winner })
    return
  }
  const next = nextLiving(s, seat)
  s.turn = next
  s.owed = 0
  s.pending = { kind: 'turn', seat: next }
}

function giveCard(ctx: NopeCtx, seat: SeatId, cardId: string): void {
  const pending = ctx.s.pending
  if (!pending || pending.kind !== 'give') illegal('give is only legal while a favor is owed')
  const hand = ctx.s.seats[seat]?.hand
  const at = hand?.findIndex((card) => card.id === cardId) ?? -1
  if (!hand || at < 0) illegal('that card is not in the giver hand')
  const card = hand.splice(at, 1)[0]
  if (!card) illegal('that card is not in the giver hand')
  ctx.s.seats[pending.to]?.hand.push(card)
  ctx.events.push({ type: 'Gave', from: seat, to: pending.to })
  ctx.s.turn = pending.to
  ctx.s.pending = { kind: 'turn', seat: pending.to }
}

function defuseKitten(ctx: NopeCtx, seat: SeatId, index: number): void {
  const pending = ctx.s.pending
  if (!pending || pending.kind !== 'defuse' || pending.seat !== seat) illegal('defuse is only legal for the seat who drew a kitten')
  if (!Number.isInteger(index) || index < 0 || index > ctx.s.draw.length) illegal('defuse index is outside the draw')
  const hand = ctx.s.seats[seat]?.hand
  const at = hand?.findIndex((card) => card.face.title === 'defuse') ?? -1
  if (!hand || at < 0) illegal('no defuse in hand')
  const defuse = hand.splice(at, 1)[0]
  if (!defuse) illegal('no defuse in hand')
  ctx.s.discard.push(defuse)
  onOwnInsert(ctx.s, seat, index, pending.kitten.id)
  onOtherInsert(ctx.s, seat)
  ctx.s.draw.splice(index, 0, pending.kitten)
  ctx.events.push({ type: 'Defused', seat, defuse, kitten: pending.kitten })
  finishTurn(ctx, seat)
}

function apply(state: EkState, seat: SeatId, action: EkAction, rng: Rng): { state: EkState; events: GameEvent[] } {
  if (toAct(state) !== seat) illegal(`"${seat}" is not to act`)
  const s = clone(state)
  const ctx: NopeCtx = { s, events: [], rng }
  const pending = s.pending
  if (!pending) illegal('game is over')
  if (action.type === 'draw') {
    requireTurn(pending)
    drawCard(ctx, seat)
  } else if (action.type === 'play') {
    requireTurn(pending)
    if (!isPlayTitle(action.title)) illegal(`${action.title} is not a turn play`)
    const hand = s.seats[seat]?.hand
    if (!hand) illegal('no hand')
    const cards = pullTitle(hand, action.title, 1)
    beginPlay(ctx, seat, cards, { type: action.title })
  } else if (action.type === 'favor') {
    requireTurn(pending)
    if (!holds(s, seat, 'favor')) illegal('no favor in hand')
    if (!livingTarget(s, seat, action.target)) illegal('favor target is not another living seat')
    const hand = s.seats[seat]?.hand
    if (!hand) illegal('no hand')
    beginPlay(ctx, seat, pullTitle(hand, 'favor', 1), { type: 'favor', target: action.target })
  } else if (action.type === 'pair') {
    requireTurn(pending)
    if (!isTitle(action.title)) illegal('pair title is unknown')
    if (!livingTarget(s, seat, action.target)) illegal('pair target is not another living seat')
    const hand = s.seats[seat]?.hand
    if (!hand || countOf(hand, action.title) < 2) illegal('pair needs two of that title')
    beginPlay(ctx, seat, pullTitle(hand, action.title, 2), { type: 'pair', target: action.target, title: action.title })
  } else if (action.type === 'three') {
    requireTurn(pending)
    if (!isTitle(action.title) || !isTitle(action.name)) illegal('three title is unknown')
    if (!livingTarget(s, seat, action.target)) illegal('three target is not another living seat')
    const hand = s.seats[seat]?.hand
    if (!hand || countOf(hand, action.title) < 3) illegal('three needs three of that title')
    beginPlay(ctx, seat, pullTitle(hand, action.title, 3), {
      type: 'three',
      target: action.target,
      title: action.title,
      name: action.name,
    })
  } else if (action.type === 'five') {
    requireTurn(pending)
    const titles = assertFive(s, seat, action.titles, action.takeId)
    const hand = s.seats[seat]?.hand
    if (!hand) illegal('no hand')
    const effect: Effect = { type: 'five', titles, takeId: action.takeId }
    beginPlay(ctx, seat, playFive(hand, titles), effect)
  } else if (action.type === 'pass') {
    if (pending.kind !== 'nope') illegal('pass is only legal in a nope window')
    const actor = pending.actor
    const effect = pending.effect
    passNope(ctx, () => resolveEffect(ctx, actor, effect))
  } else if (action.type === 'nope') {
    if (pending.kind !== 'nope') illegal('nope is only legal in a nope window')
    const actor = pending.actor
    const effect = pending.effect
    playNope(ctx, seat, () => resolveEffect(ctx, actor, effect))
  } else if (action.type === 'give') {
    giveCard(ctx, seat, action.cardId)
  } else {
    defuseKitten(ctx, seat, action.index)
  }
  return { state: s, events: ctx.events }
}

function cardsFor(draw: readonly EkCard[], ids: readonly string[]): EkCard[] {
  const out: EkCard[] = []
  for (const id of ids) {
    const card = draw.find((item) => item.id === id)
    if (card) out.push(card)
  }
  return out
}

function pendingView(pending: Pending | null): PendingView | null {
  if (!pending) return null
  if (pending.kind !== 'nope') return pending
  const seat = pending.queue[pending.index]
  if (!seat) return null
  return { kind: 'nope', seat, actor: pending.actor, effect: pending.effect, nopes: pending.nopes, top: pending.top }
}

function view(state: EkState, me: SeatId): EkView {
  const seats: EkView['seats'] = {}
  for (const id of state.order) {
    const seat = state.seats[id]
    seats[id] = { alive: seat?.alive ?? false, count: seat?.hand.length ?? 0 }
  }
  const known = state.known[me]
  return {
    me,
    order: [...state.order],
    seats,
    hand: [...(state.seats[me]?.hand ?? [])],
    drawCount: state.draw.length,
    discard: [...state.discard],
    turn: state.turn,
    owed: state.owed,
    pending: pendingView(state.pending),
    knownTop: cardsFor(state.draw, known?.top ?? []),
    plantedIndex: known?.planted ?? null,
    winner: state.winner,
    actions: legalActions(state, me),
  }
}

function phase(state: EkState): 'playing' | 'over' {
  return state.pending === null ? 'over' : 'playing'
}

function settle(state: EkState): { seat: SeatId; delta: number }[] {
  return state.order.map((seat) => ({ seat, delta: 0 }))
}

export const explodingKittens: GameDefinition<EkConfig, EkState, EkAction, EkView, EkFace> = {
  id: 'exploding-kittens',
  name: 'Exploding Kittens',
  version: 1,
  deck: ekDeck,
  seats: { min: 2, max: 4 },
  defaultConfig,
  parseConfig,
  house: [],
  setup,
  toAct,
  legalActions,
  apply,
  view,
  phase,
  settle,
}

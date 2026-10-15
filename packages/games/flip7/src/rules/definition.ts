import {
  buildShoe,
  ConfigError,
  flip7Deck,
  IllegalActionError,
  parseSettings,
  shuffle,
  type Flip7Face,
  type GameDefinition,
  type GameEvent,
  type Rng,
  type Seat,
  type SeatId,
  type SettingSpec,
} from '@neon-cards/engine'
import {
  emptyLine,
  faceKey,
  hasAnyCard,
  hasNumber,
  numberValues,
  roundValue,
  scoreParts,
  TARGET_SCORE,
  UNIQUE_TO_FLIP7,
} from './cards'
import { parseRig, rigForSeats, totalsForSeats } from './rigs'
import type {
  F7Card,
  Flip7Action,
  Flip7Config,
  Flip7Event,
  Flip7Number,
  Flip7State,
  Flip7View,
  Pending,
  RoundScore,
  SeatRound,
  Task,
} from './types'

export const HUMAN = 'you'

export const settings: SettingSpec[] = [
  { key: 'opponents', label: 'Opponents', options: [1, 2, 3].map((n) => ({ value: n, label: String(n) })) },
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

export const defaultConfig: Flip7Config = { opponents: 2, difficulty: 'medium' }

function parseConfig(input: unknown): Flip7Config {
  const config = parseSettings(settings, defaultConfig, input)
  const rig = (input as { rig?: unknown } | null | undefined)?.rig
  if (rig === undefined) return { opponents: config.opponents, difficulty: config.difficulty }
  if (typeof rig !== 'string' || rig === '') throw new ConfigError('rig must be a non-empty string')
  parseRig(rig)
  return { opponents: config.opponents, difficulty: config.difficulty, rig }
}

const freshRound = (): SeatRound => ({ status: 'active', line: emptyLine(), flip7: false })

/** One apply() call: a private copy of the state, the events so far, and the deck rng. */
interface Ctx {
  s: Flip7State
  events: GameEvent[]
  rng: Rng
}

const emit = (ctx: Ctx, event: Flip7Event) => ctx.events.push(event)
const seatRound = (s: Flip7State, seat: SeatId): SeatRound => {
  const r = s.rounds[seat]
  if (!r) throw new Error(`unknown seat "${seat}"`)
  return r
}
const isActive = (s: Flip7State, seat: SeatId) => s.rounds[seat]?.status === 'active'
const activeSeats = (s: Flip7State) => s.order.filter((id) => isActive(s, id))
const nextSeat = (s: Flip7State, seat: SeatId) => s.order[(s.order.indexOf(seat) + 1) % s.order.length] as SeatId

/** Clockwise from the seat after `anchor`, ending with `anchor` itself. */
function nextActiveAfter(s: Flip7State, anchor: SeatId): SeatId | null {
  const start = s.order.indexOf(anchor)
  for (let i = 1; i <= s.order.length; i++) {
    const id = s.order[(start + i) % s.order.length] as SeatId
    if (isActive(s, id)) return id
  }
  return null
}

const secondChanceRecipients = (s: Flip7State, from: SeatId) =>
  activeSeats(s).filter((id) => id !== from && seatRound(s, id).line.secondChance === null)

/** Seats the pending decision may pick. */
export function legalTargets(s: Flip7State): SeatId[] {
  const p = s.pending
  if (!p || p.kind === 'hitOrStay') return []
  return p.kind === 'passSecondChance' ? secondChanceRecipients(s, p.seat) : activeSeats(s)
}

/** Draws the next card for `seat`: its rigged face if any, else the top of the pile, reshuffling the discards when it is empty. */
function takeCard(ctx: Ctx, seat: SeatId): F7Card | null {
  const { s } = ctx
  const rigged = s.rig[seat]
  const key = rigged?.shift()
  if (key !== undefined) {
    for (const pile of [s.draw, s.discard]) {
      const i = pile.findIndex((c) => faceKey(c.face) === key)
      if (i >= 0) return pile.splice(i, 1)[0] as F7Card
    }
  }
  if (s.draw.length === 0) {
    if (s.discard.length === 0) return null
    s.draw = shuffle(s.discard, ctx.rng)
    s.discard = []
    emit(ctx, { type: 'DeckReshuffled', count: s.draw.length })
  }
  return s.draw.shift() ?? null
}

/** A seat receives a Second Chance: keep it, pass it to an active seat without one, or discard it. */
function giveSecondChance(ctx: Ctx, seat: SeatId, card: F7Card) {
  const { s } = ctx
  const line = seatRound(s, seat).line
  if (line.secondChance === null) {
    line.secondChance = card
    emit(ctx, { type: 'SecondChanceGained', seat, card })
    return
  }
  const recipients = secondChanceRecipients(s, seat)
  if (recipients.length === 0) {
    s.discard.push(card)
    emit(ctx, { type: 'SecondChanceDiscarded', seat, card })
  } else if (recipients.length === 1) {
    passSecondChance(ctx, seat, recipients[0] as SeatId, card)
  } else {
    s.pending = { kind: 'passSecondChance', seat, card }
  }
}

function passSecondChance(ctx: Ctx, seat: SeatId, to: SeatId, card: F7Card) {
  seatRound(ctx.s, to).line.secondChance = card
  emit(ctx, { type: 'SecondChancePassed', seat, to, card })
}

function draw(ctx: Ctx, seat: SeatId, source: 'initial' | 'hit' | 'flipThree') {
  const { s } = ctx
  const card = takeCard(ctx, seat)
  if (!card) return endRound(ctx)
  emit(ctx, { type: 'CardDealt', seat, card, source })
  const r = seatRound(s, seat)
  const face = card.face
  if (face.kind === 'number') {
    if (hasNumber(r.line, face.value)) {
      const sc = r.line.secondChance
      if (sc) {
        r.line.secondChance = null
        s.discard.push(sc, card)
        emit(ctx, { type: 'SecondChanceUsed', seat, card, secondChance: sc })
      } else {
        r.line.numbers.push(card)
        r.status = 'busted'
        emit(ctx, { type: 'Busted', seat, card })
      }
      return
    }
    r.line.numbers.push(card)
    if (new Set(numberValues(r.line)).size >= UNIQUE_TO_FLIP7) {
      r.flip7 = true
      emit(ctx, { type: 'Flip7Achieved', seat, numbers: numberValues(r.line) as Flip7Number[] })
      endRound(ctx)
    }
    return
  }
  if (face.kind === 'modifier') {
    r.line.modifiers.push(card)
    return
  }
  if (face.action === 'secondChance') return giveSecondChance(ctx, seat, card)
  if (source === 'flipThree') {
    const frame = s.stack[s.stack.length - 1]
    if (frame?.t !== 'flip3' || frame.seat !== seat) throw new Error('flip three draw outside its frame')
    frame.setAside.push(card)
    emit(ctx, { type: 'CardSetAside', seat, card })
    return
  }
  const targets = activeSeats(s)
  if (targets.length === 1) {
    const to = targets[0] as SeatId
    emit(ctx, { type: 'ActionTargeted', seat, to, card })
    s.stack.push({ t: 'resolve', card, from: seat, to })
  } else {
    s.pending = { kind: 'target', seat, card }
  }
}

function endRound(ctx: Ctx) {
  const { s } = ctx
  for (const task of s.stack) {
    if (task.t === 'flip3') {
      s.discard.push(task.card, ...task.setAside)
      if (task.setAside.length) emit(ctx, { type: 'SetAsideDiscarded', seat: task.seat, cards: task.setAside })
    } else if (task.t === 'assign') {
      s.discard.push(...task.cards, ...task.assigned.map((a) => a.card))
    } else if (task.t === 'resolve') {
      s.discard.push(task.card)
    }
  }
  s.stack = []
  s.pending = null
  const scores: RoundScore[] = s.order.map((seat) => {
    const parts = scoreParts(seatRound(s, seat))
    const total = (s.totals[seat] ?? 0) + parts.value
    s.totals[seat] = total
    return {
      seat,
      numbers: parts.numbers,
      x2: parts.x2,
      plus: parts.plus,
      flip7Bonus: parts.flip7Bonus,
      busted: seatRound(s, seat).status === 'busted',
      round: parts.value,
      total,
    }
  })
  s.lastScores = scores
  s.stage = 'roundOver'
  emit(ctx, { type: 'RoundScored', round: s.round, scores })
  const best = Math.max(...s.order.map((id) => s.totals[id] ?? 0))
  if (best < TARGET_SCORE) {
    s.tiebreak = false
    return
  }
  const leaders = s.order.filter((id) => s.totals[id] === best)
  if (leaders.length === 1) {
    s.winner = leaders[0] as SeatId
    s.stage = 'gameOver'
    emit(ctx, { type: 'GameWon', seat: s.winner, total: best })
  } else {
    s.tiebreak = true
    emit(ctx, { type: 'TiebreakRound', tied: leaders })
  }
}

function exec(ctx: Ctx, task: Task) {
  const { s } = ctx
  switch (task.t) {
    case 'turn': {
      const next = nextActiveAfter(s, task.anchor)
      if (next === null) return endRound(ctx)
      s.stack.push({ t: 'turn', anchor: next })
      s.pending = { kind: 'hitOrStay', seat: next }
      return
    }
    case 'deal': {
      const [seat, ...queue] = task.queue
      if (seat === undefined) return
      s.stack.push({ t: 'deal', queue })
      if (!isActive(s, seat)) return
      // A seat that already holds cards (from a Flip Three or a passed Second Chance) is asked instead of dealt.
      if (hasAnyCard(seatRound(s, seat).line)) s.pending = { kind: 'hitOrStay', seat }
      else s.stack.push({ t: 'draw', seat, source: 'initial' })
      return
    }
    case 'draw':
      return draw(ctx, task.seat, task.source)
    case 'flip3': {
      const r = seatRound(s, task.seat)
      if (r.status !== 'active') {
        s.discard.push(task.card, ...task.setAside)
        if (task.setAside.length) emit(ctx, { type: 'SetAsideDiscarded', seat: task.seat, cards: task.setAside })
        emit(ctx, { type: 'FlipThreeEnded', seat: task.seat, result: 'bust' })
        return
      }
      if (task.remaining === 0) {
        s.discard.push(task.card)
        emit(ctx, { type: 'FlipThreeEnded', seat: task.seat, result: 'complete' })
        if (task.setAside.length) s.stack.push({ t: 'assign', seat: task.seat, cards: task.setAside, assigned: [] })
        return
      }
      s.stack.push({ ...task, remaining: task.remaining - 1 })
      s.stack.push({ t: 'draw', seat: task.seat, source: 'flipThree' })
      return
    }
    case 'assign': {
      const [card, ...rest] = task.cards
      if (card === undefined) {
        for (const { card: c, to } of [...task.assigned].reverse()) s.stack.push({ t: 'resolve', card: c, from: task.seat, to })
        return
      }
      const targets = activeSeats(s)
      if (targets.length === 1) {
        const to = targets[0] as SeatId
        emit(ctx, { type: 'ActionTargeted', seat: task.seat, to, card })
        s.stack.push({ ...task, cards: rest, assigned: [...task.assigned, { card, to }] })
        return
      }
      s.stack.push(task)
      s.pending = { kind: 'assign', seat: task.seat, card }
      return
    }
    case 'resolve': {
      const { card, from, to } = task
      if (!isActive(s, to)) {
        s.discard.push(card)
        emit(ctx, { type: 'ActionDiscarded', seat: to, card })
        return
      }
      if (card.face.kind === 'action' && card.face.action === 'freeze') {
        const r = seatRound(s, to)
        r.status = 'frozen'
        r.line.freeze = card
        emit(ctx, { type: 'Frozen', seat: to, by: from, card, banked: roundValue(r) })
        return
      }
      emit(ctx, { type: 'FlipThreeStarted', seat: to, by: from, card })
      s.stack.push({ t: 'flip3', seat: to, card, remaining: 3, setAside: [] })
      return
    }
  }
}

/** Runs automatic steps until a seat must decide or the round ends. */
function run(ctx: Ctx) {
  const { s } = ctx
  while (s.pending === null && s.stage === 'playing') {
    const task = s.stack.pop()
    if (!task) throw new Error('work stack ran dry mid-round')
    exec(ctx, task)
  }
}

function startRound(ctx: Ctx) {
  const { s } = ctx
  if (s.round > 0) {
    for (const id of s.order) {
      const { line } = seatRound(s, id)
      s.discard.push(...line.numbers, ...line.modifiers)
      if (line.secondChance) s.discard.push(line.secondChance)
      if (line.freeze) s.discard.push(line.freeze)
    }
    s.dealer = nextSeat(s, s.dealer)
  }
  s.round += 1
  s.rounds = Object.fromEntries(s.order.map((id) => [id, freshRound()]))
  s.stage = 'playing'
  s.lastScores = null
  emit(ctx, { type: 'RoundStarted', round: s.round, dealer: s.dealer, tiebreak: s.tiebreak })
  const dealOrder: SeatId[] = []
  for (let id = nextSeat(s, s.dealer); dealOrder.length < s.order.length; id = nextSeat(s, id)) dealOrder.push(id)
  s.stack = [
    { t: 'turn', anchor: s.dealer },
    { t: 'deal', queue: dealOrder },
  ]
  run(ctx)
}

const toAct = (s: Flip7State): SeatId | null => (s.stage === 'playing' ? (s.pending?.seat ?? null) : null)

const opening = (s: Flip7State): Flip7Action | null => (s.stage === 'ready' || s.stage === 'roundOver' ? { type: 'nextRound' } : null)

function legalActions(s: Flip7State, seat: SeatId): Flip7Action[] {
  if (toAct(s) !== seat) return []
  const p = s.pending
  if (!p) return [{ type: 'nextRound' }]
  switch (p.kind) {
    case 'hitOrStay':
      return hasAnyCard(seatRound(s, seat).line) ? [{ type: 'hit' }, { type: 'stay' }] : [{ type: 'hit' }]
    case 'target':
      return legalTargets(s).map((to) => ({ type: 'target', to }))
    case 'passSecondChance':
      return legalTargets(s).map((to) => ({ type: 'passSecondChance', to }))
    case 'assign':
      return legalTargets(s).map((to) => ({ type: 'assign', cardId: p.card.id, to }))
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function apply(state: Flip7State, seat: SeatId, action: Flip7Action, rng: Rng): { state: Flip7State; events: GameEvent[] } {
  if (toAct(state) !== seat && !(opening(state) && action.type === 'nextRound' && seat === state.order[0])) {
    throw new IllegalActionError(`"${seat}" is not to act`)
  }
  const ctx: Ctx = { s: clone(state), events: [], rng }
  const { s } = ctx
  const p = s.pending
  const illegal = () => new IllegalActionError(`${action.type} is not legal now`)
  if (!p) {
    if (action.type !== 'nextRound') throw illegal()
    startRound(ctx)
    return { state: s, events: ctx.events }
  }
  const targets = legalTargets(s)
  const checkTarget = (to: SeatId) => {
    if (!targets.includes(to)) throw new IllegalActionError(`"${to}" is not a legal target`)
  }
  switch (action.type) {
    case 'hit':
      if (p.kind !== 'hitOrStay') throw illegal()
      s.pending = null
      s.stack.push({ t: 'draw', seat, source: 'hit' })
      break
    case 'stay': {
      if (p.kind !== 'hitOrStay') throw illegal()
      const r = seatRound(s, seat)
      if (!hasAnyCard(r.line)) throw new IllegalActionError('stay needs a card in front of you')
      s.pending = null
      r.status = 'stayed'
      emit(ctx, { type: 'Stayed', seat, banked: roundValue(r) })
      break
    }
    case 'target':
      if (p.kind !== 'target') throw illegal()
      checkTarget(action.to)
      s.pending = null
      emit(ctx, { type: 'ActionTargeted', seat, to: action.to, card: p.card })
      s.stack.push({ t: 'resolve', card: p.card, from: seat, to: action.to })
      break
    case 'passSecondChance':
      if (p.kind !== 'passSecondChance') throw illegal()
      checkTarget(action.to)
      s.pending = null
      passSecondChance(ctx, seat, action.to, p.card)
      break
    case 'assign': {
      if (p.kind !== 'assign') throw illegal()
      if (action.cardId !== p.card.id) throw new IllegalActionError('assign the set-aside cards in flip order')
      checkTarget(action.to)
      const task = s.stack.pop()
      if (task?.t !== 'assign') throw new Error('assign decision without its task')
      s.pending = null
      emit(ctx, { type: 'ActionTargeted', seat, to: action.to, card: p.card })
      s.stack.push({ ...task, cards: task.cards.slice(1), assigned: [...task.assigned, { card: p.card, to: action.to }] })
      break
    }
    default:
      throw illegal()
  }
  run(ctx)
  return { state: s, events: ctx.events }
}

function setup(config: Flip7Config, seats: Seat[], rng: Rng): Flip7State {
  const order = seats.map((seat) => seat.id)
  const draw = buildShoe(flip7Deck, 1, rng)
  const rig = config.rig ? parseRig(config.rig) : null
  const rigTotals = rig ? totalsForSeats(rig, seats) : {}
  const totals = Object.fromEntries(order.map((id) => [id, rigTotals[id] ?? 0]))
  return {
    config,
    order,
    totals,
    round: 0,
    // The last seat deals, so the first card goes to order[0].
    dealer: order[order.length - 1] as SeatId,
    stage: 'ready',
    draw,
    discard: [],
    rounds: Object.fromEntries(order.map((id) => [id, freshRound()])),
    stack: [],
    pending: null,
    lastScores: null,
    winner: null,
    tiebreak: false,
    rig: rig ? rigForSeats(rig, seats) : {},
  }
}

function limbo(s: Flip7State): Flip7Face[] {
  const cards: F7Card[] = []
  for (const task of s.stack) {
    if (task.t === 'flip3') cards.push(task.card, ...task.setAside)
    else if (task.t === 'assign') cards.push(...task.cards, ...task.assigned.map((a) => a.card))
    else if (task.t === 'resolve') cards.push(task.card)
  }
  const p: Pending | null = s.pending
  if (p && (p.kind === 'target' || p.kind === 'passSecondChance')) cards.push(p.card)
  return cards.map((c) => c.face)
}

function view(s: Flip7State, me: SeatId): Flip7View {
  const frame = [...s.stack].reverse().find((t) => t.t === 'flip3')
  const tray = [...s.stack].reverse().find((t) => t.t === 'flip3' || t.t === 'assign')
  return {
    me,
    order: s.order,
    seats: Object.fromEntries(
      s.order.map((id) => {
        const r = seatRound(s, id)
        return [id, { id, status: r.status, line: r.line, flip7: r.flip7, roundValue: roundValue(r), total: s.totals[id] ?? 0 }]
      }),
    ),
    dealer: s.dealer,
    round: s.round,
    stage: s.stage,
    drawCount: s.draw.length,
    discard: s.discard.map((c) => c.face),
    limbo: limbo(s),
    flipThree: frame?.t === 'flip3' ? { seat: frame.seat, remaining: frame.remaining, setAside: frame.setAside } : null,
    setAside: tray?.t === 'flip3' ? tray.setAside : tray?.t === 'assign' ? tray.cards : [],
    pending: s.pending,
    legalTargets: legalTargets(s),
    lastScores: s.lastScores,
    winner: s.winner,
    tiebreak: s.tiebreak,
    targetScore: TARGET_SCORE,
  }
}

export const flip7: GameDefinition<Flip7Config, Flip7State, Flip7Action, Flip7View, Flip7Face> = {
  id: 'flip7',
  name: 'Flip 7',
  version: 2,
  deck: flip7Deck,
  seats: { min: 2, max: 4 },
  house: [],
  defaultConfig,
  parseConfig,
  setup,
  toAct,
  opening,
  legalActions,
  apply,
  view,
  phase: (s) => (s.stage === 'roundOver' ? 'settling' : s.stage === 'gameOver' ? 'over' : 'playing'),
  settle: (s) => s.order.map((seat) => ({ seat, delta: 0 })),
}

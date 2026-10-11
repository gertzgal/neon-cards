import type { SeatId } from '@neon-cards/engine'
import { DECK_COUNTS, FLIP7_BONUS, UNIQUE_TO_FLIP7 } from '../cards'
import type { Flip7Action, Flip7Face, Flip7View, Line, SeatView } from '../types'

/**
 * Card counting over the 22 distinct face kinds. A pile is a `Counts` array indexed by kind:
 * 0..12 are the numbers, 13..17 are +2..+10, then x2, Freeze, Flip Three, Second Chance.
 */
export type Counts = number[]

export const KIND_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '+2', '+4', '+6', '+8', '+10', 'x2', 'F', 'T', 'S'] as const
const KINDS = KIND_KEYS.length
const FIRST_PLUS = 13
const X2 = 18
const SECOND_CHANCE = 21
const plusValue = (kind: number) => (kind - FIRST_PLUS + 1) * 2

export function kindOf(face: Flip7Face): number {
  if (face.kind === 'number') return face.value
  if (face.kind === 'modifier') return face.op === 'times' ? X2 : FIRST_PLUS + face.value / 2 - 1
  return face.action === 'freeze' ? 19 : face.action === 'flipThree' ? 20 : SECOND_CHANCE
}

export const FULL_DECK: readonly number[] = KIND_KEYS.map((key) => DECK_COUNTS[key] ?? 0)

export const pileSize = (d: Counts): number => d.reduce((a, b) => a + b, 0)

function lineFaces(line: Line): Flip7Face[] {
  const faces = [...line.numbers, ...line.modifiers].map((c) => c.face)
  if (line.secondChance) faces.push(line.secondChance.face)
  if (line.freeze) faces.push(line.freeze.face)
  return faces
}

const tableFaces = (view: Flip7View): Flip7Face[] => view.order.flatMap((id) => lineFaces(seat(view, id).line))

function countOf(faces: Flip7Face[]): Counts {
  const d = new Array<number>(KINDS).fill(0)
  for (const f of faces) {
    const k = kindOf(f)
    d[k] = (d[k] ?? 0) + 1
  }
  return d
}

function minus(base: readonly number[], faces: Flip7Face[]): Counts {
  const d = [...base]
  for (const f of faces) {
    const k = kindOf(f)
    d[k] = (d[k] ?? 0) - 1
  }
  return d.map((n) => Math.max(0, n))
}

/** The exact draw-pile multiset (§8.1). An empty pile reshuffles the discards before the next draw. */
export function drawPile(view: Flip7View): Counts {
  if (view.drawCount === 0) return countOf(view.discard)
  return minus(FULL_DECK, [...view.discard, ...view.limbo, ...tableFaces(view)])
}

/** Medium's estimate: every card not on the table counts as unseen, discards included (§8.2). */
export const visiblePile = (view: Flip7View): Counts => minus(FULL_DECK, tableFaces(view))

/** The scoring shape of a line: the number bitmask, its size and sum, x2, the + sum, and a held Second Chance. */
export interface LineState {
  mask: number
  count: number
  sum: number
  x2: boolean
  plus: number
  sc: boolean
}

export function lineState(line: Line): LineState {
  const st: LineState = { mask: 0, count: 0, sum: 0, x2: false, plus: 0, sc: line.secondChance !== null }
  for (const c of line.numbers) {
    if (c.face.kind !== 'number' || st.mask & (1 << c.face.value)) continue
    st.mask |= 1 << c.face.value
    st.count += 1
    st.sum += c.face.value
  }
  for (const c of line.modifiers) {
    if (c.face.kind !== 'modifier') continue
    if (c.face.op === 'times') st.x2 = true
    else st.plus += c.face.value
  }
  return st
}

/** §8.3 roundValue for a line that has not busted. */
export const valueOf = (st: LineState, flip7 = false): number => st.sum * (st.x2 ? 2 : 1) + st.plus + (flip7 ? FLIP7_BONUS : 0)

const withNumber = (st: LineState, v: number): LineState => ({ ...st, mask: st.mask | (1 << v), count: st.count + 1, sum: st.sum + v })

/** The line after drawing a non-number kind. Freeze and Flip Three are neutral for the drawer. */
function withOther(st: LineState, kind: number): LineState {
  if (kind < X2) return { ...st, plus: st.plus + plusValue(kind) }
  if (kind === X2) return st.x2 ? st : { ...st, x2: true }
  if (kind === SECOND_CHANCE) return st.sc ? st : { ...st, sc: true }
  return st
}

/** Chance the next draw busts this line (§8.2). */
export function pBust(st: LineState, d: Counts): number {
  const n = pileSize(d)
  if (st.sc || n === 0) return 0
  let dup = 0
  for (let v = 0; v <= 12; v++) if (st.mask & (1 << v)) dup += d[v] ?? 0
  return dup / n
}

export interface FlipOutcome {
  /** Chance the line busts within the draws. */
  bust: number
  /** Chance it reaches Flip 7 within the draws. */
  flip7: number
  /** Expected round value afterwards (0 for a bust, +15 for a Flip 7). */
  value: number
}

/**
 * Enumerates up to `k` forced draws (a Flip Three) over the exact pile, mutating `d` in place and
 * restoring it. At most 22³ paths.
 */
function flips(k: number, st: LineState, d: Counts, n: number): FlipOutcome {
  if (k === 0 || n === 0) return { bust: 0, flip7: 0, value: valueOf(st) }
  let bust = 0
  let flip7 = 0
  let value = 0
  for (let kind = 0; kind < KINDS; kind++) {
    const c = d[kind] ?? 0
    if (c === 0) continue
    const q = c / n
    let sub: FlipOutcome
    d[kind] = c - 1
    if (kind <= 12) {
      if (st.mask & (1 << kind)) sub = st.sc ? flips(k - 1, { ...st, sc: false }, d, n - 1) : { bust: 1, flip7: 0, value: 0 }
      else if (st.count + 1 === UNIQUE_TO_FLIP7) sub = { bust: 0, flip7: 1, value: valueOf(withNumber(st, kind), true) }
      else sub = flips(k - 1, withNumber(st, kind), d, n - 1)
    } else {
      sub = flips(k - 1, withOther(st, kind), d, n - 1)
    }
    d[kind] = c
    bust += q * sub.bust
    flip7 += q * sub.flip7
    value += q * sub.value
  }
  return { bust, flip7, value }
}

export const flipWithin = (k: number, st: LineState, d: Counts): FlipOutcome => flips(k, st, [...d], pileSize(d))
export const pBustWithin = (k: number, st: LineState, d: Counts): number => flipWithin(k, st, d).bust
export const pFlip7Within = (k: number, st: LineState, d: Counts): number => flipWithin(k, st, d).flip7

/**
 * Hard's expectimax (§8.6): the expected value of hitting now and then playing on optimally for up to
 * `depth` draws in total. Memoized per call on the line's scoring shape and remaining depth, as the spec
 * allows (paths that reach the same shape share one estimate).
 */
export function hitValue(st: LineState, d: Counts, depth: number): number {
  const memo = new Map<string, number>()
  const pile = [...d]

  const best = (s: LineState, n: number, left: number): number => {
    const stay = valueOf(s)
    if (left === 0 || n === 0) return stay
    const key = `${s.mask}|${s.sc ? 1 : 0}|${s.x2 ? 1 : 0}|${s.plus}|${left}`
    const hit = memo.get(key) ?? hit$(s, n, left, key)
    return Math.max(stay, hit)
  }

  const hit$ = (s: LineState, n: number, left: number, key: string | null): number => {
    let hit = 0
    for (let kind = 0; kind < KINDS; kind++) {
      const c = pile[kind] ?? 0
      if (c === 0) continue
      const q = c / n
      pile[kind] = c - 1
      let v: number
      if (kind <= 12) {
        if (s.mask & (1 << kind)) v = s.sc ? best({ ...s, sc: false }, n - 1, left - 1) : 0
        else if (s.count + 1 === UNIQUE_TO_FLIP7) v = valueOf(withNumber(s, kind), true)
        else v = best(withNumber(s, kind), n - 1, left - 1)
      } else {
        v = best(withOther(s, kind), n - 1, left - 1)
      }
      pile[kind] = c
      hit += q * v
    }
    if (key !== null) memo.set(key, hit)
    return hit
  }

  const n = pileSize(pile)
  return n === 0 ? 0 : hit$(st, n, depth, null)
}

export function seat(view: Flip7View, id: SeatId): SeatView {
  const s = view.seats[id]
  if (!s) throw new Error(`no seat "${id}" in view`)
  return s
}

/** total + this round's value (0 once busted). */
export const projected = (s: SeatView): number => s.total + s.roundValue

export const isLocked = (s: SeatView): boolean => s.status !== 'active'

export const opponents = (view: Flip7View): SeatView[] => view.order.filter((id) => id !== view.me).map((id) => seat(view, id))

/** The seats a target / pass / assign action may pick, read off `legal`. */
export const targetsOf = (legal: Flip7Action[]): SeatId[] => legal.flatMap((a) => ('to' in a ? [a.to] : []))

/** The element of `legal` that picks `to` (falls back to the first legal action). */
export const pickTarget = (legal: Flip7Action[], to: SeatId | undefined): Flip7Action =>
  legal.find((a) => 'to' in a && a.to === to) ?? (legal[0] as Flip7Action)

export const pickType = (legal: Flip7Action[], type: 'hit' | 'stay'): Flip7Action =>
  legal.find((a) => a.type === type) ?? (legal[0] as Flip7Action)

/** First element maximizing `score`. */
export function argmax<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let best: T | undefined
  let bestScore = -Infinity
  for (const item of items) {
    const s = score(item)
    if (s > bestScore) {
      best = item
      bestScore = s
    }
  }
  return best
}

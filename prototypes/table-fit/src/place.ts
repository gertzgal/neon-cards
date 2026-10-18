/**
 * Table fit. Viewport and chrome in, frames out.
 *
 * A game passes which rows exist and how many items each row holds.
 * It does not pass a card scale, a gap, a fan, or a scroll target.
 * The floor below is one global rule. A row that cannot hold its items at
 * that floor wraps. Buttons and the score stay shorter than card items.
 * Every returned frame lies inside the viewport.
 */

export type Viewport = { width: number; height: number }

/** Shell bands already reserved, in CSS pixels. Not card sizes. */
export type Chrome = { top: number; bottom: number }

export type RowRole = 'hand' | 'slots' | 'opponents' | 'buttons' | 'score'

export type FitRow = {
  id: string
  count: number
  role: RowRole
}

export type Frame = {
  id: string
  rowId: string
  x: number
  y: number
  w: number
  h: number
}

export type Placement = {
  frames: Frame[]
}

/**
 * Smallest side of a placed item, in CSS pixels.
 * Not a caller input. HUD chrome is not an item.
 */
export const MIN_ITEM = 32

/** Width / height. Hands and opponent rows share one card shape. */
const SHAPE: Record<RowRole, number> = {
  hand: 5 / 7,
  opponents: 5 / 7,
  slots: 1,
  buttons: 2,
  score: 4,
}

const CARD_ROLE: ReadonlySet<RowRole> = new Set(['hand', 'opponents', 'slots'])

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function isCard(role: RowRole): boolean {
  return CARD_ROLE.has(role)
}

/** Smallest box that keeps the role's shape and both sides at the floor. */
function floorBox(role: RowRole): { w: number; h: number } {
  const aspect = SHAPE[role]
  const w = Math.max(MIN_ITEM, Math.ceil(MIN_ITEM * aspect))
  const h = Math.max(MIN_ITEM, Math.ceil(w / aspect))
  return { w, h }
}

/**
 * Even split across the fewest lines that keep every item at least MIN_ITEM wide.
 * The first lines are the longer ones.
 */
function lineCounts(count: number, width: number): number[] {
  if (count < 1 || width < 1) return []
  const maxPer = Math.max(1, Math.floor(width / MIN_ITEM))
  const lines = Math.ceil(count / maxPer)
  const base = Math.floor(count / lines)
  const extra = count % lines
  return Array.from({ length: lines }, (_, index) => base + (index < extra ? 1 : 0))
}

function cardSize(role: RowRole, fullest: number, width: number): { w: number; h: number } {
  const aspect = SHAPE[role]
  const floor = floorBox(role)
  const share = Math.floor(width / fullest)
  if (share < MIN_ITEM) return { w: 0, h: 0 }
  let w = share
  let h = Math.floor(w / aspect)
  if (h < floor.h) {
    h = floor.h
    w = Math.min(share, Math.max(floor.w, Math.floor(h * aspect)))
  }
  if (w < floor.w) w = Math.min(share, floor.w)
  if (w < MIN_ITEM || h < MIN_ITEM) return { w: 0, h: 0 }
  return { w, h }
}

function controlSize(fullest: number, width: number, cap: number, aspect: number): { w: number; h: number } {
  const share = Math.floor(width / fullest)
  if (share < MIN_ITEM) return { w: 0, h: 0 }
  const floorW = Math.max(MIN_ITEM, Math.ceil(MIN_ITEM * aspect))
  let h = Math.min(cap, Math.max(MIN_ITEM, Math.floor(share / aspect)))
  let w = Math.min(share, Math.floor(h * aspect))
  if (w < floorW && floorW <= share && MIN_ITEM <= cap) {
    w = floorW
    h = MIN_ITEM
  }
  if (w < MIN_ITEM || h < MIN_ITEM || w > share) return { w: 0, h: 0 }
  return { w, h }
}

type RowPlan = {
  row: FitRow
  counts: number[]
  w: number
  h: number
}

function fullestOf(counts: readonly number[]): number {
  return counts.reduce((max, count) => Math.max(max, count), 0)
}

function planRow(row: FitRow, width: number, cap: number): RowPlan | null {
  const count = Math.max(0, Math.floor(finite(row.count)))
  const counts = lineCounts(count, width)
  const fullest = fullestOf(counts)
  if (fullest < 1) return null
  const size = isCard(row.role) ? cardSize(row.role, fullest, width) : controlSize(fullest, width, cap, SHAPE[row.role])
  if (size.w < 1 || size.h < 1) return null
  return { row, counts, w: size.w, h: size.h }
}

function stackHeight(plans: readonly RowPlan[]): number {
  return plans.reduce((sum, plan) => sum + plan.counts.length * plan.h, 0)
}

function shortestCardHeight(plans: readonly RowPlan[]): number | null {
  let shortest: number | null = null
  for (const plan of plans) {
    if (!isCard(plan.row.role) || plan.h < 1) continue
    shortest = shortest === null ? plan.h : Math.min(shortest, plan.h)
  }
  return shortest
}

/** Half the shortest card item, and never under the floor. No card row means the floor itself. */
function controlCap(plans: readonly RowPlan[]): number {
  const shortest = shortestCardHeight(plans)
  if (shortest === null) return MIN_ITEM
  return Math.max(MIN_ITEM, Math.floor(shortest / 2))
}

/**
 * Cards take their width. Buttons and the score are then at most half the
 * shortest card item, and never under the floor. When that stack is taller
 * than the viewport, card widths step down toward the floor. They do not
 * cross it.
 */
function fitPlans(rows: readonly FitRow[], width: number, height: number): RowPlan[] {
  const limits = new Map<string, number>()
  for (const row of rows) {
    if (!isCard(row.role)) continue
    const fullest = fullestOf(lineCounts(Math.max(0, Math.floor(finite(row.count))), width))
    if (fullest < 1) continue
    limits.set(row.id, Math.floor(width / fullest))
  }

  const build = (): RowPlan[] => {
    const cards: RowPlan[] = []
    for (const row of rows) {
      const limit = limits.get(row.id)
      if (limit === undefined) continue
      const counts = lineCounts(Math.max(0, Math.floor(finite(row.count))), width)
      const fullest = fullestOf(counts)
      if (fullest < 1) continue
      const size = cardSize(row.role, fullest, limit * fullest)
      if (size.w < 1 || size.h < 1) continue
      cards.push({ row, counts, w: size.w, h: size.h })
    }
    const cap = controlCap(cards)
    const plans: RowPlan[] = []
    for (const row of rows) {
      if (isCard(row.role)) {
        const card = cards.find((candidate) => candidate.row.id === row.id)
        if (card) plans.push(card)
        continue
      }
      const plan = planRow(row, width, cap)
      if (plan) plans.push(plan)
    }
    return plans
  }

  let plans = build()
  let guard = width
  while (stackHeight(plans) > height && guard > 0) {
    guard -= 1
    const widest = [...limits.entries()].filter((entry) => entry[1] > MIN_ITEM).sort((a, b) => b[1] - a[1])[0]
    if (!widest) break
    limits.set(widest[0], widest[1] - 1)
    plans = build()
  }
  return plans
}

function chromePair(height: number, chrome: Chrome, maxChrome: number): { top: number; bottom: number } {
  let top = Math.max(0, Math.round(finite(chrome.top)))
  let bottom = Math.max(0, Math.round(finite(chrome.bottom)))
  const cap = Math.max(0, Math.min(height, maxChrome))
  const sum = top + bottom
  if (sum > cap) {
    top = sum === 0 ? 0 : Math.floor((top * cap) / sum)
    bottom = cap - top
  }
  return { top, bottom }
}

function minimumStack(rows: readonly FitRow[], width: number): number {
  let sum = 0
  for (const row of rows) {
    const counts = lineCounts(Math.max(0, Math.floor(finite(row.count))), width)
    if (counts.length === 0) continue
    sum += counts.length * floorBox(row.role).h
  }
  return sum
}

function pushRow(frames: Frame[], plan: RowPlan, width: number, y: number): number {
  let index = 0
  for (const count of plan.counts) {
    const rowW = count * plan.w
    const x0 = Math.floor((width - rowW) / 2)
    for (let item = 0; item < count; item += 1) {
      frames.push({
        id: `${plan.row.id}-${index}`,
        rowId: plan.row.id,
        x: x0 + item * plan.w,
        y,
        w: plan.w,
        h: plan.h,
      })
      index += 1
    }
    y += plan.h
  }
  return y
}

export function placeTable(viewport: Viewport, chrome: Chrome, rows: readonly FitRow[]): Placement {
  const width = Math.floor(finite(viewport.width))
  const height = Math.floor(finite(viewport.height))
  if (width < 1 || height < 1) throw new Error('viewport must be positive')

  const natural = fitPlans(rows, width, Number.POSITIVE_INFINITY)
  const naturalNeed = stackHeight(natural)
  const minNeed = minimumStack(rows, width)
  const asked =
    Math.max(0, Math.round(finite(chrome.top))) + Math.max(0, Math.round(finite(chrome.bottom)))

  const placed = ((): { top: number; bottom: number; fitted: RowPlan[] } => {
    if (naturalNeed + asked <= height) {
      const pair = chromePair(height, chrome, asked)
      return { top: pair.top, bottom: pair.bottom, fitted: natural }
    }
    if (minNeed + asked <= height) {
      const pair = chromePair(height, chrome, asked)
      return {
        top: pair.top,
        bottom: pair.bottom,
        fitted: fitPlans(rows, width, height - pair.top - pair.bottom),
      }
    }
    if (naturalNeed <= height) {
      const pair = chromePair(height, chrome, height - naturalNeed)
      return { top: pair.top, bottom: pair.bottom, fitted: natural }
    }
    const pair = chromePair(height, chrome, Math.max(0, height - minNeed))
    return {
      top: pair.top,
      bottom: pair.bottom,
      fitted: fitPlans(rows, width, Math.max(0, height - pair.top - pair.bottom)),
    }
  })()
  const { top, bottom, fitted } = placed

  const need = stackHeight(fitted)
  const frames: Frame[] = []

  if (top >= 1) {
    frames.push({ id: 'hud-chip', rowId: 'hud', x: 0, y: 0, w: width, h: top })
  }

  const bodyBottom = height - bottom
  let y = top
  if (need < bodyBottom - top) y = bodyBottom - need
  for (const plan of fitted) {
    const next = y + plan.counts.length * plan.h
    if (next > bodyBottom) break
    y = pushRow(frames, plan, width, y)
  }

  return { frames }
}

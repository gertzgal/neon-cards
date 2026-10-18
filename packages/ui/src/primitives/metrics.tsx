import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { CardSize } from '../api'
import { phoneMaxWidth } from '../theme/tokens'

export interface Size {
  w: number
  h: number
}

export interface TableMetrics {
  width: number
  height: number
  phone: boolean
  card: Record<CardSize, Size>
  /** Height of the felt arc that holds the controls. */
  feltHeight: number
}

const cardAspect = 0.74

/** Card and felt sizes for a viewport, following the prototype's sizing. */
export function tableMetrics(width: number, height: number): TableMetrics {
  const phone = width <= phoneMaxWidth
  const hand = Math.max(140, Math.min(height * 0.27, width * 0.52, 270))
  const tray = hand * (phone ? 0.55 : 0.62)
  const compact = phone ? Math.max(48, Math.min(height * 0.068, 60)) : Math.max(60, Math.min(height * 0.11, 96))
  const size = (h: number): Size => ({ w: Math.round(h * cardAspect), h: Math.round(h) })
  return {
    width,
    height,
    phone,
    card: { hand: size(hand), tray: size(tray), compact: size(compact) },
    feltHeight: phone ? 178 : 142,
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

let cached: TableMetrics | null = null
function snapshot(): TableMetrics {
  const { innerWidth: w, innerHeight: h } = window
  if (!cached || cached.width !== w || cached.height !== h) cached = tableMetrics(w, h)
  return cached
}

const serverMetrics = tableMetrics(390, 844)

const MetricsContext = createContext<TableMetrics | null>(null)

const minCardScale = 0.6

/**
 * Shrink the solo card sizes until a Flip 7 column fits the viewport.
 * Phone seats stack, so each opponent costs a row. Desktop seats sit in one row.
 * The felt overlaps the hand by 20%, which the budget gives back.
 * A phone name is at least 46px beside the card, so a tiny card does not shrink the row further.
 * A room keeps the solo pile and seat cards. The hand takes the shrink. A desktop room hand is 70% of solo,
 * and a short desktop (1280x800) shrinks further so the Hit and Stand buttons stay on screen.
 */
export function fitTable(
  base: TableMetrics,
  input: { opponents: number; hudHeight: number; room?: boolean },
): TableMetrics {
  const phone = base.phone
  const rows = phone ? input.opponents : input.opponents > 0 ? 1 : 0
  const pileLabel = 22
  const gaps = 12
  const bottomChrome = phone ? 72 : 108
  const handH = base.card.hand.h
  const compactH = base.card.compact.h
  const nameBlock = 46
  const seatPad = 16
  const desktopChrome = 84
  const sized = (box: Size, scale: number): Size => ({ w: Math.round(box.w * scale), h: Math.round(box.h * scale) })

  const solve = (felt: number): number => {
    const overlap = 0.2 * handH
    const fixed = input.hudHeight + felt + pileLabel + bottomChrome + gaps
    if (phone) {
      const beside = rows * compactH + compactH + handH
      const budget = base.height - fixed - rows * seatPad
      const scale = budget / (beside - overlap)
      if (scale * compactH >= nameBlock) return scale
      const locked = base.height - fixed - rows * (nameBlock + seatPad)
      return locked / (compactH + handH - overlap)
    }
    const units = (rows > 0 ? compactH : 0) + compactH + handH
    const budget = base.height - fixed - rows * desktopChrome
    return budget / (units - overlap)
  }

  let felt = base.feltHeight
  let scale = solve(felt)
  if (phone && scale < minCardScale) {
    felt = 132
    scale = solve(felt)
  }

  if (input.room && !phone) {
    // 1440x900 holds a 70% hand. 1280x800 does not: the buttons end past the fold.
    // The felt covers the bottom 20% of the hand, so this scale is what lifts them back on screen.
    const handScale = base.height <= 800 ? 0.5 : 0.7
    return { ...base, card: { ...base.card, hand: sized(base.card.hand, handScale) } }
  }

  if (input.room && phone && scale < 1) {
    const handRoom = (feltH: number) => {
      const fixed = input.hudHeight + feltH + pileLabel + bottomChrome + gaps
      const seatRow = Math.max(nameBlock, compactH) + seatPad
      return (base.height - fixed - rows * seatRow - compactH) / 0.8
    }
    felt = 132
    const handScale = Math.min(1, handRoom(felt) / handH)
    return {
      ...base,
      feltHeight: felt,
      card: { hand: sized(base.card.hand, handScale), tray: sized(base.card.tray, handScale), compact: base.card.compact },
    }
  }

  scale = Math.max(minCardScale, Math.min(1, scale))
  if (scale === 1 && felt === base.feltHeight) return base
  return {
    ...base,
    feltHeight: felt,
    card: { hand: sized(base.card.hand, scale), tray: sized(base.card.tray, scale), compact: sized(base.card.compact, scale) },
  }
}

export function MetricsScope({ metrics, children }: { metrics: TableMetrics; children: ReactNode }) {
  return <MetricsContext.Provider value={metrics}>{children}</MetricsContext.Provider>
}

export function MetricsProvider({ children }: { children: ReactNode }) {
  const metrics = useSyncExternalStore(subscribe, snapshot, () => serverMetrics)
  return <MetricsContext.Provider value={metrics}>{children}</MetricsContext.Provider>
}

/** Viewport-driven card sizes. Works inside or outside a NeonRoot. */
export function useTableMetrics(): TableMetrics {
  const fromRoot = useContext(MetricsContext)
  const own = useSyncExternalStore(subscribe, snapshot, () => serverMetrics)
  return fromRoot ?? own
}

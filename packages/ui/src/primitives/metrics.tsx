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

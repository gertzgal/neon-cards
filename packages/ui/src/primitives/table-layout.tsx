import type { CSSProperties, ReactNode } from 'react'
import type { SeatState, TableLayoutProps } from '../api'
import { useTableMetrics } from './metrics'

/**
 * One table composition from phone to desktop. The bottom zone overlaps the felt arc but lets
 * taps through, so buttons stay fully tappable under the cards.
 */
export function TableLayout({ hud, top, middle, bottom, controls }: TableLayoutProps) {
  const metrics = useTableMetrics()
  return (
    <div
      className="nc-table"
      data-testid="table"
      data-layout={metrics.phone ? 'phone' : 'desktop'}
      style={{ '--nc-felt-h': `${metrics.feltHeight}px`, '--nc-hand-h': `${metrics.card.hand.h}px` } as CSSProperties}
    >
      {hud}
      <div className="nc-zone-top" data-testid="table-top">
        {top}
      </div>
      <div className="nc-zone-middle" data-testid="table-middle">
        {middle}
      </div>
      <div className="nc-zone-bottom" data-testid="table-bottom">
        {bottom}
      </div>
      <div className="nc-felt">
        <div className="nc-controls" data-testid="table-controls">
          {controls}
        </div>
      </div>
    </div>
  )
}

export interface PlayerSpotProps {
  children: ReactNode
  /** The total badge, kept to the right of the hand with a matching spacer on the left so the hand stays centered. */
  badge?: ReactNode
  state?: SeatState
  testId?: string
}

/** The human's hand group on the felt: hand plus total badge, with the shared active glow and result states. */
export function PlayerSpot({ children, badge, state, testId = 'player-spot' }: PlayerSpotProps) {
  return (
    <div className="nc-player" data-testid={testId} data-state={state}>
      {badge && <div className="nc-badge-spacer" aria-hidden />}
      {children}
      {badge}
    </div>
  )
}

/** Lays several of the human's hands side by side (blackjack splits); dims the hands that are not active. */
export function PlayerRow({ children }: { children: ReactNode }) {
  return <div className="nc-player-row">{children}</div>
}

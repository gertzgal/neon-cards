import type { CSSProperties } from 'react'
import type { DealerTrayProps } from '../api'
import { ScoreBadge } from './badge'
import { Hand } from './hand'
import { useTableMetrics } from './metrics'

/** The house's cards in the cyan tray, with the total badge to the right. */
export function DealerTray<Face>({ cards, renderer, total, state, placeholder }: DealerTrayProps<Face>) {
  const { card } = useTableMetrics()
  const empty = cards.length === 0
  return (
    <div
      className="nc-dealer"
      data-testid="dealer-tray"
      data-state={state}
      data-empty={empty ? 'true' : undefined}
      style={{ '--nc-tray-w': `${card.tray.w}px`, '--nc-tray-h': `${card.tray.h}px` } as CSSProperties}
    >
      <div className="nc-badge-spacer" aria-hidden />
      <div className="nc-tray-wrap">
        <div className="nc-tray">
          <div className="nc-tray-in" />
          {empty && placeholder ? (
            <div className="nc-tray-placeholder">{placeholder}</div>
          ) : (
            <Hand cards={cards} renderer={renderer} size="tray" testId="dealer-hand" {...(state ? { state } : {})} />
          )}
        </div>
      </div>
      <ScoreBadge value={total ?? null} tone="cyan" testId="dealer-total" {...(state ? { state } : {})} />
    </div>
  )
}

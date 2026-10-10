import type { ReactNode } from 'react'
import { MetricsProvider } from '../primitives/metrics'
import { EdgeSwirl, type EdgeSwirlProps } from './edge-swirl'

/** Light scanlines and a soft vignette over everything. Never intercepts input. */
export function CrtOverlay() {
  return <div className="nc-crt" data-testid="crt-overlay" aria-hidden />
}

export interface NeonRootProps {
  children: ReactNode
  swirl?: EdgeSwirlProps['mode'] | 'off'
  crt?: boolean
}

/** The full-screen stage every screen sits in: edge swirl behind, CRT pass on top. */
export function NeonRoot({ children, swirl = 'auto', crt = true }: NeonRootProps) {
  return (
    <MetricsProvider>
      <div className="nc-root" data-testid="neon-root">
        {swirl !== 'off' && <EdgeSwirl mode={swirl} />}
        <div className="nc-stage" data-testid="stage">
          {children}
        </div>
        {crt && <CrtOverlay />}
      </div>
    </MetricsProvider>
  )
}

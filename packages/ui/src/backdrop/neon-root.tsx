import { useId, type ReactNode } from 'react'
import type { SfxName } from '../api'
import { getAudio } from '../audio/manager'
import { JuiceProvider } from '../juice/provider'
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
  /** Where juice sound effects go. Defaults to the shared audio manager. */
  sfx?(name: SfxName): void
}

const playShared = (name: SfxName) => getAudio().play(name)

/** The full-screen stage every screen sits in: edge swirl behind, juice layer and CRT pass on top. */
export function NeonRoot({ children, swirl = 'auto', crt = true, sfx = playShared }: NeonRootProps) {
  const root = useId()
  return (
    <MetricsProvider>
      <JuiceProvider root={root} sfx={sfx}>
        <div className="nc-root" data-testid="neon-root" data-nc-root={root}>
          {swirl !== 'off' && <EdgeSwirl mode={swirl} />}
          <div className="nc-stage" data-testid="stage">
            {children}
          </div>
          <div className="nc-fx" data-testid="fx-layer" aria-hidden />
          {crt && <CrtOverlay />}
        </div>
      </JuiceProvider>
    </MetricsProvider>
  )
}

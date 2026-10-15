import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { HudProps } from '../api'
import { durations } from '../theme/tokens'
import { formatMoney } from './chips'
import { GearIcon, SoundIcon } from './icons'
import { prefersReducedMotion } from './motion'

/** Tweens a displayed number toward `value` so bankroll changes read as a count. */
export function useCountUp(value: number, ms: number = durations.bankrollCount): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value) return
    const dur = prefersReducedMotion() ? 0 : ms
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = dur > 0 ? Math.min(1, (t - t0) / dur) : 1
      const next = Math.round(start + (value - start) * k)
      from.current = next
      setShown(next)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

export interface IconButtonProps {
  label: string
  onClick(): void
  children: ReactNode
  testId?: string
  pressed?: boolean
}

export function IconButton({ label, onClick, children, testId, pressed }: IconButtonProps) {
  return (
    <button type="button" className="nc-icon-btn" aria-label={label} aria-pressed={pressed} data-testid={testId} onClick={onClick}>
      {children}
    </button>
  )
}

function Bankroll({ value }: { value: number }) {
  const shown = useCountUp(value)
  return (
    <div className="nc-pill nc-bankroll" data-testid="hud-bankroll" data-value={value}>
      {formatMoney(shown)}
    </div>
  )
}

/** The top bar: score on the left, room chips on the next row, icons on the right. */
export function Hud({ bankroll, left, center, right, sound, onSettings }: HudProps) {
  const icons = right || sound || onSettings
  return (
    <div className="nc-hud" data-testid="hud">
      <div className="nc-hud-left">
        {bankroll !== null && bankroll !== undefined && <Bankroll value={bankroll} />}
        {left}
      </div>
      {center && (
        <div className="nc-hud-center" data-testid="hud-center">
          {center}
        </div>
      )}
      {icons && (
        <div className="nc-pill nc-icons">
          {right}
          {sound && (
            <IconButton label={sound.on ? 'Mute' : 'Unmute'} pressed={!sound.on} testId="hud-sound" onClick={sound.toggle}>
              <SoundIcon on={sound.on} />
            </IconButton>
          )}
          {onSettings && (
            <IconButton label="Settings" testId="hud-settings" onClick={onSettings}>
              <GearIcon />
            </IconButton>
          )}
        </div>
      )}
    </div>
  )
}

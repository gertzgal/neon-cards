import type { ReactNode } from 'react'
import type { ScoreBadgeProps } from '../api'
import type { Tone } from '../theme/tokens'

/** The boxed total next to a hand. Empty values keep their space but fade out. */
export function ScoreBadge({ value, tone = 'pink', state, size = 'md', testId }: ScoreBadgeProps) {
  const text = value === null || value === undefined ? '' : String(value)
  return (
    <div
      className={`nc-badge nc-badge-${size}`}
      data-tone={tone}
      data-state={state}
      data-testid={testId}
      data-empty={text === '' ? 'true' : undefined}
    >
      {text}
    </div>
  )
}

export interface StatusBadgeProps {
  children: ReactNode
  tone?: Tone
  testId?: string
}

/** The round's status word in the middle zone, e.g. "YOUR TURN" or "DEALER PLAYS". */
export function StatusBadge({ children, tone = 'cyan', testId = 'status-badge' }: StatusBadgeProps) {
  return (
    <div className="nc-status" data-tone={tone} data-testid={testId}>
      {children}
    </div>
  )
}

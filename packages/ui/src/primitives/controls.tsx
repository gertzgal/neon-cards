import type { CSSProperties, ReactNode } from 'react'
import type { ActionBarProps, BetControlsProps, SegmentedControlProps } from '../api'
import { ChipRack } from './chips'
import { useTableMetrics } from './metrics'
import { CloseIcon } from './icons'

export interface NeonButtonProps {
  children: ReactNode
  onClick?(): void
  primary?: boolean
  tone?: 'pink' | 'cyan'
  disabled?: boolean
  testId?: string
  ariaLabel?: string
  style?: CSSProperties
}

export function NeonButton({ children, onClick, primary, tone = 'pink', disabled, testId, ariaLabel, style }: NeonButtonProps) {
  return (
    <button
      type="button"
      className={`nc-btn${primary ? ' nc-btn-main' : ''}`}
      data-tone={tone}
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled ?? false}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  )
}

/** Thumb-sized action buttons. Two columns on phone, one row on desktop, unless `columns` says otherwise. */
export function ActionBar({ actions, onAction, columns }: ActionBarProps) {
  const { phone } = useTableMetrics()
  const cols = phone ? (columns?.phone ?? 2) : (columns?.desktop ?? actions.length)
  return (
    <div className="nc-actions" data-testid="action-bar" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {actions.map((a) => (
        <NeonButton
          key={a.id}
          testId={`action-${a.id}`}
          onClick={() => onAction(a.id)}
          {...(a.primary ? { primary: a.primary } : {})}
          {...(a.tone ? { tone: a.tone } : {})}
          {...(a.disabled ? { disabled: a.disabled } : {})}
          {...(a.ariaLabel ? { ariaLabel: a.ariaLabel } : {})}
          {...(phone && a.span ? { style: { gridColumn: `span ${a.span}` } } : {})}
        >
          {a.label}
        </NeonButton>
      ))}
    </div>
  )
}

/** Betting controls: chips over [clear | deal] on phone, one row on desktop (as in the prototype). */
export function BetControls({ values, onPick, isDisabled, onClear, onDeal, canClear, canDeal, dealLabel = 'DEAL' }: BetControlsProps) {
  const { phone } = useTableMetrics()
  return (
    <div className="nc-bet" data-testid="bet-controls" data-layout={phone ? 'phone' : 'desktop'}>
      {!phone && (
        <NeonButton tone="cyan" testId="action-clear" ariaLabel="Clear bet" disabled={!canClear} onClick={onClear}>
          <CloseIcon />
        </NeonButton>
      )}
      <ChipRack onPick={onPick} {...(values ? { values } : {})} {...(isDisabled ? { isDisabled } : {})} />
      {phone && (
        <NeonButton tone="cyan" testId="action-clear" ariaLabel="Clear bet" disabled={!canClear} onClick={onClear}>
          <CloseIcon />
        </NeonButton>
      )}
      <NeonButton primary testId="action-deal" disabled={!canDeal} onClick={onDeal} style={phone ? { gridColumn: 'span 3' } : {}}>
        {dealLabel}
      </NeonButton>
    </div>
  )
}

/** Segmented pixel buttons for a choice list, as the pre-game settings sheet renders `meta.settings`. */
export function SegmentedControl<V extends string | number>({ label, options, value, onChange, testId }: SegmentedControlProps<V>) {
  return (
    <div className="nc-segmented" role="radiogroup" aria-label={label} data-testid={testId}>
      <div className="nc-segmented-label">{label}</div>
      <div className="nc-segmented-row">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className="nc-segment"
            data-testid={testId ? `${testId}-${o.value}` : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

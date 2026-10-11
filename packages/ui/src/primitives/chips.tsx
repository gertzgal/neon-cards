import type { CSSProperties } from 'react'
import type { ChipProps, ChipRackProps, ChipStackProps } from '../api'
import { chipColor, chipValues, type ChipValue } from '../theme/tokens'

function shade(hex: string): string {
  if (hex === '#f4f0ff') return '#9a94b0'
  const n = parseInt(hex.slice(1), 16)
  return `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) * 0.6).toString(16).padStart(2, '0')).join('')}`
}

const markupCache = new Map<ChipValue, string>()

/** A chunky pixel coin (20x15 grid): striped neon rim, dark center, three-pixel edge below. */
export function chipSvgMarkup(value: ChipValue): string {
  const cached = markupCache.get(value)
  if (cached) return cached
  const col = chipColor[value]
  const cx = 9.5
  const cy = 5.5
  const rx = 9.6
  const ry = 5.6
  let rects = ''
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 20; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      let fill: string | null = null
      if (d <= 1) {
        if (d > 0.74) {
          const a = Math.atan2((y - cy) / ry, (x - cx) / rx)
          fill = Math.floor((a + Math.PI) / (Math.PI / 5)) % 2 ? col : '#f4f0ff'
        } else fill = d > 0.62 ? '#000' : '#17121f'
      } else {
        for (let s = 1; s <= 3; s++) {
          if (Math.hypot((x - cx) / rx, (y - s - cy) / ry) <= 1) {
            fill = s === 3 ? '#000' : x % 3 === 0 ? '#f4f0ff' : col
            break
          }
        }
        if (fill && fill !== '#000') fill = shade(fill)
      }
      if (fill) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  }
  const svg = `<svg viewBox="0 0 20 15" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`
  markupCache.set(value, svg)
  return svg
}

/** Markup for a whole chip (coin plus value), for the juice layer's flying chips. */
export function chipMarkup(value: ChipValue, size: 'sm' | 'md' | 'lg' = 'md'): string {
  return `<div class="nc-chip nc-chip-${size}" style="--nc-cc:${chipColor[value]}">${chipSvgMarkup(value)}<span>${value}</span></div>`
}

export function Chip({ value, size = 'md' }: ChipProps) {
  return (
    <div className={`nc-chip nc-chip-${size}`} style={{ '--nc-cc': chipColor[value] } as CSSProperties} data-value={value}>
      <i dangerouslySetInnerHTML={{ __html: chipSvgMarkup(value) }} />
      <span>{value}</span>
    </div>
  )
}

/** Splits an amount into the fewest chips, largest first. */
export function chipsFor(amount: number): ChipValue[] {
  const out: ChipValue[] = []
  let left = amount
  for (const v of [...chipValues].reverse()) {
    while (left >= v) {
      out.push(v)
      left -= v
    }
  }
  return out
}

export function formatMoney(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`
}

/** The pot or a bet. Up to five chips sit in a row; more group into one stack per value. */
export function ChipStack({ chips, amount, testId = 'pot' }: ChipStackProps) {
  const sorted = [...chips].sort((a, b) => b - a)
  const groups = [...chipValues].reverse().flatMap((v) => {
    const n = sorted.filter((c) => c === v).length
    return n ? [{ value: v, count: n }] : []
  })
  const shown = amount === undefined ? chips.reduce<number>((a, b) => a + b, 0) : amount
  return (
    <div className="nc-pot" data-testid={testId} data-count={chips.length}>
      <div className="nc-pot-chips" data-testid={`${testId}-chips`}>
        {chips.length <= 5
          ? sorted.map((v, i) => <Chip key={i} value={v} size="lg" />)
          : groups.map((g) => (
              <div key={g.value} className="nc-stack">
                {Array.from({ length: Math.min(g.count, 8) }, (_, i) => (
                  <div key={i} className="nc-stack-chip" style={{ top: -i * 5 }}>
                    <Chip value={g.value} size="lg" />
                  </div>
                ))}
              </div>
            ))}
      </div>
      <div className="nc-pot-amount" data-testid={`${testId}-amount`}>
        {chips.length || amount ? formatMoney(shown ?? 0) : ''}
      </div>
    </div>
  )
}

export function ChipRack({ values = chipValues, onPick, isDisabled }: ChipRackProps) {
  return (
    <>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className="nc-rack-chip"
          data-testid={`chip-${v}`}
          aria-label={`Bet ${v}`}
          disabled={isDisabled?.(v) ?? false}
          onClick={(e) => onPick(v, e.currentTarget)}
        >
          <Chip value={v} size="lg" />
        </button>
      ))}
    </>
  )
}

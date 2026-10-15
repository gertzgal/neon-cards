import type { CSSProperties } from 'react'
import type { CardSize, HandProps } from '../api'
import { PlayingCard, cardAccent } from './playing-card'
import { useTableMetrics, type Size } from './metrics'

export interface SlotPlacement {
  x: number
  y: number
  rotate: number
}

/** Smallest share of each covered card that stays visible before the cards shrink instead. */
const minVisible = 0.45
/** Cards never shrink below this fraction of their size. */
const minScale = 0.6

/**
 * Where each card sits in a hand: overlap tightens to fit `maxWidth`, then cards shrink so
 * long hands (Flip 7 runs to 7+ cards) stay readable. Fans rotate and arc.
 */
/**
 * A straight side-by-side row. No fan, no arc, no rotation.
 * Cards keep a gap when they fit. A tight row overlaps slightly.
 * `scrolls` is true when that overlap still runs past `maxWidth`.
 */
export function straightRow(count: number, card: Size, maxWidth: number): { width: number; card: Size; slots: SlotPlacement[]; scrolls: boolean } {
  const gap = 8
  const natural = card.w + gap
  const minStep = card.w * 0.72
  const fit = count > 1 ? (maxWidth - card.w) / (count - 1) : 0
  const step = count <= 1 ? 0 : natural * (count - 1) + card.w <= maxWidth ? natural : Math.max(minStep, fit)
  const slots = Array.from({ length: count }, (_, i) => ({ x: i * step, y: 0, rotate: 0 }))
  const width = count ? card.w + step * Math.max(0, count - 1) : 0
  return { width, card, slots, scrolls: width > maxWidth + 0.5 }
}

export function handLayout(
  count: number,
  base: Size,
  layout: 'fan' | 'row' | 'strip',
  maxWidth: number,
  size: CardSize,
): { width: number; card: Size; slots: SlotPlacement[] } {
  const fitW = count > 1 && size !== 'compact' ? maxWidth / (1 + minVisible * (count - 1)) : base.w
  const scale = Math.max(minScale, Math.min(1, fitW / base.w))
  const card = scale === 1 ? base : { w: Math.round(base.w * scale), h: Math.round(base.h * scale) }
  const natural = layout === 'row' ? (size === 'compact' ? card.w * 0.58 : card.w + 8) : card.w * 0.86
  const step = count > 1 ? Math.max(card.w * 0.18, Math.min(natural, (maxWidth - card.w) / (count - 1))) : 0
  const mid = (count - 1) / 2
  const slots = Array.from({ length: count }, (_, i) => ({
    x: i * step,
    y: layout === 'fan' ? Math.abs(i - mid) * card.h * 0.03 : 0,
    rotate: layout === 'fan' ? (i - mid) * (count > 2 ? 5 : 8) : 0,
  }))
  return { width: count ? card.w + step * (count - 1) : 0, card, slots }
}

/** A row or fan of cards. Each card sits in a slot that the juice system animates. */
export function Hand<Face>({ cards, renderer, size = 'hand', layout, maxWidth, state, testId }: HandProps<Face>) {
  const metrics = useTableMetrics()
  const box = metrics.card[size]
  const mode = layout ?? (size === 'hand' ? 'fan' : 'row')
  const limit =
    maxWidth ??
    (size === 'hand'
      ? metrics.phone
        ? metrics.width - 120
        : Math.min(metrics.width * 0.64, 760)
      : size === 'tray'
        ? Math.min(metrics.width * 0.62, 700)
        : metrics.phone
          ? metrics.width * 0.4
          : Math.min(metrics.width * 0.2, 280))
  const strip = mode === 'strip' ? straightRow(cards.length, box, limit) : null
  const laid = strip ?? handLayout(cards.length, box, mode, limit, size)
  const { width, card: fitted, slots } = laid
  const minWidth = size === 'tray' ? box.w * 2 + 8 : 0
  const frame = Math.max(width, minWidth)
  const viewWidth = strip?.scrolls ? limit : frame
  const slotsView = cards.map((c, i) => {
    const slot = slots[i] ?? { x: 0, y: 0, rotate: 0 }
    return (
      <div
        key={c.id}
        className="nc-slot"
        data-card={c.id}
        data-face={c.face === null ? 'down' : 'up'}
        style={
          {
            width: fitted.w,
            height: fitted.h,
            zIndex: i,
            transform: strip ? `translate(${slot.x}px, 0px)` : `translate(${slot.x}px, ${slot.y}px) rotate(${slot.rotate}deg)`,
            '--nc-c': cardAccent(renderer, c.face),
          } as CSSProperties
        }
      >
        <div className="nc-fly">
          <div className={`nc-sway${size === 'compact' || strip ? ' nc-still' : ''}`}>
            <PlayingCard card={c} renderer={renderer} size={size} box={fitted} {...(state ? { state } : {})} />
          </div>
        </div>
      </div>
    )
  })
  return (
    <div
      className={`nc-hand nc-hand-${size}${strip ? ' nc-hand-strip' : ''}`}
      data-testid={testId}
      data-state={state}
      data-count={cards.length}
      data-layout={strip ? 'strip' : mode}
      style={{ width: viewWidth, height: strip ? fitted.h + 40 : fitted.h }}
    >
      {strip ? (
        <div className="nc-hand-scroll" style={{ width: viewWidth }}>
          <div className="nc-hand-row" style={{ width: frame, height: fitted.h }}>
            {slotsView}
          </div>
        </div>
      ) : (
        slotsView
      )}
    </div>
  )
}

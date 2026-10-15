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
 * Where each card sits in a fan or a flat row: overlap tightens to fit `maxWidth`, then cards shrink.
 * Fans rotate and arc.
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

/**
 * A straight row that scales down until it fits `maxWidth`.
 * No overlap, wrap, fan, rotation, or scroll. `startScale` shrinks the size token first,
 * so a one-card row can open smaller than the shared hand. `gap` stays put while the row fits
 * and while the cards can shrink around it. It only tightens once cards would drop below
 * `minCard`, or once that is the only way to stay inside.
 */
export function fittedRow(
  count: number,
  card: Size,
  maxWidth: number,
  startScale = 1,
  gap = 6,
  minCard = 1,
): { width: number; card: Size; slots: SlotPlacement[] } {
  const baseW = card.w * startScale
  const baseH = card.h * startScale
  const full = { w: Math.max(1, Math.round(baseW)), h: Math.max(1, Math.round(baseH)) }
  if (count <= 0 || maxWidth <= 0 || baseW <= 0) return { width: 0, card: full, slots: [] }
  const gaps = Math.max(0, count - 1)
  let stepGap = gaps > 0 ? gap : 0
  let w = full.w
  let h = full.h
  const rowOf = (cw: number, cg: number) => count * cw + cg * gaps
  const floor = Math.max(1, Math.min(full.w, minCard))
  if (rowOf(w, stepGap) > maxWidth) {
    if (stepGap * gaps >= maxWidth) stepGap = gaps > 0 ? Math.max(0, (maxWidth - count) / gaps) : 0
    const usable = maxWidth - stepGap * gaps
    const scale = usable > 0 ? Math.min(1, usable / (count * baseW)) : 0
    w = Math.max(1, Math.floor(baseW * Math.max(0, scale)))
    if (w < floor && gaps > 0) {
      w = floor
      stepGap = Math.max(0, (maxWidth - count * w) / gaps)
    }
    h = Math.max(1, Math.round(baseH * (w / baseW)))
    if (rowOf(w, stepGap) > maxWidth + 0.01 && gaps > 0) stepGap = Math.max(0, (maxWidth - count * w) / gaps)
    while (rowOf(w, stepGap) > maxWidth + 0.01 && w > 1) {
      w -= 1
      h = Math.max(1, Math.round(baseH * (w / baseW)))
      stepGap = gaps > 0 ? Math.max(0, (maxWidth - count * w) / gaps) : 0
    }
  }
  const advance = w + stepGap
  const slots = Array.from({ length: count }, (_, i) => ({ x: i * advance, y: 0, rotate: 0 }))
  return { width: count > 1 ? w + (count - 1) * advance : w, card: { w, h }, slots }
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
export function Hand<Face>({ cards, renderer, size = 'hand', layout, maxWidth, scale, gap, state, testId }: HandProps<Face>) {
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
  const fit = mode === 'fit' ? fittedRow(cards.length, box, limit, scale ?? 1, gap) : null
  const strip = mode === 'strip' ? straightRow(cards.length, box, limit) : null
  const straightMode = mode === 'fan' || mode === 'row' ? mode : 'row'
  const laid = fit ?? strip ?? handLayout(cards.length, box, straightMode, limit, size)
  const { width, card: fitted, slots } = laid
  const minWidth = size === 'tray' ? box.w * 2 + 8 : 0
  const frame = Math.max(width, minWidth)
  const viewWidth = strip?.scrolls ? limit : frame
  const flat = Boolean(fit || strip)
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
            transform: flat ? `translate(${slot.x}px, 0px)` : `translate(${slot.x}px, ${slot.y}px) rotate(${slot.rotate}deg)`,
            '--nc-c': cardAccent(renderer, c.face),
          } as CSSProperties
        }
      >
        <div className="nc-fly">
          <div className={`nc-sway${size === 'compact' || flat ? ' nc-still' : ''}`}>
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
      data-layout={fit ? 'fit' : strip ? 'strip' : mode}
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

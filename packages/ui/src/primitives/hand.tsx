import type { CSSProperties } from 'react'
import type { CardSize, HandProps } from '../api'
import { toneColor } from '../theme/tokens'
import { PlayingCard } from './playing-card'
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
export function handLayout(
  count: number,
  base: Size,
  layout: 'fan' | 'row',
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
  const { width, card: fitted, slots } = handLayout(cards.length, box, mode, limit, size)
  const minWidth = size === 'tray' ? box.w * 2 + 8 : 0
  return (
    <div
      className={`nc-hand nc-hand-${size}`}
      data-testid={testId}
      data-state={state}
      data-count={cards.length}
      style={{ width: Math.max(width, minWidth), height: fitted.h }}
    >
      {cards.map((c, i) => {
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
                transform: `translate(${slot.x}px, ${slot.y}px) rotate(${slot.rotate}deg)`,
                '--nc-c': toneColor[c.face === null ? 'pink' : renderer.tone(c.face)],
              } as CSSProperties
            }
          >
            <div className="nc-fly">
              <div className={`nc-sway${size === 'compact' ? ' nc-still' : ''}`}>
                <PlayingCard card={c} renderer={renderer} size={size} box={fitted} {...(state ? { state } : {})} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

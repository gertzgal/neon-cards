import { useEffect, useState } from 'react'

export interface TableSize {
  width: number
  height: number
  phone: boolean
  /** Player card height and width. */
  ph: number
  pw: number
  /** Dealer card height and width. */
  dh: number
  dw: number
}

export function measure(width: number, height: number): TableSize {
  const phone = width < 700
  const ph = Math.max(140, Math.min(height * 0.27, width * 0.52, 270))
  const dh = ph * (phone ? 0.55 : 0.62)
  return { width, height, phone, ph, pw: ph * 0.74, dh, dw: dh * 0.74 }
}

export function useTableSize(): TableSize {
  const [size, setSize] = useState(() => measure(innerWidth, innerHeight))
  useEffect(() => {
    const onResize = () => setSize(measure(innerWidth, innerHeight))
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [])
  return size
}

export interface Slot {
  x: number
  y: number
  rot: number
}

export interface HandLayout {
  w: number
  h: number
  width: number
  slots: Slot[]
}

/**
 * The widest dealer hand that keeps the dealer row on screen: the row is a badge-sized spacer, the
 * tray (hand plus its side padding), and the total badge, 16px apart. These numbers mirror
 * `.bj-dealer-row`, `.bj-tray`, and `.bj-badge-dealer` in table.css; a soft total is about 2.4em wide.
 */
export function dealerRoom(size: TableSize): number {
  const badge = size.dh * 0.26 * 2.4
  return size.width - 16 - 2 * (badge + 16) - size.dw * 0.44
}

/** Player hands fan out with a slight arc; the dealer's row lies flat with a gap between cards. */
export function layoutHand(size: TableSize, kind: 'player' | 'dealer', count: number, split: boolean): HandLayout {
  const scale = kind === 'dealer' || !split ? 1 : size.phone ? 0.62 : 0.78
  const w = (kind === 'dealer' ? size.dw : size.pw) * scale
  const h = (kind === 'dealer' ? size.dh : size.ph) * scale
  const maxW =
    kind === 'dealer'
      ? Math.max(w * 2 + 8, Math.min(size.width * 0.62, 700, dealerRoom(size)))
      : split
        ? size.phone
          ? (size.width - 48) / 2
          : Math.min(size.width * 0.36, 420)
        : Math.min(size.width * 0.64, 760)
  const natural = kind === 'dealer' ? w + 8 : w * 0.86
  const step = count > 1 ? Math.min(natural, (maxW - w) / (count - 1)) : 0
  const mid = (count - 1) / 2
  const slots = Array.from({ length: count }, (_, i) => ({
    x: i * step,
    y: kind === 'dealer' ? 0 : Math.abs(i - mid) * h * 0.03,
    rot: kind === 'dealer' ? 0 : (i - mid) * (count > 2 ? 5 : 8),
  }))
  const fanned = w + step * Math.max(0, count - 1)
  return { w, h, width: kind === 'dealer' ? Math.max(fanned, w * 2 + 8) : fanned, slots }
}

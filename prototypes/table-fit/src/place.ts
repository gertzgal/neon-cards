/**
 * Table fit. Viewport and chrome in, frames out.
 *
 * A game passes which rows exist and how many items each row holds.
 * It does not pass a card scale, a gap, a minimum card size, a fan, or a scroll target.
 * Every returned frame lies inside the viewport. Bands tile the body, items abut,
 * and a row that cannot keep a positive size emits no frame rather than drawing past the edge.
 */

export type Viewport = { width: number; height: number }

/** Shell bands already reserved, in CSS pixels. Not card sizes. */
export type Chrome = { top: number; bottom: number }

export type RowRole = 'hand' | 'slots' | 'opponents' | 'buttons' | 'score'

export type FitRow = {
  id: string
  count: number
  role: RowRole
}

export type Frame = {
  id: string
  rowId: string
  x: number
  y: number
  w: number
  h: number
}

export type Placement = {
  frames: Frame[]
}

/** Width / height. Hands and opponent rows share one card shape. */
const SHAPE: Record<RowRole, number> = {
  hand: 5 / 7,
  opponents: 5 / 7,
  slots: 1,
  buttons: 2,
  score: 4,
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function itemSize(count: number, bandW: number, bandH: number, aspect: number): { w: number; h: number } {
  if (count < 1 || bandW < 1 || bandH < 1 || aspect <= 0) return { w: 0, h: 0 }
  let w = Math.min(Math.floor(bandW / count), Math.floor(bandH * aspect))
  if (w >= 1) {
    let h = Math.floor(w / aspect)
    while (w > 1 && (h < 1 || h > bandH)) {
      w -= 1
      h = Math.floor(w / aspect)
    }
    if (h >= 1 && h <= bandH && w * count <= bandW) return { w, h }
  }
  // The card shape does not fit this band. Flatten into it. Dropping the row
  // hid an 8-card hand when chrome left each band 1px tall.
  const flatW = Math.floor(bandW / count)
  if (flatW >= 1 && bandH >= 1) return { w: flatW, h: bandH }
  return { w: 0, h: 0 }
}

function reservedChrome(height: number, chrome: Chrome, rows: number): { top: number; bottom: number } {
  const minBody = Math.min(height, Math.max(0, rows))
  const maxChrome = Math.max(0, height - minBody)
  let top = Math.max(0, Math.round(finite(chrome.top)))
  let bottom = Math.max(0, Math.round(finite(chrome.bottom)))
  const sum = top + bottom
  if (sum > maxChrome) {
    top = sum === 0 ? 0 : Math.floor((top * maxChrome) / sum)
    bottom = maxChrome - top
  }
  return { top, bottom }
}

export function placeTable(viewport: Viewport, chrome: Chrome, rows: readonly FitRow[]): Placement {
  const width = Math.floor(finite(viewport.width))
  const height = Math.floor(finite(viewport.height))
  if (width < 1 || height < 1) throw new Error('viewport must be positive')

  const { top, bottom } = reservedChrome(height, chrome, rows.length)
  const bodyH = height - top - bottom
  const frames: Frame[] = []

  if (top >= 1) {
    frames.push({ id: 'hud-chip', rowId: 'hud', x: 0, y: 0, w: width, h: top })
  }

  if (rows.length === 0 || bodyH < 1) return { frames }

  const base = Math.floor(bodyH / rows.length)
  const extra = bodyH - base * rows.length
  let y = top
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) continue
    const bandH = base + (index < extra ? 1 : 0)
    const count = Math.max(0, Math.floor(finite(row.count)))
    const size = itemSize(count, width, bandH, SHAPE[row.role])
    if (size.w >= 1 && size.h >= 1) {
      const rowW = size.w * count
      const x0 = Math.floor((width - rowW) / 2)
      const y0 = y + Math.floor((bandH - size.h) / 2)
      for (let item = 0; item < count; item += 1) {
        frames.push({
          id: `${row.id}-${item}`,
          rowId: row.id,
          x: x0 + item * size.w,
          y: y0,
          w: size.w,
          h: size.h,
        })
      }
    }
    y += bandH
  }

  return { frames }
}

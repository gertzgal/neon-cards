import { useMemo } from 'react'

/** A pixel bitmap: one string per row, `X` for a lit pixel. */
export type Bitmap = readonly string[]

export const bitmaps = {
  heart: ['..XX...XX..', '.XXXX.XXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'],
  diamond: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'],
  spade: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XX..X..XX.', '.....X.....', '....XXX....', '...XXXXX...'],
  club: ['....XXX....', '...XXXXX...', '...XXXXX...', '....XXX....', '.XX..X..XX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XX..X..XX.', '.....X.....', '....XXX....', '...XXXXX...'],
  crown: ['X..X..X', 'XXXXXXX', 'XXXXXXX'],
  snowflake: ['...X...', '.X.X.X.', '..XXX..', 'XXXXXXX', '..XXX..', '.X.X.X.', '...X...'],
  bolt: ['...XX', '..XX.', '.XX..', 'XXXX.', '..XX.', '.XX..', 'XX...'],
  shield: ['XXXXXXX', 'X.....X', 'X..X..X', 'X.XXX.X', '.X.X.X.', '..X.X..', '...X...'],
  bot: ['.XXXXXX.', 'X.X..X.X', 'X......X', 'X.XXXX.X', 'X......X', '.XXXXXX.', 'X.X..X.X', 'XX.XX.XX'],
} as const satisfies Record<string, Bitmap>

/** Fills each run of lit pixels in a row with one rect, so sprites stay light on the DOM. */
export function bitmapRects(bitmap: Bitmap): { x: number; y: number; w: number }[] {
  const rects: { x: number; y: number; w: number }[] = []
  bitmap.forEach((row, y) => {
    let start = -1
    for (let x = 0; x <= row.length; x++) {
      const lit = row[x] === 'X'
      if (lit && start < 0) start = x
      if (!lit && start >= 0) {
        rects.push({ x: start, y, w: x - start })
        start = -1
      }
    }
  })
  return rects
}

export interface PixelSpriteProps {
  bitmap: Bitmap
  color: string
  /** CSS px per bitmap pixel. Whole numbers keep sprites crisp. */
  scale: number
  glow?: boolean
}

export function PixelSprite({ bitmap, color, scale, glow = true }: PixelSpriteProps) {
  const rects = useMemo(() => bitmapRects(bitmap), [bitmap])
  const w = bitmap[0]?.length ?? 0
  const h = bitmap.length
  return (
    <svg
      className="nc-sprite"
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={glow ? { filter: `drop-shadow(0 0 ${Math.max(3, scale * 1.5)}px ${color})` } : undefined}
      aria-hidden
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} fill={color} />
      ))}
    </svg>
  )
}

/** The biggest whole-number pixel scale that keeps a sprite within `fraction` of `widthPx`. */
export function pixelScale(widthPx: number, bitmapWidth: number, fraction = 0.5): number {
  return Math.max(1, Math.round((widthPx * fraction) / bitmapWidth))
}

/** Like `pixelScale`, but never rounds up past `fraction` of the card. */
export function fitScale(widthPx: number, bitmapWidth: number, fraction: number): number {
  return Math.max(1, Math.floor((widthPx * fraction) / Math.max(1, bitmapWidth)))
}

export interface InkSpriteProps {
  bitmap: Bitmap
  /** Bitmap characters other than `.`. */
  inks: Record<string, string>
  scale: number
  glow?: boolean
}

/** A sprite with more than one ink. `.` is empty. Unknown characters are empty. */
export function InkSprite({ bitmap, inks, scale, glow = false }: InkSpriteProps) {
  const w = bitmap[0]?.length ?? 0
  const h = bitmap.length
  const groups = new Map<string, { x: number; y: number; w: number }[]>()
  bitmap.forEach((row, y) => {
    let start = -1
    let ch = ''
    const flush = (x: number) => {
      if (start < 0) return
      const list = groups.get(ch) ?? []
      list.push({ x: start, y, w: x - start })
      groups.set(ch, list)
      start = -1
    }
    for (let x = 0; x <= row.length; x++) {
      const c = row[x] ?? '.'
      const lit = c !== '.' && inks[c] !== undefined
      if (lit && c === ch && start >= 0) continue
      flush(x)
      if (lit) {
        start = x
        ch = c
      }
    }
  })
  const primary = Object.values(inks)[0] ?? '#fff'
  return (
    <svg
      className="nc-sprite"
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={glow ? { filter: `drop-shadow(0 0 ${Math.max(2, scale)}px ${primary})` } : undefined}
      aria-hidden
    >
      {[...groups.entries()].map(([ch, rects]) =>
        rects.map((r) => <rect key={`${ch}-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} fill={inks[ch]} />),
      )}
    </svg>
  )
}

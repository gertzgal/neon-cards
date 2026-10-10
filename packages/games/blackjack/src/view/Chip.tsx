import type { ChipValue } from './display'

export const CHIP_COLOR: Record<ChipValue, string> = { 5: '#2ef2ff', 25: '#ff2e88', 100: '#a64dff', 500: '#ffd23f' }

const RIM_LIGHT = '#f4f0ff'

function shade(hex: string): string {
  if (hex === RIM_LIGHT) return '#9a94b0'
  const n = parseInt(hex.slice(1), 16)
  return '#' + [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * 0.6).toString(16).padStart(2, '0')).join('')
}

// A 20x15 pixel coin: striped neon rim on a dark face, with a 3px edge underneath.
function chipPixels(color: string): string {
  const cx = 9.5
  const cy = 5.5
  const rx = 9.6
  const ry = 5.6
  let out = ''
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 20; x++) {
      const dist = Math.hypot((x - cx) / rx, (y - cy) / ry)
      let fill: string | null = null
      if (dist <= 1) {
        if (dist > 0.74) {
          const a = Math.atan2((y - cy) / ry, (x - cx) / rx)
          fill = Math.floor((a + Math.PI) / (Math.PI / 5)) % 2 ? color : RIM_LIGHT
        } else fill = dist > 0.62 ? '#000' : '#17121f'
      } else {
        for (let s = 1; s <= 3; s++) {
          if (Math.hypot((x - cx) / rx, (y - s - cy) / ry) <= 1) {
            fill = s === 3 ? '#000' : shade(x % 3 === 0 ? RIM_LIGHT : color)
            break
          }
        }
      }
      if (fill) out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`
    }
  }
  return out
}

const PIXELS = Object.fromEntries(Object.entries(CHIP_COLOR).map(([v, c]) => [v, chipPixels(c)])) as Record<ChipValue, string>

/** Same markup as <Chip>, for effect layers that animate outside React. */
export function chipElement(value: ChipValue, className = ''): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `bj-chip ${className}`
  el.style.setProperty('--cc', CHIP_COLOR[value])
  el.innerHTML = `<svg viewBox="0 0 20 15" shape-rendering="crispEdges">${PIXELS[value]}</svg><span>${value}</span>`
  return el
}

export function Chip({ value, className = '' }: { value: ChipValue; className?: string }) {
  return (
    <div className={`bj-chip ${className}`} style={{ '--cc': CHIP_COLOR[value] } as React.CSSProperties} data-chip={value}>
      <svg viewBox="0 0 20 15" shapeRendering="crispEdges" dangerouslySetInnerHTML={{ __html: PIXELS[value] }} />
      <span>{value}</span>
    </div>
  )
}

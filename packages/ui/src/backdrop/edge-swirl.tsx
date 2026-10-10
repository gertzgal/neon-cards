import { useEffect, useRef } from 'react'
import { phoneMaxWidth } from '../theme/tokens'

const CELL = 3
const FRAME_MS = 90
const COLORS = [
  [255, 46, 136],
  [200, 30, 120],
  [60, 90, 255],
  [46, 242, 255],
] as const

/** Paints one frame of pink and cyan pixel noise swirling at the screen edges, clear in the middle. */
function paint(img: ImageData, seeds: Float32Array, t: number) {
  const { data, width: cw, height: ch } = img
  const aspect = cw / ch
  let k = 0
  for (let y = 0; y < ch; y++) {
    const v = (y / ch) * 2 - 1
    const v4 = v ** 4
    for (let x = 0; x < cw; x++, k++) {
      const i = k * 4
      const u = (x / cw) * 2 - 1
      let m = ((u ** 4 + v4) ** 0.25 - 0.6) / 0.42
      if (m <= 0) {
        data[i + 3] = 0
        continue
      }
      if (m > 1) m = 1
      m = m * m * (3 - 2 * m)
      const a =
        Math.sin(u * aspect * 2.1 + Math.sin(v * 3.1 + t * 0.13) * 1.9 + t * 0.07) +
        Math.sin(v * 2.7 + Math.sin(u * aspect * 2.6 - t * 0.11) * 1.7)
      const band = 0.5 + 0.5 * Math.sin(a * 3.6)
      const density = m * m * (0.04 + 0.8 * band ** 3)
      if ((seeds[k] ?? 1) > density) {
        data[i + 3] = 0
        continue
      }
      const h = Math.sin(a * 1.2 + u * 1.6 - v * 0.8 + t * 0.05)
      const c = COLORS[h > 0.3 ? 0 : h > -0.05 ? 1 : h > -0.45 ? 2 : 3]
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = (70 + 185 * m * (0.4 + 0.6 * band)) | 0
    }
  }
}

export interface EdgeSwirlProps {
  /** `auto` animates on desktop and holds still on phones and under reduced motion. */
  mode?: 'auto' | 'animate' | 'static'
}

export function EdgeSwirl({ mode = 'auto' }: EdgeSwirlProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let img: ImageData
    let seeds: Float32Array
    let t = Math.random() * 100
    const size = () => {
      canvas.width = Math.ceil(window.innerWidth / CELL)
      canvas.height = Math.ceil(window.innerHeight / CELL)
      img = ctx.createImageData(canvas.width, canvas.height)
      seeds = new Float32Array(canvas.width * canvas.height).map(() => Math.random())
      paint(img, seeds, t)
      ctx.putImageData(img, 0, 0)
    }
    const still = () =>
      mode === 'static' ||
      (mode === 'auto' &&
        window.matchMedia(`(max-width: ${phoneMaxWidth}px), (prefers-reduced-motion: reduce)`).matches)
    size()
    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (still() || document.hidden || ts - last < FRAME_MS) return
      last = ts
      t += 0.09
      paint(img, seeds, t)
      ctx.putImageData(img, 0, 0)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('resize', size)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [mode])
  return <canvas ref={ref} className="nc-swirl" data-testid="edge-swirl" aria-hidden />
}

import { useEffect, useRef } from 'react'

const COLORS = [
  [255, 46, 136],
  [200, 30, 120],
  [60, 90, 255],
  [46, 242, 255],
] as const

/** Pixel-noise swirl at the screen edges plus a CRT overlay. Static on phones and under reduced motion. */
export function Backdrop() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = canvas.current
    const cx = cv?.getContext('2d')
    if (!cv || !cx) return
    let W = 0
    let H = 0
    let img: ImageData
    let seeds: Float32Array
    let t = Math.random() * 100
    const still = () => matchMedia('(max-width:699px),(prefers-reduced-motion:reduce)').matches
    const draw = () => {
      const d = img.data
      const asp = W / H
      let k = 0
      for (let y = 0; y < H; y++) {
        const v = (y / H) * 2 - 1
        const av4 = v ** 4
        for (let x = 0; x < W; x++, k++) {
          const i = k * 4
          const u = (x / W) * 2 - 1
          const e = Math.pow(u ** 4 + av4, 0.25)
          let m = (e - 0.6) / 0.42
          if (m <= 0) {
            d[i + 3] = 0
            continue
          }
          if (m > 1) m = 1
          m = m * m * (3 - 2 * m)
          const a = Math.sin(u * asp * 2.1 + Math.sin(v * 3.1 + t * 0.13) * 1.9 + t * 0.07) + Math.sin(v * 2.7 + Math.sin(u * asp * 2.6 - t * 0.11) * 1.7)
          const band = 0.5 + 0.5 * Math.sin(a * 3.6)
          const dens = m * m * (0.04 + 0.8 * band ** 3)
          if ((seeds[k] ?? 1) > dens) {
            d[i + 3] = 0
            continue
          }
          const h = Math.sin(a * 1.2 + u * 1.6 - v * 0.8 + t * 0.05)
          const c = COLORS[h > 0.3 ? 0 : h > -0.05 ? 1 : h > -0.45 ? 2 : 3]
          d[i] = c[0]
          d[i + 1] = c[1]
          d[i + 2] = c[2]
          d[i + 3] = (70 + 185 * m * (0.4 + 0.6 * band)) | 0
        }
      }
      cx.putImageData(img, 0, 0)
    }
    const resize = () => {
      W = Math.ceil(innerWidth / 3)
      H = Math.ceil(innerHeight / 3)
      cv.width = W
      cv.height = H
      img = cx.createImageData(W, H)
      seeds = new Float32Array(W * H).map(() => Math.random())
      draw()
    }
    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (still() || document.hidden || ts - last < 90) return
      last = ts
      t += 0.09
      draw()
    }
    resize()
    raf = requestAnimationFrame(loop)
    addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
    }
  }, [])
  return (
    <>
      <canvas ref={canvas} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', zIndex: 0 }} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          background:
            'radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.5) 100%),repeating-linear-gradient(to bottom,transparent 0 2px,rgba(0,0,0,.18) 2px 3px)',
        }}
      />
    </>
  )
}

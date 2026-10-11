import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from '@neon-cards/ui'

const MAX_DEG = 9
const REACH = 1.6

/** Desktop only: the player's cards lean toward the pointer, strongest when it's over or near a card. */
export function useCardTilt(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    let pointer: { x: number; y: number } | null = null

    const paint = () => {
      frame = 0
      const at = prefersReducedMotion() ? null : pointer
      for (const card of el.querySelectorAll<HTMLElement>('.nc-player .nc-card')) {
        if (!at) {
          card.style.removeProperty('--rx')
          card.style.removeProperty('--ry')
          continue
        }
        const r = card.getBoundingClientRect()
        const nx = (at.x - (r.left + r.width / 2)) / (r.width * REACH)
        const ny = (at.y - (r.top + r.height / 2)) / (r.height * REACH)
        const falloff = Math.max(0, 1 - Math.hypot(nx, ny) / 2)
        const clamp = (n: number) => Math.max(-1, Math.min(1, n))
        card.style.setProperty('--ry', `${(clamp(nx) * MAX_DEG * falloff).toFixed(2)}deg`)
        card.style.setProperty('--rx', `${(-clamp(ny) * MAX_DEG * falloff).toFixed(2)}deg`)
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const move = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const leave = () => {
      pointer = null
      schedule()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(frame)
    }
  }, [root])
}

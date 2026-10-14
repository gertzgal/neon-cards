import { chipElement } from './Chip'
import type { ChipValue } from './display'

export interface Point {
  x: number
  y: number
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** The shell's motion setting (`<html data-motion>`) wins; standalone, follow the OS. */
export function reducedMotion(): boolean {
  const setting = typeof document === 'undefined' ? undefined : document.documentElement.dataset['motion']
  if (setting === 'reduced') return true
  if (setting === 'full') return false
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function center(el: Element | null | undefined): Point {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

const done = (a: Animation) => a.finished.then(() => undefined, () => undefined)

export function shake(el: HTMLElement | null, size: 'small' | 'big' = 'small') {
  if (!el || reducedMotion()) return Promise.resolve()
  const k = size === 'big' ? 1.8 : 1
  const at = (x: number, y: number) => ({ transform: `translate(${x * k}px,${y * k}px)` })
  return done(el.animate([at(0, 0), at(-7, 3), at(6, -4), at(-5, -2), at(4, 3), at(0, 0)], { duration: 300 }))
}

export function flash(el: HTMLElement | null, peak = 1, duration = 700) {
  if (!el) return Promise.resolve()
  return done(el.animate([{ opacity: 0 }, { opacity: peak, offset: 0.15 }, { opacity: peak * 0.8, offset: 0.4 }, { opacity: 0 }], { duration }))
}

export function hop(el: HTMLElement | null) {
  if (!el) return Promise.resolve()
  return done(el.animate([{ transform: 'none' }, { transform: 'translateY(-12px) scale(1.04)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' }))
}

export function pulse(el: HTMLElement | null, scale = 1.025, duration = 450) {
  if (!el || reducedMotion()) return Promise.resolve()
  return done(el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.2 }, { transform: 'scale(1)' }], { duration, easing: 'ease-out' }))
}

export interface PopStyle {
  color: string
  size: number
  glow: string
  duration: number
  kind: string
}

export function numberPop(layer: HTMLElement, at: Point, text: string, style: PopStyle) {
  const el = document.createElement('div')
  el.className = 'bj-pop'
  el.dataset.testid = 'result-pop'
  el.dataset.kind = style.kind
  el.textContent = text
  Object.assign(el.style, { left: `${at.x}px`, top: `${at.y}px`, fontSize: `${style.size}px`, color: style.color, textShadow: style.glow })
  layer.appendChild(el)
  const frames: Keyframe[] = [
    { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.14 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.26 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 },
    { transform: 'translate(-50%,-90%) scale(.95)', opacity: 0 },
  ]
  return done(el.animate(frames, { duration: style.duration, easing: 'ease-out' })).then(() => el.remove())
}

export function flyChip(layer: HTMLElement, value: ChipValue, from: Point, to: Point, opts: { delay?: number; duration?: number; big?: boolean } = {}) {
  const el = chipElement(value, `bj-flychip${opts.big ? ' big' : ''}`)
  layer.appendChild(el)
  const { width, height } = el.getBoundingClientRect()
  const ox = width / 2
  const oy = height / 2
  const arc = Math.min(from.y, to.y) - 60
  const frames: Keyframe[] = [
    { transform: `translate(${from.x - ox}px,${from.y - oy}px) scale(1)` },
    { transform: `translate(${(from.x + to.x) / 2 - ox}px,${arc - oy}px) scale(1.1)`, offset: 0.5 },
    { transform: `translate(${to.x - ox}px,${to.y - oy}px) scale(.85)` },
  ]
  const a = el.animate(frames, { duration: opts.duration ?? 320, delay: opts.delay ?? 0, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' })
  return done(a).then(() => el.remove())
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Half the size of a big flying chip, so a path can stay clear of a box by its center point. */
const CHIP_HALF_W = 31
const CHIP_HALF_H = 23

/** A chip center that stays under the dealer row. `ceiling` is the row's bottom edge. */
function underDealer(y: number, ceiling: number): number {
  return Math.max(y, ceiling + CHIP_HALF_H + 4)
}

/**
 * The reshuffle beat: a short stack of card backs riffles apart, snaps back together, and flies up to
 * the shoe the deal comes from. No text; the riffle sound carries the rest. Reduced motion only fades it.
 */
export function riffle(layer: HTMLElement, at: Point, w: number, h: number, shoe: Point) {
  const n = 6
  const reduced = reducedMotion()
  const jobs: Promise<void>[] = []
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'bj-riffle'
    el.dataset.testid = 'shuffle-cue'
    Object.assign(el.style, { width: `${w}px`, height: `${h}px` })
    el.style.setProperty('--n', `${Math.max(4, w * 0.05)}px`)
    el.style.setProperty('--bw', `${Math.max(3, Math.round(w * 0.025))}px`)
    el.style.setProperty('--rk', `${h * 0.2}px`)
    el.innerHTML = '<div class="bj-card" data-tone="back"><div class="bj-card-in"></div></div>'
    layer.appendChild(el)
    const x = at.x - w / 2
    const y = at.y - h / 2 - i * 2
    const side = i % 2 ? 1 : -1
    const spread = side * w * (0.55 + (i >> 1) * 0.12)
    const pos = (dx: number, dy: number, rest = '') => `translate(${x + dx}px,${y + dy}px) ${rest}`
    const frames: Keyframe[] = reduced
      ? [{ transform: pos(0, 0), opacity: 0 }, { transform: pos(0, 0), opacity: 1, offset: 0.3 }, { transform: pos(0, 0), opacity: 0 }]
      : [
          { transform: pos(0, 24, 'scale(.7)'), opacity: 0 },
          { transform: pos(0, 0), opacity: 1, offset: 0.14 },
          { transform: pos(spread, 6, `rotate(${side * 10}deg)`), opacity: 1, offset: 0.36, easing: 'cubic-bezier(.5,0,.2,1)' },
          { transform: pos(0, -i * 2), opacity: 1, offset: 0.6 },
          { transform: pos(0, -8 - i * 2, 'scale(1.06,.94)'), opacity: 1, offset: 0.68, easing: 'ease-in' },
          { transform: `translate(${shoe.x - w / 2}px,${shoe.y - h / 2}px) rotate(-18deg) scale(.8)`, opacity: 0.4 },
        ]
    const delay = reduced ? 0 : (i % 2) * 22 + (i >> 1) * 10
    jobs.push(done(el.animate(frames, { duration: reduced ? 420 : 720, delay, fill: 'both' })).then(() => el.remove()))
  }
  return Promise.all(jobs).then(() => undefined)
}

/**
 * Keep a chip in the open band between the dealer row and the player's cards. Every point of a flight
 * stays in that band, so the straight lines between them can't cross either hand.
 */
function inBand(p: Point, ceiling: number, avoid: Rect | null): Point {
  // Extra room so a chip still clears the cards while it spins and scales up.
  const roof = ceiling + CHIP_HALF_H + 44
  const y = underDealer(p.y, ceiling)
  if (!avoid) return { x: p.x, y }
  const floor = avoid.top - CHIP_HALF_H - 44
  if (floor < roof) {
    const left = avoid.left - CHIP_HALF_W - 8
    const right = avoid.right + CHIP_HALF_W + 8
    return { x: p.x < (avoid.left + avoid.right) / 2 ? left : right, y: roof }
  }
  return { x: p.x, y: Math.min(Math.max(y, roof), floor) }
}

export interface BurstFlight {
  start: Point
  peak: Point
  end: Point
}

/**
 * One chip of the blackjack fountain: a wide spray, the prototype's shape, that never rises into the
 * dealer row and never crosses the player's cards.
 */
export function burstFlight(origin: Point, ceiling: number, width: number, avoid: Rect | null, rand: () => number): BurstFlight {
  const dist = 110 + rand() * Math.min(width * 0.45, 340)
  const ang = rand() * Math.PI * 2
  const start = inBand(origin, ceiling, avoid)
  const peak = inBand({ x: origin.x + Math.cos(ang) * dist, y: origin.y + Math.sin(ang) * dist * 0.55 - 40 }, ceiling, avoid)
  const end = inBand({ x: peak.x + Math.cos(ang) * 36, y: peak.y + 36 }, ceiling, avoid)
  return { start, peak, end }
}

/**
 * The blackjack chip fountain. Chips spray across the table from `origin` (the pot), staying under the
 * dealer row (`ceiling` is its bottom edge) and off the player's cards (`avoid`).
 */
export function chipBurst(layer: HTMLElement, origin: Point, ceiling: number, count = 24, avoid: Rect | null = null) {
  const values: ChipValue[] = [5, 25, 100, 500]
  const n = reducedMotion() ? 8 : count
  const width = layer.getBoundingClientRect().width || innerWidth
  const jobs: Promise<void>[] = []
  for (let i = 0; i < n; i++) {
    const el = chipElement(values[i % 4] ?? 5, 'bj-flychip big')
    layer.appendChild(el)
    const flight = burstFlight(origin, ceiling, width, avoid, Math.random)
    const spin = () => (Math.random() - 0.5) * 640
    const at = (p: Point, scale: number, rot: number) => `translate(${p.x - CHIP_HALF_W}px,${p.y - CHIP_HALF_H}px) scale(${scale}) rotate(${rot}deg)`
    const frames: Keyframe[] = [
      { transform: at(flight.start, 0.4, 0), opacity: 1, easing: 'cubic-bezier(.15,.8,.3,1)' },
      { transform: at(flight.peak, 1.1, spin()), opacity: 1, offset: 0.4, easing: 'ease-in' },
      { transform: at(flight.end, 1, spin()), opacity: 1, offset: 0.72, easing: 'ease-in' },
      { transform: at(flight.end, 0.9, spin()), opacity: 0 },
    ]
    jobs.push(done(el.animate(frames, { duration: 1200 + Math.random() * 300, delay: i * 12, fill: 'backwards' })).then(() => el.remove()))
  }
  return Promise.all(jobs).then(() => undefined)
}

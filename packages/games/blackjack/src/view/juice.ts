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
 * The blackjack chip fountain. Chips spray sideways and fall, staying in the lower part of the
 * table so they never cover the dealer's cards above `ceiling`.
 */
export function chipBurst(layer: HTMLElement, origin: Point, ceiling: number, count = 24) {
  const values: ChipValue[] = [5, 25, 100, 500]
  const n = reducedMotion() ? 8 : count
  const width = layer.getBoundingClientRect().width
  const jobs: Promise<void>[] = []
  for (let i = 0; i < n; i++) {
    const el = chipElement(values[i % 4] ?? 5, 'bj-flychip big')
    layer.appendChild(el)
    const side = i % 2 ? 1 : -1
    const dx = side * (60 + Math.random() * Math.min(width * 0.42, 380))
    const rise = Math.min(origin.y - ceiling - 40, 60 + Math.random() * 120)
    const peakY = origin.y - Math.max(20, rise)
    const spin = () => (Math.random() - 0.5) * 640
    const x0 = origin.x - 31
    const y0 = origin.y - 23
    const frames: Keyframe[] = [
      { transform: `translate(${x0}px,${y0}px) scale(.4) rotate(0)`, opacity: 1, easing: 'cubic-bezier(.15,.8,.3,1)' },
      { transform: `translate(${x0 + dx * 0.7}px,${peakY - 23}px) scale(1.1) rotate(${spin()}deg)`, opacity: 1, offset: 0.35, easing: 'ease-in' },
      { transform: `translate(${x0 + dx}px,${y0 + 160}px) scale(1) rotate(${spin()}deg)`, opacity: 1, offset: 0.75, easing: 'ease-in' },
      { transform: `translate(${x0 + dx * 1.08}px,${y0 + 320}px) scale(.9) rotate(${spin()}deg)`, opacity: 0 },
    ]
    jobs.push(done(el.animate(frames, { duration: 1100 + Math.random() * 300, delay: i * 12, fill: 'backwards' })).then(() => el.remove()))
  }
  return Promise.all(jobs).then(() => undefined)
}

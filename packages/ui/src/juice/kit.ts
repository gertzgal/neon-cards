import type { FlashTone, JuiceKit, JuiceTarget, Point, PopTier, SfxName } from '../api'
import { chipMarkup } from '../primitives/chips'
import { chipValues, durations, easing, palette, type ChipValue } from '../theme/tokens'

export interface KitHost {
  /** Scope for data-testid lookups; also the element that shakes. */
  stage(): HTMLElement | null
  /** Fixed, pointer-transparent layer for flying chips, pops and flashes. */
  fx(): HTMLElement | null
  reducedMotion(): boolean
  sfx(name: SfxName): void
}

export interface ControlledKit extends JuiceKit {
  /** Finish every running effect and make later ones instant until `resume()`. */
  skip(): void
  resume(): void
}

const popStyle: Record<PopTier, { size: (w: number) => number; ms: number }> = {
  small: { size: (w) => Math.min(w * 0.13, 72), ms: 900 },
  normal: { size: (w) => Math.min(w * 0.18, 110), ms: durations.numberPop },
  big: { size: (w) => Math.min(w * 0.28, 200), ms: durations.numberPopBig },
}

const popColor: Record<FlashTone, { color: string; glow: string }> = {
  pink: { color: palette.pinkSoft, glow: `0 0 10px ${palette.pink}, 0 0 24px ${palette.pink}` },
  cyan: { color: '#7ff7ff', glow: `0 0 10px ${palette.cyan}` },
  gold: { color: '#fffbe6', glow: '0 0 6px #fff, 0 0 18px #ffd23f, 0 0 40px #ffb020, 0 4px 0 #b06a00' },
  bust: { color: '#ff7a93', glow: `0 0 10px ${palette.bust}` },
  violet: { color: '#c99bff', glow: `0 0 10px ${palette.violet}` },
  ink: { color: palette.dim, glow: 'none' },
}

const flashGradient: Record<FlashTone, string> = {
  gold: 'radial-gradient(circle at 50% 60%, rgba(255,255,240,.95), rgba(255,210,63,.6) 35%, rgba(255,170,40,.15) 70%, transparent)',
  bust: 'radial-gradient(ellipse, rgba(255,50,90,.95), rgba(255,46,110,.55) 50%, transparent 72%)',
  pink: 'radial-gradient(ellipse, rgba(255,46,136,.85), rgba(255,46,136,.35) 50%, transparent 72%)',
  cyan: 'radial-gradient(ellipse, rgba(46,242,255,.8), rgba(46,242,255,.3) 50%, transparent 72%)',
  violet: 'radial-gradient(ellipse, rgba(166,77,255,.8), rgba(166,77,255,.3) 50%, transparent 72%)',
  ink: 'radial-gradient(ellipse, rgba(244,240,255,.7), transparent 72%)',
}

function center(el: Element): Point {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** The shared juice primitives, drawn with the Web Animations API on DOM elements. */
export function createJuiceKit(host: KitHost): ControlledKit {
  const running = new Set<Animation>()
  const timers = new Set<() => void>()
  let instant = false

  const find = (t: JuiceTarget | undefined): HTMLElement | null => {
    if (t === undefined) return null
    if (typeof t !== 'string') return t as HTMLElement
    const scope = host.stage() ?? document
    return scope.querySelector<HTMLElement>(`[data-testid="${CSS.escape(t)}"]`)
  }
  const point = (p: Point | JuiceTarget | undefined): Point | null => {
    if (p === undefined) return null
    if (typeof p === 'object' && 'x' in p && 'y' in p) return p
    const el = find(p)
    return el ? center(el) : null
  }
  /** The animatable inner wrapper of a hand slot or card, falling back to the element. */
  const flyOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.nc-fly') ?? (el.closest('.nc-fly') as HTMLElement | null) ?? el

  const play = async (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> => {
    if (instant) return
    const a = el.animate(frames, opts)
    running.add(a)
    try {
      await a.finished
    } catch {
      // A cancelled animation is a finished effect.
    } finally {
      running.delete(a)
    }
  }
  const wait = (ms: number) =>
    instant || ms <= 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(id)
            timers.delete(done)
            resolve()
          }
          const id = setTimeout(done, ms)
          timers.add(done)
        })
  const spawn = (html: string, className: string): HTMLElement | null => {
    const fx = host.fx()
    if (!fx) return null
    const d = document.createElement('div')
    d.className = className
    d.innerHTML = html
    fx.appendChild(d)
    return d
  }

  const flyChip = async (v: ChipValue, from: Point, to: Point, delay: number, ms: number) => {
    const d = spawn(chipMarkup(v, 'md'), 'nc-flychip')
    if (!d) return
    const ox = 23
    const oy = 17
    await play(
      d,
      [
        { transform: `translate(${from.x - ox}px, ${from.y - oy}px) scale(1)` },
        { transform: `translate(${(from.x + to.x) / 2 - ox}px, ${Math.min(from.y, to.y) - 60 - oy}px) scale(1.1)`, offset: 0.5 },
        { transform: `translate(${to.x - ox}px, ${to.y - oy}px) scale(.85)` },
      ],
      { duration: ms, delay, easing: easing.chip, fill: 'both' },
    )
    d.remove()
  }

  const moveChips = async (chips: ChipValue[], from: JuiceTarget, to: JuiceTarget) => {
    const a = point(from)
    const b = point(to)
    if (!a || !b || instant || host.reducedMotion()) {
      if (chips.length) host.sfx('chip')
      return
    }
    host.sfx('chip')
    await Promise.all(chips.slice(0, 12).map((v, i) => flyChip(v, a, b, i * 38, durations.chipFly)))
  }

  const kit: ControlledKit = {
    get reducedMotion() {
      return host.reducedMotion()
    },
    get instant() {
      return instant
    },
    sfx: (name) => {
      if (!instant) host.sfx(name)
    },
    wait,

    async deal(target, opts) {
      const el = find(target)
      if (!el) return
      host.sfx('card')
      const fly = flyOf(el)
      if (host.reducedMotion()) return play(fly, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 })
      const c = center(fly)
      const from = point(opts?.from) ?? { x: window.innerWidth / 2, y: -fly.offsetHeight * 0.8 }
      await play(
        fly,
        [
          { transform: `translate(${from.x - c.x}px, ${from.y - c.y}px) rotate(-18deg) scale(.8)`, opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: durations.dealFly, easing: easing.fly },
      )
      void play(fly, [{ transform: 'scale(1.12,.86)' }, { transform: 'scale(.96,1.05)' }, { transform: 'none' }], {
        duration: durations.dealSquash,
        easing: easing.out,
      })
      await wait(durations.dealGap)
    },

    async flip(target, swap) {
      const el = find(target)
      if (!el) {
        swap?.()
        return
      }
      host.sfx('flip')
      const fly = flyOf(el)
      const card = fly.querySelector<HTMLElement>('.nc-card')
      let cover: HTMLElement | null = null
      if (!swap && card) {
        cover = document.createElement('div')
        cover.className = 'nc-card nc-card-back nc-flip-cover'
        cover.setAttribute('style', card.getAttribute('style') ?? '')
        cover.innerHTML = '<div class="nc-card-in"></div>'
        card.after(cover)
      }
      if (host.reducedMotion()) {
        swap?.()
        if (cover) await play(cover, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 })
        cover?.remove()
        return
      }
      await play(fly, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0) scaleY(1.08)' }], {
        duration: durations.flipOut,
        easing: easing.in,
      })
      cover?.remove()
      swap?.()
      if (swap) await nextFrame()
      await play(
        flyOf(find(target) ?? el),
        [{ transform: 'scaleX(0) scaleY(1.12)' }, { transform: 'scaleX(1.12) scaleY(.9)' }, { transform: 'scaleX(.97) scaleY(1.03)' }, { transform: 'none' }],
        { duration: durations.flipIn, easing: easing.out },
      )
      cover?.remove()
    },

    async slide(target, from) {
      const el = find(target)
      const a = point(from)
      if (!el || !a || host.reducedMotion()) return
      const b = center(el)
      await play(el, [{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: 'none' }], {
        duration: durations.slide,
        easing: easing.out,
      })
    },

    async shake(size = 'small', target) {
      const el = find(target) ?? host.stage()
      if (!el || host.reducedMotion()) return
      const k = size === 'big' ? 1.7 : 1
      const offsets = [
        [-7, 3],
        [6, -4],
        [-5, -2],
        [4, 3],
      ]
      await play(
        el,
        [{ transform: 'none' }, ...offsets.map(([x = 0, y = 0]) => ({ transform: `translate(${x * k}px, ${y * k}px)` })), { transform: 'none' }],
        { duration: size === 'big' ? durations.shakeBig : durations.shakeSmall },
      )
    },

    async flash(tone, target) {
      const host_ = target === undefined ? host.fx() : find(target)
      if (!host_ || instant) return
      const f = document.createElement('div')
      f.className = target === undefined ? 'nc-flash' : 'nc-hflash'
      f.style.background = flashGradient[tone]
      host_.appendChild(f)
      const peak = host.reducedMotion() ? 0.5 : target === undefined ? 0.9 : 1
      await play(f, [{ opacity: 0 }, { opacity: peak, offset: 0.16 }, { opacity: peak * 0.4, offset: 0.45 }, { opacity: 0 }], {
        duration: target === undefined ? durations.flashBig : durations.flash,
      })
      f.remove()
    },

    async numberPop(text, opts) {
      const tier = opts?.tier ?? 'normal'
      const { size, ms } = popStyle[tier]
      const look = popColor[opts?.tone ?? (tier === 'big' ? 'gold' : 'pink')]
      const at = point(opts?.at ?? 'table-middle') ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const p = spawn('', 'nc-pop')
      if (!p) return
      p.textContent = text
      p.dataset['testid'] = 'number-pop'
      p.dataset['tier'] = tier
      Object.assign(p.style, { left: `${at.x}px`, top: `${at.y}px`, fontSize: `${size(window.innerWidth)}px`, color: look.color, textShadow: look.glow })
      const frames = host.reducedMotion()
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
        : [
            { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.14 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.26 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 },
            { transform: 'translate(-50%,-90%) scale(.95)', opacity: 0 },
          ]
      await play(p, frames, { duration: ms, easing: easing.out, fill: 'both' })
      p.remove()
    },

    async chipBurst(opts) {
      if (instant || host.reducedMotion()) return
      const c = point(opts?.at ?? 'table-middle') ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const ceilingEl = find(opts?.ceiling)
      const ceiling = ceilingEl ? ceilingEl.getBoundingClientRect().bottom + 10 : -Infinity
      const count = opts?.count ?? 24
      const spread = Math.min(window.innerWidth * 0.45, 340)
      const bursts = Array.from({ length: count }, (_, i) => {
        const d = spawn(chipMarkup(chipValues[i % chipValues.length] ?? 5, 'lg'), 'nc-flychip')
        if (!d) return Promise.resolve()
        const ang = Math.random() * Math.PI * 2
        const dist = 110 + Math.random() * spread
        const dx = Math.cos(ang) * dist
        const peakY = Math.max(c.y + Math.sin(ang) * dist * 0.8 - 60, ceiling)
        const x0 = c.x - 31
        const y0 = c.y - 23
        const spin = () => (Math.random() - 0.5) * 600
        return play(
          d,
          [
            { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 1, easing: 'cubic-bezier(.15,.8,.3,1)' },
            { transform: `translate(${x0 + dx}px, ${peakY - 23}px) scale(1.1) rotate(${spin()}deg)`, opacity: 1, offset: 0.4, easing: easing.in },
            { transform: `translate(${x0 + dx * 1.1}px, ${peakY + 67}px) scale(1) rotate(${spin()}deg)`, opacity: 1, offset: 0.7, easing: easing.in },
            { transform: `translate(${x0 + dx * 1.15}px, ${peakY + 177}px) scale(.9) rotate(${spin()}deg)`, opacity: 0 },
          ],
          { duration: durations.chipBurst - 200 + Math.random() * 300, easing: 'linear', fill: 'both' },
        ).then(() => d.remove())
      })
      await Promise.all(bursts)
    },

    chipsToPot: (chips, { from, to }) => moveChips(chips, from, to),
    chipsToPlayer: (chips, { from, to }) => moveChips(chips, from, to),

    async badgePulse(target) {
      const el = find(target)
      if (!el) return
      const frames = host.reducedMotion()
        ? [{ filter: 'none' }, { filter: 'brightness(1.8)' }, { filter: 'none' }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.28)', filter: 'brightness(1.6)', offset: 0.35 }, { transform: 'scale(1)' }]
      await play(el, frames, { duration: durations.badgePulse, easing: easing.out })
    },

    skip() {
      instant = true
      for (const a of running) a.finish()
      for (const done of [...timers]) done()
      host.fx()?.replaceChildren()
      host.stage()?.querySelectorAll('.nc-flip-cover, .nc-hflash').forEach((n) => n.remove())
    },
    resume() {
      instant = false
    },
  }
  return kit
}

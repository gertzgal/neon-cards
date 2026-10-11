import './table.css'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { BlackjackAction, BlackjackEvent, BlackjackView } from '../rules'
import { DEAL_FROM, PlayingCard } from './Card'
import { Chip } from './Chip'
import type { EventBatch, TableProps } from './contract'
import {
  applyEvent,
  CHIP_VALUES,
  chipsFor,
  displayFromView,
  formatMoney,
  rebetChips,
  totalLabel,
  type ChipValue,
  type Display,
} from './display'
import { center, chipBurst, flash, flyChip, hop, numberPop, pulse, riffle, shake, sleep, type Point } from './juice'
import { layoutHand, useTableSize, type TableSize } from './layout'
import { createSfx, type Sfx } from './sfx'
import { useCardTilt } from './tilt'

export interface BlackjackTableProps extends TableProps<BlackjackView, BlackjackAction> {
  sfx?: Sfx
  /** Rendered in the top bar, right side (sound and settings icons). */
  hudIcons?: React.ReactNode
}

const silent = createSfx(() => true)

const ORIGIN = { x: 0, y: 0, rot: 0 }

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

const clearedTable = (d: Display): Display => ({ ...d, stage: 'betting', dealer: [], hands: [], active: -1, result: null })

function initialDisplay(view: BlackjackView): Display {
  const d = displayFromView(view)
  return view.phase === 'settling' ? clearedTable(d) : d
}

/** The last settled round, kept on the table root after the felt is swept so tests and tools can read it. */
interface LastRound {
  n: number
  outcomes: string
  statuses: string
  net: number
  dealer: string
}

export function BlackjackTable({ view, events, act: send, busy: sending, sfx = silent, hudIcons }: BlackjackTableProps) {
  const size = useTableSize()
  const [initialView] = useState(view)
  const [display, setDisplay] = useState(() => initialDisplay(initialView))
  const [potChips, setPotChips] = useState<ChipValue[]>(() =>
    initialView.phase === 'playing' ? chipsFor(sum(initialView.hands.map((h) => h.bet))) : [],
  )
  const [animating, setAnimating] = useState(false)
  const busy = sending || animating
  const [shownStack, setShownStack] = useState(initialView.stack)
  const [lastRound, setLastRound] = useState<LastRound | null>(null)
  const roundCount = useRef(0)
  const dealerNote = useRef('')

  const displayRef = useRef(display)
  const potRef = useRef(potChips)
  const lastChips = useRef<ChipValue[]>([])
  const [memory] = useState(() => new Map<string, DOMRect>())
  const root = useRef<HTMLDivElement>(null)
  useCardTilt(root)
  const stage = useRef<HTMLDivElement>(null)
  const fx = useRef<HTMLDivElement>(null)
  const burst = useRef<HTMLDivElement>(null)
  const goldFlash = useRef<HTMLDivElement>(null)

  const q = <T extends Element = HTMLElement>(sel: string) => root.current?.querySelector<T>(sel) ?? null
  const fxLayer = () => fx.current ?? document.body
  const setFx = (kind: string) => {
    if (root.current) root.current.dataset['fx'] = kind
  }

  const commitDisplay = (next: Display) => {
    displayRef.current = next
    flushSync(() => setDisplay(next))
  }
  const commit = (e: BlackjackEvent) => commitDisplay(applyEvent(displayRef.current, e))
  const setPot = (chips: ChipValue[]) => {
    potRef.current = chips
    flushSync(() => setPotChips(chips))
  }

  const betting = display.stage === 'betting'
  const bet = sum(potChips)
  const available = display.stack - (betting ? bet : 0)

  useCountUp(available, setShownStack)

  const flyChips = (amount: number, from: Point, to: Point, stagger = 40) =>
    Promise.all(chipsFor(amount).slice(0, 12).map((v, i) => flyChip(fxLayer(), v, from, to, { delay: i * stagger })))

  const popAt = () => {
    const tray = q('.bj-dealer-row')?.getBoundingClientRect()
    const player = q('.bj-player-row')?.getBoundingClientRect()
    if (!tray || !player) return center(q('.bj-pot-area'))
    return { x: innerWidth / 2, y: (tray.bottom + player.top) / 2 }
  }

  async function resultMoment(e: Extract<BlackjackEvent, { type: 'roundEnd' }>) {
    const d = displayRef.current
    const anyBlackjack = d.hands.some((h) => h.outcome === 'blackjack')
    const allBust = d.hands.every((h) => h.status === 'bust')
    const at = popAt()
    const W = innerWidth
    await sleep(120)
    if (anyBlackjack) {
      setFx('blackjack')
      sfx.play('blackjack')
      void flash(goldFlash.current, 0.9, 900)
      void pulse(stage.current)
      const ceiling = q('.bj-dealer-row')?.getBoundingClientRect().bottom ?? 0
      const cards = [...(root.current?.querySelectorAll<HTMLElement>('[data-testid^="hand-"][data-testid*="-card-"]') ?? [])]
      const hand = cards.reduce<{ left: number; top: number; right: number; bottom: number } | null>((box, el) => {
        const r = el.getBoundingClientRect()
        if (!r.width) return box
        return {
          left: Math.min(box?.left ?? r.left, r.left),
          top: Math.min(box?.top ?? r.top, r.top),
          right: Math.max(box?.right ?? r.right, r.right),
          bottom: Math.max(box?.bottom ?? r.bottom, r.bottom),
        }
      }, null)
      // Spray from the gap between the two hands, not from on top of the player's cards.
      const origin = hand ? { x: innerWidth / 2, y: (ceiling + hand.top) / 2 } : center(q('.bj-pot-area'))
      void chipBurst(burst.current ?? fxLayer(), origin, ceiling, 24, hand)
      void numberPop(fxLayer(), at, '+' + formatMoney(e.net), {
        kind: 'blackjack',
        color: '#fffbe6',
        size: Math.min(W * 0.24, 180, (at.y - ceiling) * 1.6),
        glow: '0 0 6px #fff,0 0 18px #ffd23f,0 0 40px #ffb020,0 4px 0 #b06a00',
        duration: 1900,
      })
      await sleep(650)
    } else if (e.net > 0) {
      setFx('win')
      sfx.play('win')
      void numberPop(fxLayer(), at, '+' + formatMoney(e.net), {
        kind: 'win',
        color: '#ff7ab4',
        size: Math.min(W * 0.18, 110),
        glow: '0 0 10px #ff2e88,0 0 24px #ff2e88',
        duration: 1100,
      })
      d.hands.forEach((h, i) => h.outcome === 'win' && void hop(q(`[data-testid="hand-${i}"] .bj-hand`)))
      await sleep(380)
    } else if (e.net < 0) {
      setFx('lose')
      if (!allBust) sfx.play('lose')
      void numberPop(fxLayer(), at, '-' + formatMoney(-e.net), {
        kind: 'lose',
        color: '#8d87a8',
        size: Math.min(W * 0.13, 72),
        glow: 'none',
        duration: 900,
      })
      await sleep(380)
    } else {
      setFx('push')
      sfx.play('push')
      void numberPop(fxLayer(), at, '±$0', {
        kind: 'push',
        color: '#7ff7ff',
        size: Math.min(W * 0.14, 80),
        glow: '0 0 10px #2ef2ff',
        duration: 900,
      })
      await sleep(380)
    }

    const from = center(q('.bj-pot'))
    if (e.payout > 0) {
      void flyChips(e.payout, from, center(q('[data-testid="hud-bankroll"]')), 35)
      sfx.play('chip')
    } else {
      void flyChips(e.wagered, from, center(q('.bj-tray')), 30)
    }
    setPot([])
    commit(e)
    roundCount.current++
    setLastRound({
      n: roundCount.current,
      outcomes: d.hands.map((h) => h.outcome ?? '').join(','),
      statuses: d.hands.map((h) => h.status).join(','),
      net: e.net,
      dealer: dealerNote.current,
    })
    dealerNote.current = ''
    await sleep(anyBlackjack ? 900 : 520)
  }

  async function sweep() {
    const slots = [...(root.current?.querySelectorAll<HTMLElement>('.bj-slot') ?? [])]
    // The tray and its badge leave with the cards. The row's hidden state then applies with no transition of its own.
    const tray = q('.bj-dealer-row')?.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-14px) scale(.94)' }], {
      duration: 200 + Math.max(0, slots.length - 1) * 20,
      easing: 'ease-out',
      fill: 'forwards',
    })
    await Promise.all([
      ...slots.map((el, i) =>
        el
          .animate([{ opacity: 1 }, { opacity: 0, translate: '0 -40px' }], { duration: 200, delay: i * 20, fill: 'forwards' })
          .finished.catch(() => undefined),
      ),
      tray?.finished.catch(() => undefined),
    ])
    memory.clear()
    commitDisplay(clearedTable(displayRef.current))
    tray?.cancel()
    if (root.current) delete root.current.dataset['fx']
  }

  async function step(e: BlackjackEvent) {
    const d = displayRef.current
    switch (e.type) {
      case 'bet':
        memory.clear()
        commit(e)
        sfx.play('chip')
        return sleep(140)
      case 'deal':
        if (e.seat === 'dealer' && d.stage === 'dealer') await sleep(300)
        commit(e)
        sfx.play('card')
        return sleep(290)
      case 'peek': {
        commit(e)
        sfx.play('peek')
        q('[data-testid="dealer-card-1"] .bj-fly')?.animate(
          [{ transform: 'none' }, { transform: 'translateY(-9px) rotate(-4deg)' }, { transform: 'none' }],
          { duration: 320, easing: 'ease-in-out' },
        )
        return sleep(360)
      }
      case 'reveal':
        await q('[data-testid="dealer-card-1"] .bj-card')
          ?.animate([{ transform: 'none' }, { transform: 'scaleX(0) scaleY(1.08)' }], { duration: 110, easing: 'ease-in' })
          .finished.catch(() => undefined)
        commit(e)
        sfx.play('flip')
        return sleep(280)
      case 'blackjack':
        commit(e)
        return sleep(160)
      case 'dealerBlackjack':
        dealerNote.current = 'blackjack'
        commit(e)
        sfx.play('lose')
        blink(q('[data-testid="dealer-total"]'))
        void flash(q('.bj-tray-flash'), 1, 800)
        void shake(stage.current)
        return sleep(520)
      case 'turn':
        commit(e)
        return sleep(60)
      case 'stand':
        commit(e)
        sfx.play('tap')
        return sleep(140)
      case 'double':
      case 'split': {
        const bank = center(q('[data-testid="hud-bankroll"]'))
        await flyChips(e.amount, bank, center(q('.bj-pot')))
        sfx.play('chip')
        setPot([...potRef.current, ...chipsFor(e.amount)])
        commit(e)
        return sleep(e.type === 'split' ? 260 : 120)
      }
      case 'bust': {
        commit(e)
        sfx.play('bust')
        void shake(stage.current)
        void flash(q(`[data-testid="hand-${e.hand}"] .bj-hflash`), 1, 700)
        blink(q(`[data-testid="hand-${e.hand}-total"]`))
        return sleep(480)
      }
      case 'dealerBust':
        dealerNote.current = 'bust'
        commit(e)
        blink(q('[data-testid="dealer-total"]'))
        void flash(q('.bj-tray-flash'), 0.8, 600)
        return sleep(380)
      case 'roundEnd':
        return resultMoment(e)
      case 'refill': {
        commit(e)
        sfx.play('refill')
        void numberPop(fxLayer(), popAt(), '+' + formatMoney(e.amount), {
          kind: 'refill',
          color: '#7ff7ff',
          size: Math.min(innerWidth * 0.16, 96),
          glow: '0 0 10px #2ef2ff,0 0 24px #2ef2ff',
          duration: 1300,
        })
        const bank = center(q('[data-testid="hud-bankroll"]'))
        void flyChips(e.amount, { x: innerWidth / 2, y: -40 }, bank, 45)
        return sleep(900)
      }
      case 'shuffle': {
        commit(e)
        sfx.play('shuffle')
        await riffle(fxLayer(), center(q('.bj-tray-wrap')), dealerLayout.w, dealerLayout.h, DEAL_FROM())
        return sleep(80)
      }
      default:
        commit(e)
    }
  }

  const lastBatch = useRef(events.id)
  const chain = useRef<Promise<void>>(Promise.resolve())

  async function playBatch(batch: EventBatch, v: BlackjackView) {
    setAnimating(true)
    try {
      for (const e of batch.events as BlackjackEvent[]) await step(e)
      if (v.phase === 'settling') {
        await sweep()
        commitDisplay(clearedTable(displayFromView(v)))
      } else {
        commitDisplay(displayFromView(v))
      }
      afterBatch(v)
    } finally {
      setAnimating(false)
    }
  }

  function afterBatch(v: BlackjackView) {
    if (v.legal.includes('refill')) {
      void send({ type: 'refill' })
      return
    }
    const again = rebetChips(v, lastChips.current)
    if (!potRef.current.length && again.length) {
      setPot([...again])
      sfx.play('chip')
    }
  }

  useEffect(() => {
    if (events.id === lastBatch.current) return
    lastBatch.current = events.id
    const batch = events
    const v = view
    chain.current = chain.current.then(() => playBatch(batch, v))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, view])

  useEffect(() => {
    if (!initialView.legal.includes('refill')) return
    const t = setTimeout(() => afterBatch(initialView), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canBet = betting && !busy
  const legal = busy || betting ? [] : view.legal

  const addChip = (v: ChipValue) => {
    if (!canBet || available < v) return
    sfx.play('chip')
    setPot([...potRef.current, v])
  }
  const clearBet = () => {
    if (!canBet || !potRef.current.length) return
    const from = center(q('.bj-pot'))
    const to = center(q('[data-testid="action-clear"]'))
    potRef.current.slice(0, 12).forEach((v, i) => void flyChip(fxLayer(), v, from, to, { delay: i * 25, duration: 260 }))
    sfx.play('chip')
    setPot([])
  }
  const deal = () => {
    if (!canBet || !potRef.current.length) return
    lastChips.current = [...potRef.current]
    void send({ type: 'bet', amount: sum(potRef.current) })
  }
  const play = (type: 'hit' | 'stand' | 'double' | 'split') => {
    if (legal.includes(type)) void send({ type })
  }

  const keys = useRef({ clearBet, deal, play })
  useLayoutEffect(() => {
    keys.current = { clearBet, deal, play }
  })
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      const { clearBet, deal, play } = keys.current
      if (k === 'h') play('hit')
      else if (k === 's') play('stand')
      else if (k === 'd') play('double')
      else if (k === 'p') play('split')
      else if (k === ' ' || k === 'enter') {
        ev.preventDefault()
        deal()
      } else if (k === 'backspace') clearBet()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const split = display.hands.length > 1
  const dealerLayout = layoutHand(size, 'dealer', display.dealer.length, false)
  const cssVars = useMemo(() => sizeVars(size), [size])

  return (
    <div
      className="bj-root"
      ref={root}
      data-testid="blackjack-table"
      data-stage={display.stage}
      data-busy={busy ? 'true' : 'false'}
      data-animating={animating ? 'true' : 'false'}
      data-rounds={lastRound?.n ?? 0}
      data-last-outcomes={lastRound?.outcomes ?? ''}
      data-last-statuses={lastRound?.statuses ?? ''}
      data-last-net={lastRound?.net ?? ''}
      data-last-dealer={lastRound?.dealer ?? ''}
      data-layout={size.phone ? 'phone' : 'desktop'}
      style={cssVars}
    >
      <div className="bj-stage" ref={stage}>
        <div className="bj-top">
          <div className="bj-bank" data-testid="hud-bankroll" data-value={available}>
            {formatMoney(shownStack)}
          </div>
          <div className="bj-icons">{hudIcons}</div>
        </div>

        <div className="bj-burst" ref={burst} />

        <div className="bj-dealer-row" data-testid="dealer-row" data-visible={display.dealer.length > 0}>
          <Badge kind="dealer" text="" spacer />
          <div className="bj-tray-wrap">
            <div className="bj-tray">
              <div className="bj-tray-in" />
              <div className="bj-tray-flash" />
              <div className="bj-hand bj-hand-dealer" data-testid="dealer-hand" style={handVars(dealerLayout)}>
                {display.dealer.map((card, i) => (
                  <PlayingCard
                    key={`d${i}`}
                    card={card}
                    slot={dealerLayout.slots[i] ?? ORIGIN}
                    w={dealerLayout.w}
                    h={dealerLayout.h}
                    z={i}
                    memory={memory}
                    memoryKey={`d${i}`}
                    testId={`dealer-card-${i}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <Badge kind="dealer" text={totalLabel(display.dealer)} testId="dealer-total" />
        </div>

        <div className="bj-pot-area">
          <Pot chips={potChips} />
          <div className="bj-pot-amt" data-testid="bet-amount" data-value={bet}>
            {bet ? formatMoney(bet) : ''}
          </div>
        </div>

        <div className="bj-player-row" data-split={split}>
          {display.hands.map((hand, i) => {
            const lay = layoutHand(size, 'player', hand.cards.length, split)
            const idle = split && display.stage === 'playing' && i !== display.active
            return (
              <div
                key={i}
                className="bj-grp"
                data-testid={`hand-${i}`}
                data-status={hand.status}
                data-outcome={hand.outcome ?? ''}
                data-active={i === display.active}
                data-idle={idle}
                data-bet={hand.bet}
              >
                {!split && <Badge kind="player" text="" spacer />}
                <div className="bj-hand bj-hand-player" style={handVars(lay)}>
                  {hand.cards.map((card, j) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      slot={lay.slots[j] ?? ORIGIN}
                      w={lay.w}
                      h={lay.h}
                      z={j}
                      memory={memory}
                      memoryKey={card.id}
                      testId={`hand-${i}-card-${j}`}
                    />
                  ))}
                </div>
                <Badge kind="player" text={totalLabel(hand.cards)} testId={`hand-${i}-total`} />
                <div className="bj-hflash" />
              </div>
            )
          })}
        </div>

        <div className="bj-felt">
          <div className="bj-ctl">
            {betting ? (
              <div className="bj-row bj-bet-row">
                {CHIP_VALUES.map((v) => (
                  <button
                    key={v}
                    className="bj-rack-chip"
                    data-testid={`chip-${v}`}
                    style={{ gridArea: `c${v}` }}
                    disabled={!canBet || available < v}
                    onClick={() => addChip(v)}
                    aria-label={`Add ${v}`}
                  >
                    <Chip value={v} className="big" />
                  </button>
                ))}
                <button className="bj-btn bj-clear" data-testid="action-clear" disabled={!canBet || !bet} onClick={clearBet} aria-label="Clear bet">
                  <svg viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges">
                    <path d="M0 0h2v1h1v1h2V1h1V0h2v2H7v1H6v2h1v1h1v2H6V7H5V6H3v1H2v1H0V6h1V5h1V3H1V2H0z" />
                  </svg>
                </button>
                <button className="bj-btn bj-main bj-deal" data-testid="action-deal" disabled={!canBet || !bet} onClick={deal}>
                  DEAL
                </button>
              </div>
            ) : (
              <div className="bj-row bj-play-row">
                {(['hit', 'stand', 'double', 'split'] as const).map((type) => (
                  <button
                    key={type}
                    className={`bj-btn${type === 'hit' ? ' bj-main' : ''}`}
                    data-testid={`action-${type}`}
                    disabled={!legal.includes(type)}
                    onClick={() => play(type)}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bj-gold-flash" ref={goldFlash} />
      <div className="bj-fx" ref={fx} />
    </div>
  )
}

function blink(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove('bj-blink')
  void el.offsetWidth
  el.classList.add('bj-blink')
}

function Badge({ kind, text, testId, spacer }: { kind: 'dealer' | 'player'; text: string; testId?: string; spacer?: boolean }) {
  return (
    <div className={`bj-badge bj-badge-${kind}${spacer ? ' bj-spacer' : ''}`} data-testid={testId} aria-hidden={spacer}>
      {spacer ? '00' : text}
    </div>
  )
}

function Pot({ chips }: { chips: ChipValue[] }) {
  if (chips.length <= 5) {
    return (
      <div className="bj-pot">
        {chips.map((v, i) => (
          <Chip key={i} value={v} className="bj-drop" />
        ))}
      </div>
    )
  }
  const stacks = CHIP_VALUES.slice()
    .reverse()
    .map((v) => [v, chips.filter((c) => c === v).length] as const)
    .filter(([, n]) => n > 0)
  return (
    <div className="bj-pot">
      {stacks.map(([v, n]) => (
        <div className="bj-stack" key={v}>
          {Array.from({ length: Math.min(n, 8) }, (_, i) => (
            <Chip key={i} value={v} className={i === Math.min(n, 8) - 1 ? 'bj-drop' : 'bj-under'} />
          ))}
        </div>
      ))}
    </div>
  )
}

function handVars(l: { w: number; h: number; width: number }): React.CSSProperties {
  return {
    width: l.width,
    height: l.h,
    '--n': `${Math.max(4, l.w * 0.05)}px`,
    '--bw': `${Math.max(3, Math.round(l.w * 0.025))}px`,
    '--rk': `${l.h * 0.2}px`,
  } as React.CSSProperties
}

function sizeVars(s: TableSize): React.CSSProperties {
  return { '--ph': `${s.ph}px`, '--pw': `${s.pw}px`, '--dh': `${s.dh}px`, '--dw': `${s.dw}px` } as React.CSSProperties
}

function useCountUp(target: number, set: (n: number) => void) {
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 400)
      const n = Math.round(start + (target - start) * k)
      from.current = n
      set(n)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, set])
}

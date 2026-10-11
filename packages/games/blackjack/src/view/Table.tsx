import './table.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameEvent } from '@neon-cards/engine'
import {
  ActionBar,
  BetControls,
  ChipStack,
  chipsFor,
  DealerTray,
  formatMoney,
  Hand,
  Hud,
  PlayerRow,
  PlayerSpot,
  ScoreBadge,
  standardFaceRenderer,
  TableLayout,
  useJuice,
  usePlayback,
  useTableMetrics,
  type ChipValue,
  type EventBatch,
  type JuiceKit,
  type JuiceMap,
  type Point,
  type SeatState,
  type TableProps,
} from '@neon-cards/ui'
import type { BlackjackAction, BlackjackEvent, BlackjackView } from '../rules'
import { applyEvent, displayFromView, totalLabel, type Display, type DisplayHand, type Stage } from './display'
import { juice as eventJuice } from './juice'
import { useCardTilt } from './tilt'

type PlayAction = 'hit' | 'stand' | 'double' | 'split'
const PLAY_ACTIONS: readonly PlayAction[] = ['hit', 'stand', 'double', 'split']

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

const clearedTable = (d: Display): Display => ({ ...d, stage: 'betting', dealer: [], hands: [], active: -1, result: null })

function initialDisplay(view: BlackjackView): Display {
  const d = displayFromView(view)
  return view.phase === 'settling' ? clearedTable(d) : d
}

function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function handState(hand: DisplayHand, index: number, active: number, stage: Stage, split: boolean): SeatState | undefined {
  if (hand.status === 'bust') return 'bust'
  if (hand.outcome === 'blackjack' || hand.status === 'blackjack') return 'blackjack'
  if (hand.outcome === 'win') return 'win'
  if (split && stage === 'playing') return index === active ? 'active' : 'waiting'
  return undefined
}

/** The last settled round, kept on the table root after the felt is swept so tests and tools can read it. */
interface LastRound {
  n: number
  outcomes: string
  statuses: string
  net: number
  dealer: string
}

export function BlackjackTable({ seats, view, events, act: send, busy: sending, hudIcons }: TableProps<BlackjackView, BlackjackAction>) {
  const metrics = useTableMetrics()
  const kit = useJuice()
  const [initialView] = useState(view)
  const [display, setDisplay] = useState(() => initialDisplay(initialView))
  const [pot, setPotChips] = useState<ChipValue[]>(() =>
    initialView.phase === 'playing' ? chipsFor(sum(initialView.hands.map((h) => h.bet))) : [],
  )
  const [animating, setAnimating] = useState(false)
  const [bigMoment, setBigMoment] = useState(false)
  const [lastRound, setLastRound] = useState<LastRound | null>(null)
  const busy = sending || animating

  const displayRef = useRef(display)
  const potRef = useRef(pot)
  const lastChips = useRef<ChipValue[]>([])
  const refilled = useRef(false)
  const roundCount = useRef(0)
  const dealerNote = useRef('')
  const splitFrom = useRef<Point | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useCardTilt(root)

  const show = (next: Display) => {
    displayRef.current = next
    setDisplay(next)
  }
  const setPot = (chips: ChipValue[]) => {
    potRef.current = chips
    setPotChips(chips)
  }

  const betting = display.stage === 'betting'
  const bet = sum(pot)
  const available = display.stack - (betting ? bet : 0)

  /** Advances the shown table by one event. Playback calls it for every event, skipped or not. */
  function apply(event: GameEvent) {
    const e = event as BlackjackEvent
    const d = displayRef.current
    switch (e.type) {
      case 'bet':
        if (!potRef.current.length) setPot(chipsFor(e.amount))
        break
      case 'split':
        splitFrom.current = centerOf(root.current?.querySelector(`[data-testid="card-${d.hands[0]?.cards[1]?.id}"]`))
        setPot([...potRef.current, ...chipsFor(e.amount)])
        break
      case 'double':
        setPot([...potRef.current, ...chipsFor(e.amount)])
        break
      case 'dealerBlackjack':
        dealerNote.current = 'blackjack'
        break
      case 'dealerBust':
        dealerNote.current = 'bust'
        break
      case 'roundEnd': {
        roundCount.current++
        setLastRound({
          n: roundCount.current,
          outcomes: d.hands.map((h) => h.outcome ?? '').join(','),
          statuses: d.hands.map((h) => h.status).join(','),
          net: e.net,
          dealer: dealerNote.current,
        })
        dealerNote.current = ''
        // The bankroll waits for the payout chips; the result moment (or the end of a skipped batch) moves it.
        show({ ...applyEvent(d, e), stack: d.stack })
        return
      }
      case 'refill':
        refilled.current = true
        lastChips.current = []
        break
    }
    show(applyEvent(d, e))
  }

  async function roundEnd(e: Extract<BlackjackEvent, { type: 'roundEnd' }>, kit: JuiceKit) {
    const d = displayRef.current
    const blackjack = d.hands.some((h) => h.outcome === 'blackjack')
    const allBust = d.hands.every((h) => h.status === 'bust')
    await kit.wait(120)
    if (blackjack) {
      setBigMoment(true)
      kit.sfx('blackjack')
      void kit.flash('gold')
      void kit.chipBurst({ at: 'hand-0', ceiling: 'dealer-tray' })
      void kit.numberPop('+' + formatMoney(e.net), { tier: 'big', tone: 'gold' })
      await kit.wait(650)
    } else if (e.net > 0) {
      kit.sfx('win')
      void kit.numberPop('+' + formatMoney(e.net), { tone: 'pink' })
      d.hands.forEach((h, i) => h.outcome === 'win' && void kit.badgePulse(`hand-${i}-total`))
      await kit.wait(380)
    } else if (e.net < 0) {
      if (!allBust) kit.sfx('lose')
      void kit.numberPop('-' + formatMoney(-e.net), { tier: 'small', tone: 'ink' })
      await kit.wait(380)
    } else {
      kit.sfx('push')
      void kit.numberPop('±$0', { tone: 'cyan' })
      await kit.wait(380)
    }
    if (e.payout > 0) void kit.chipsToPlayer(chipsFor(e.payout), { from: 'pot', to: 'hud-bankroll' })
    else void kit.chipsToPot(chipsFor(e.wagered), { from: 'pot', to: 'dealer-tray' })
    setPot([])
    show({ ...displayRef.current, stack: e.stack })
    await kit.wait(blackjack ? 900 : 520)
  }

  async function splitSlide(e: Extract<BlackjackEvent, { type: 'split' }>, kit: JuiceKit) {
    const from = splitFrom.current
    splitFrom.current = null
    const moved = displayRef.current.hands[1]?.cards[0]
    await Promise.all([
      kit.chipsToPot(chipsFor(e.amount), { from: 'hud-bankroll', to: 'pot' }),
      from && moved ? kit.slide(`card-${moved.id}`, from) : undefined,
    ])
    await kit.wait(140)
  }

  async function refill(e: Extract<BlackjackEvent, { type: 'refill' }>, kit: JuiceKit) {
    kit.sfx('win')
    void kit.numberPop('+' + formatMoney(e.amount), { tone: 'cyan' })
    void kit.chipsToPlayer(chipsFor(e.amount), { from: 'dealer-tray', to: 'hud-bankroll' })
    await kit.wait(900)
  }

  const juice = { ...eventJuice, roundEnd, split: splitSlide, refill } as JuiceMap
  const playback = usePlayback({ juice, seats, apply })

  async function sweep() {
    const slots = [...(root.current?.querySelectorAll<HTMLElement>('.nc-slot') ?? [])]
    if (kit.reducedMotion) return
    await Promise.all(
      slots.map((el, i) =>
        el
          .animate([{ opacity: 1 }, { opacity: 0, translate: '0 -40px' }], { duration: 200, delay: i * 20, fill: 'forwards' })
          .finished.catch(() => undefined),
      ),
    )
  }

  async function playBatch(batch: EventBatch, v: BlackjackView) {
    setAnimating(true)
    try {
      await playback.play(batch.events)
      if (v.phase === 'settling') {
        await sweep()
        setPot([])
        show(clearedTable(displayFromView(v)))
      } else {
        show(displayFromView(v))
      }
      setBigMoment(false)
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
    if (refilled.current) {
      refilled.current = false
      return
    }
    const again = lastChips.current.length ? lastChips.current : chipsFor(v.lastBet)
    if (v.legal.includes('bet') && !potRef.current.length && again.length && sum(again) <= v.stack) {
      setPot([...again])
      kit.sfx('chip')
    }
  }

  const lastBatch = useRef(events.id)
  const chain = useRef<Promise<void>>(Promise.resolve())
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
    kit.sfx('chip')
    setPot([...potRef.current, v])
  }
  const clearBet = () => {
    if (!canBet || !potRef.current.length) return
    void kit.chipsToPlayer(potRef.current, { from: 'pot', to: 'action-clear' })
    setPot([])
  }
  const deal = () => {
    if (!canBet || !potRef.current.length) return
    lastChips.current = [...potRef.current]
    void send({ type: 'bet', amount: sum(potRef.current) })
  }
  const play = (type: PlayAction) => {
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
  const splitWidth = metrics.phone ? (metrics.width - 48) / 2 : Math.min(metrics.width * 0.64, 760) / 2

  return (
    <div
      className="bj-root"
      ref={root}
      data-testid="blackjack-table"
      data-stage={display.stage}
      data-busy={busy ? 'true' : 'false'}
      data-animating={animating ? 'true' : 'false'}
      data-split={split ? 'true' : 'false'}
      data-big-moment={bigMoment ? 'true' : 'false'}
      data-rounds={lastRound?.n ?? 0}
      data-last-outcomes={lastRound?.outcomes ?? ''}
      data-last-statuses={lastRound?.statuses ?? ''}
      data-last-net={lastRound?.net ?? ''}
      data-last-dealer={lastRound?.dealer ?? ''}
    >
      <TableLayout
        hud={<Hud bankroll={available} right={hudIcons} />}
        top={
          <div className="bj-dealer" data-visible={display.dealer.length > 0 ? 'true' : 'false'}>
            <DealerTray cards={display.dealer} renderer={standardFaceRenderer} total={totalLabel(display.dealer) || null} />
          </div>
        }
        middle={<ChipStack chips={pot} />}
        bottom={
          <PlayerRow>
            {display.hands.map((hand, i) => {
              const state = handState(hand, i, display.active, display.stage, split)
              const stateProp = state ? { state } : {}
              return (
                <PlayerSpot
                  key={i}
                  testId={`hand-${i}`}
                  {...stateProp}
                  badge={<ScoreBadge value={totalLabel(hand.cards) || null} testId={`hand-${i}-total`} {...stateProp} />}
                >
                  <Hand cards={hand.cards} renderer={standardFaceRenderer} {...stateProp} {...(split ? { maxWidth: splitWidth } : {})} />
                </PlayerSpot>
              )
            })}
          </PlayerRow>
        }
        controls={
          betting ? (
            <BetControls
              onPick={addChip}
              isDisabled={(v) => !canBet || available < v}
              onClear={clearBet}
              onDeal={deal}
              canClear={canBet && bet > 0}
              canDeal={canBet && bet > 0}
            />
          ) : (
            <ActionBar
              actions={PLAY_ACTIONS.map((id) => ({ id, label: id.toUpperCase(), primary: id === 'hit', disabled: !legal.includes(id) }))}
              onAction={(id) => play(id as PlayAction)}
            />
          )
        }
      />
    </div>
  )
}

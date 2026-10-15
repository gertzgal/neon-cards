import './table.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { faceDown, type CardView, type Flip7Face, type GameEvent, type SeatId } from '@neon-cards/engine'
import {
  ActionBar,
  Hand,
  Hud,
  NeonButton,
  OpponentRows,
  PixelSprite,
  PlayerSpot,
  PlayingCard,
  ScoreBadge,
  TableLayout,
  bitmaps,
  toneColor,
  useCountUp,
  usePlayback,
  useTableMetrics,
  type OpponentSeatModel,
  type Point,
  type SeatState,
  type TableProps,
} from '@neon-cards/ui'
import { hasAnyCard, roundValue, type F7Card, type Flip7Action, type Flip7View, type RoundScore } from '../rules'
import { applyEvent, displayFromView, type Display, type DisplaySeat } from './display'
import { ACTION_HINT_MS, actionSentence, flip7Face } from './face'
import { crown, HitIcon, NextIcon, StayIcon } from './icons'
import { createJuice } from './juice'

function seatCards(display: Display): F7Card[] {
  const cards: F7Card[] = []
  for (const seat of Object.values(display.seats)) {
    cards.push(...seat.numbers, ...seat.modifiers)
    if (seat.secondChance) cards.push(seat.secondChance)
    if (seat.freeze) cards.push(seat.freeze)
  }
  return cards
}

const lineOf = (s: DisplaySeat) => ({ numbers: s.numbers, modifiers: s.modifiers, secondChance: s.secondChance, freeze: s.freeze })
const valueOf = (s: DisplaySeat) => roundValue({ status: s.status, line: lineOf(s), flip7: s.flip7 })
const extrasOf = (s: DisplaySeat): F7Card[] => [...s.modifiers, ...(s.secondChance ? [s.secondChance] : []), ...(s.freeze ? [s.freeze] : [])]
const uniqueOf = (s: DisplaySeat) => new Set(s.numbers.map((c) => (c.face.kind === 'number' ? c.face.value : -1))).size

function TotalPill({ total, target }: { total: number; target: number }) {
  const shown = useCountUp(total)
  return (
    <div className="nc-pill f7-total" data-testid="hud-total" data-value={total}>
      {shown}
      <span className="f7-target">/{target}</span>
    </div>
  )
}

function Slots({ filled, gold }: { filled: number; gold: boolean }) {
  return (
    <div className="f7-slots" data-testid="slots" data-filled={filled} data-gold={gold}>
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} data-testid={`slot-${i}`} data-on={i < filled ? 'true' : undefined} />
      ))}
    </div>
  )
}

/** The Balatro-style breakdown of your round: numbers, ×2, +mods, +15, then the round score. Numbers only. */
function Tally({ score }: { score: RoundScore }) {
  if (score.busted) {
    return (
      <div className="f7-tally" data-testid="tally" data-round={0}>
        <b className="f7-tally-bust">BUST</b>
      </div>
    )
  }
  const parts = [
    String(score.numbers),
    ...(score.x2 ? ['×2'] : []),
    ...(score.plus ? [`+${score.plus}`] : []),
    ...(score.flip7Bonus ? [`+${score.flip7Bonus}`] : []),
  ]
  return (
    <div className="f7-tally" data-testid="tally" data-round={score.round}>
      {parts.map((p, i) => (
        <span key={i} style={{ animationDelay: `${i * 140}ms` }} data-gold={p === '+15' && score.flip7Bonus ? 'true' : undefined}>
          {p}
        </span>
      ))}
      <b style={{ animationDelay: `${parts.length * 140 + 80}ms` }}>{score.round}</b>
    </div>
  )
}

export function Flip7Table({ seats, humanSeat, view, events, act, busy, hudIcons }: TableProps<Flip7View, Flip7Action>) {
  const [display, setDisplay] = useState<Display>(() => displayFromView(view))
  const [revealing, setRevealing] = useState<SeatId[]>([])
  const [before] = useState(() => new Map<string, Point>())
  const [juice] = useState(() =>
    createJuice({ human: humanSeat, before, settleBust: (seat) => flushSync(() => setRevealing((r) => r.filter((s) => s !== seat))) }),
  )
  const [hint, setHint] = useState<{ text: string; until: number | null } | null>(null)
  const viewRef = useRef(view)
  const rootRef = useRef<HTMLDivElement>(null)
  const metrics = useTableMetrics()
  useLayoutEffect(() => {
    viewRef.current = view
  })
  useEffect(() => {
    if (!hint?.until) return
    const wait = Math.max(0, hint.until - Date.now())
    const timer = window.setTimeout(() => {
      setHint((current) => (current?.until === hint.until ? null : current))
    }, wait)
    return () => window.clearTimeout(timer)
  }, [hint])

  const apply = useCallback(
    (event: GameEvent) => {
      if (event.type === 'CardDealt') {
        const dealt = event as { card?: F7Card }
        const sentence = dealt.card ? actionSentence(dealt.card.face) : null
        if (sentence) setHint({ text: sentence, until: Date.now() + ACTION_HINT_MS })
      }
      const card = (event as { card?: F7Card }).card
      if (card) {
        const el = document.querySelector(`[data-testid="card-${CSS.escape(card.id)}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          before.set(card.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
        } else before.delete(card.id)
      }
      if (event.type === 'Busted' && typeof event.seat === 'string') setRevealing((r) => [...r, event.seat as SeatId])
      setDisplay((d) => applyEvent(d, event))
    },
    [before],
  )
  const playback = usePlayback({ juice, seats, apply })
  const { play } = playback

  const startedId = useRef(events.id)
  const [settledId, setSettledId] = useState(events.id)
  useEffect(() => {
    if (startedId.current === events.id) return
    startedId.current = events.id
    const id = events.id
    void play(events.events).then(() => {
      setDisplay(displayFromView(viewRef.current))
      setRevealing([])
      setSettledId(id)
    })
  }, [events, play])

  const settled = settledId === events.id && !playback.playing
  const interactive = settled && !busy
  const mine = interactive && view.pending?.seat === humanSeat ? view.pending : null
  const picking = useMemo(() => (mine && mine.kind !== 'hitOrStay' ? view.legalTargets : []), [mine, view.legalTargets])
  const me = display.seats[humanSeat]
  const canStay = mine?.kind === 'hitOrStay' && hasAnyCard(view.seats[humanSeat]?.line ?? lineOf(me as DisplaySeat))

  const send = useCallback(
    (action: Flip7Action) => {
      if (interactive) void act(action)
    },
    [interactive, act],
  )

  // The first round deals itself: setup leaves the shoe untouched so the opening deal plays as events.
  const dealt = useRef(false)
  useEffect(() => {
    if (interactive && view.stage === 'ready' && !dealt.current) {
      dealt.current = true
      void act({ type: 'nextRound' })
    }
  }, [interactive, view.stage, act])

  const pick = useCallback(
    (seat: SeatId) => {
      if (!mine || !picking.includes(seat)) return
      if (mine.kind === 'target') send({ type: 'target', to: seat })
      else if (mine.kind === 'passSecondChance') send({ type: 'passSecondChance', to: seat })
      else if (mine.kind === 'assign') send({ type: 'assign', cardId: mine.card.id, to: seat })
    },
    [mine, picking, send],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'h' && mine?.kind === 'hitOrStay') send({ type: 'hit' })
      else if (k === 's' && canStay) send({ type: 'stay' })
      else if ((k === ' ' || k === 'enter') && interactive && view.stage === 'roundOver') send({ type: 'nextRound' })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mine, canStay, interactive, view.stage, send])

  // Opponent seat boxes belong to the kit, so their game state rides on data attributes.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    for (const id of display.order) {
      if (id === humanSeat) continue
      const el = root.querySelector(`[data-testid="seat-${CSS.escape(id)}"]`)
      const s = display.seats[id]
      if (!el || !s) continue
      el.setAttribute('data-status', s.status)
      el.setAttribute('data-total', String(s.total))
      el.setAttribute('data-pick', picking.includes(id) ? 'true' : 'false')
      el.setAttribute('data-tied', display.tiebreak && isTied(display, id) ? 'true' : 'false')
    }
  })

  const acting = playback.playing ? playback.actingSeat : settled ? (view.pending?.seat ?? null) : null
  const stateOf = (id: SeatId): SeatState => {
    const s = display.seats[id]
    if (!s) return 'idle'
    if (display.winner === id || s.flip7) return 'win'
    if (s.status === 'busted') return 'bust'
    if (s.status !== 'active') return 'out'
    return acting === id ? 'active' : 'idle'
  }
  const scoreOf = (id: SeatId) => display.lastScores?.find((r) => r.seat === id) ?? null
  const cardsOf = (id: SeatId, s: DisplaySeat): CardView<Flip7Face>[] => {
    const hidden = s.status === 'busted' && !revealing.includes(id)
    const numbers: CardView<Flip7Face>[] = hidden ? s.numbers.map(faceDown) : s.numbers
    return id === humanSeat ? numbers : [...numbers, ...extrasOf(s)]
  }

  const opponents: OpponentSeatModel<Flip7Face>[] = display.order
    .filter((id) => id !== humanSeat)
    .flatMap((id) => {
      const seat = seats.find((x) => x.id === id)
      const s = display.seats[id]
      if (!seat || !s) return []
      const score = scoreOf(id)
      const status =
        s.status === 'busted' ? 'BUST' : score ? `+${score.round}` : s.numbers.length || s.modifiers.length ? `+${valueOf(s)}` : ''
      return [{ seat, cards: cardsOf(id, s), total: s.total, status, state: stateOf(id) }]
    })

  const onTopClick = (e: MouseEvent) => {
    const el = (e.target as Element).closest('.nc-seat')
    const id = el?.getAttribute('data-testid')?.replace(/^seat-/, '')
    if (id) pick(id)
  }

  const onCardClick = (e: MouseEvent) => {
    const cardEl = (e.target as Element).closest('.nc-card')
    if (!(cardEl instanceof HTMLElement)) return
    const raw = cardEl.getAttribute('data-testid') ?? ''
    if (!raw.startsWith('card-')) return
    const card = seatCards(display).find((item) => item.id === raw.slice('card-'.length))
    if (!card) return
    const sentence = actionSentence(card.face)
    setHint(sentence ? { text: sentence, until: null } : null)
  }

  const myScore = scoreOf(humanSeat)
  const held = display.held
  const flipThree = display.flipThree
  const pendingCard = mine && mine.kind === 'assign' ? mine.card.id : held?.card.id
  const unique = me ? uniqueOf(me) : 0
  const myState = stateOf(humanSeat)

  const controls =
    display.stage === 'roundOver' ? (
      <div className="nc-actions f7-next" data-testid="action-bar">
        <NeonButton primary testId="action-next" ariaLabel="Next round" disabled={!interactive} onClick={() => send({ type: 'nextRound' })}>
          <NextIcon />
        </NeonButton>
      </div>
    ) : display.stage === 'gameOver' ? (
      <div className="f7-crown" data-testid="game-over" data-winner={display.winner ?? ''}>
        <PixelSprite bitmap={crown} color={toneColor[display.winner === humanSeat ? 'gold' : 'cyan']} scale={8} />
      </div>
    ) : (
      <ActionBar
        columns={{ phone: 2, desktop: 2 }}
        onAction={(id) => send({ type: id === 'hit' ? 'hit' : 'stay' })}
        actions={[
          { id: 'hit', label: <HitIcon />, primary: true, ariaLabel: 'Hit', disabled: mine?.kind !== 'hitOrStay' },
          { id: 'stay', label: <StayIcon />, tone: 'cyan', ariaLabel: 'Stay', disabled: !canStay },
        ]}
      />
    )

  return (
    <div
      ref={rootRef}
      className="f7"
      data-testid="flip7-table"
      data-stage={display.stage}
      data-round={display.round}
      data-busy={String(busy || !settled)}
      data-pending={mine?.kind ?? ''}
      data-picking={String(picking.length > 0)}
      data-tiebreak={String(display.tiebreak)}
      onClick={onCardClick}
    >
      <TableLayout
        hud={<Hud bankroll={null} left={<TotalPill total={me?.total ?? 0} target={view.targetScore} />} right={hudIcons} />}
        top={
          <div className="f7-top" onClick={onTopClick}>
            <OpponentRows seats={opponents} renderer={flip7Face} />
          </div>
        }
        middle={
          <div className="f7-middle">
            <div className="f7-pile" data-testid="draw-pile" data-count={display.drawCount}>
              <PlayingCard card={{ id: 'pile', deck: 'flip7', face: null }} renderer={flip7Face} size="compact" />
              <span className="f7-pile-count">{display.drawCount}</span>
            </div>
            {flipThree && (
              <div className="f7-flip3" data-testid="flip3-pips" data-seat={flipThree.seat} data-remaining={flipThree.remaining}>
                <PixelSprite bitmap={bitmaps.bolt} color={toneColor.violet} scale={3} />
                {[0, 1, 2].map((i) => (
                  <i key={i} data-on={i < flipThree.remaining ? 'true' : undefined} />
                ))}
              </div>
            )}
            {held && (
              <div className="f7-held" data-testid="held" data-seat={held.seat} data-mine={String(held.seat === humanSeat && picking.length > 0)}>
                <PlayingCard card={held.card} renderer={flip7Face} size="tray" />
              </div>
            )}
            {display.tray.length > 0 && (
              <div className="f7-tray" data-testid="set-aside" data-next={pendingCard ?? ''}>
                <Hand cards={display.tray} renderer={flip7Face} size="compact" layout="row" testId="set-aside-hand" />
              </div>
            )}
            {display.stage === 'roundOver' && myScore && <Tally score={myScore} />}
          </div>
        }
        bottom={
          me && (
            <div
              className="f7-me"
              data-testid={`seat-${humanSeat}`}
              data-status={me.status}
              data-total={me.total}
              data-pick={String(picking.includes(humanSeat))}
              data-tied={String(display.tiebreak && isTied(display, humanSeat))}
              onClick={() => pick(humanSeat)}
            >
              <div className="f7-extras">
                <Hand cards={extrasOf(me)} renderer={flip7Face} size="compact" layout="row" testId="you-extras" />
              </div>
              <Slots filled={me.status === 'busted' ? 0 : unique} gold={me.flip7} />
              {hint && (
                <p className="nc-rule-line" data-testid="card-rule">
                  {hint.text}
                </p>
              )}
              <PlayerSpot
                state={myState}
                badge={
                  <ScoreBadge
                    value={me.status === 'busted' ? 0 : valueOf(me)}
                    testId="round-value"
                    tone={me.flip7 ? 'gold' : 'pink'}
                    state={myState}
                  />
                }
              >
                <Hand
                  cards={cardsOf(humanSeat, me)}
                  renderer={flip7Face}
                  size="hand"
                  layout="strip"
                  maxWidth={Math.max(160, metrics.width - (metrics.phone ? 24 : 80))}
                  testId="you-hand"
                  state={myState}
                />
              </PlayerSpot>
            </div>
          )
        }
        controls={controls}
      />
    </div>
  )
}

function isTied(d: Display, id: SeatId): boolean {
  const best = Math.max(...d.order.map((x) => d.seats[x]?.total ?? 0))
  return (d.seats[id]?.total ?? 0) === best
}

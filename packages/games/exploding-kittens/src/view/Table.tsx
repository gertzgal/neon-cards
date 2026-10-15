import './table.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { CardView, GameEvent, SeatId } from '@neon-cards/engine'
import {
  ActionBar,
  Hud,
  OpponentRows,
  PlayerSpot,
  PlayingCard,
  CardInspect,
  InspectFace,
  PixelSprite,
  ScoreBadge,
  TableLayout,
  handLayout,
  toneColor,
  useCardInspect,
  useTableMetrics,
  type InspectCopy,
  type OpponentSeatModel,
  type SeatState,
  type TableProps,
} from '@neon-cards/ui'
import { TITLE_ORDER, type EkAction, type EkFace, type EkView, type Title } from '../rules'
import { FACE_LABEL } from '../rules/deck'
import { scenes } from './art'
import { applyEvent, displayFromView, owedBadge, type Display } from './display'
import { ekFace, faceCorner, kittenMark } from './face'
import { DrawIcon, NopeIcon, PassIcon, crown } from './icons'
import { createJuice } from './juice'
import { useEkPlayback } from './playback'
import { actionForName, actionForSeat, fiveAction, fiveTitles, onCardTap, targetSeats } from './select'

function ekInspect(display: Display, el: HTMLElement, box: { w: number; h: number }): InspectCopy | null {
  const raw = el.getAttribute('data-testid') ?? ''
  if (!raw.startsWith('card-')) return null
  const id = raw.slice('card-'.length)
  const pool: CardView<EkFace>[] = [...display.hand, ...display.discard, ...display.knownTop]
  if (display.revealed) pool.push(display.revealed)
  if (display.pileBack?.face) pool.push(display.pileBack)
  const card = pool.find((item) => item.id === id && item.face)
  if (!card?.face) return null
  const scene = scenes[card.face.title]
  return {
    title: FACE_LABEL[card.face.title],
    rule: scene.rule,
    preview: (
      <InspectFace accent={scene.accent} box={box}>
        {ekFace.render(card.face, { size: 'hand', widthPx: box.w })}
      </InspectFace>
    ),
  }
}

function backs(id: SeatId, count: number, drawn: string | undefined): CardView<EkFace>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i === count - 1 && drawn ? drawn : `back-${id}-${i}`,
    deck: 'exploding-kittens',
    face: null,
  }))
}

export function ExplodingKittensTable({ seats, humanSeat, view, events, act, busy, hudIcons }: TableProps<EkView, EkAction>) {
  const [display, setDisplay] = useState<Display>(() => displayFromView(view))
  const [selected, setSelected] = useState<string[]>([])
  const [askSeat, setAskSeat] = useState<SeatId | null>(null)
  const [juice] = useState(() => createJuice(humanSeat))
  const viewRef = useRef(view)
  const rootRef = useRef<HTMLDivElement>(null)
  const metrics = useTableMetrics()
  const inspectBox = metrics.phone ? { w: 118, h: 160 } : { w: 148, h: 200 }
  const inspect = useCardInspect(rootRef, (el) => ekInspect(display, el, inspectBox))
  useLayoutEffect(() => {
    viewRef.current = view
  })

  const apply = useCallback(
    (event: GameEvent) => setDisplay((current) => applyEvent(current, event, humanSeat)),
    [humanSeat],
  )
  const playback = useEkPlayback({ juice, seats, apply })
  const { play } = playback

  const startedId = useRef(events.id)
  const [settledId, setSettledId] = useState(events.id)
  useEffect(() => {
    if (startedId.current === events.id) return
    startedId.current = events.id
    const id = events.id
    void play(events.events).then(() => {
      setDisplay(displayFromView(viewRef.current))
      setSelected([])
      setAskSeat(null)
      setSettledId(id)
    })
  }, [events, play])

  const settled = settledId === events.id && !playback.playing
  const interactive = settled && !busy
  const pending = settled ? view.pending : null
  const mine = pending && pending.seat === humanSeat ? pending : null
  const taking = interactive && mine?.kind === 'turn' ? fiveTitles(view.hand, selected) : null
  const picks = useMemo(
    () => (interactive && mine?.kind === 'turn' && !taking ? targetSeats(view.hand, view.actions, selected) : []),
    [interactive, mine, taking, view.hand, view.actions, selected],
  )

  const send = useCallback(
    (action: EkAction) => {
      if (interactive) void act(action)
    },
    [interactive, act],
  )

  const clearPick = () => {
    setSelected([])
    setAskSeat(null)
  }

  const onCard = (id: string) => {
    if (!interactive || !mine) return
    if (mine.kind === 'give') {
      send({ type: 'give', cardId: id })
      return
    }
    if (mine.kind !== 'turn') return
    if (taking && selected.includes(id)) {
      const five = fiveAction(view.hand, selected, id)
      if (five) {
        clearPick()
        send(five)
      }
      return
    }
    const tap = onCardTap(view.hand, view.actions, selected, id)
    if (tap.send) {
      clearPick()
      send(tap.send)
    } else {
      setSelected(tap.selected)
      setAskSeat(null)
    }
  }

  const onSeat = (id: SeatId) => {
    if (!interactive || mine?.kind !== 'turn') return
    const result = actionForSeat(view.hand, view.actions, selected, id)
    if (result.send) {
      clearPick()
      send(result.send)
    } else if (result.ask) setAskSeat(id)
  }

  const onDiscard = (id: string) => {
    if (!taking) return
    const five = fiveAction(view.hand, selected, id)
    if (!five) return
    clearPick()
    send(five)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'escape' && (selected.length > 0 || askSeat)) {
        setSelected([])
        setAskSeat(null)
        event.preventDefault()
        return
      }
      if (!interactive || !mine) return
      if ((key === 'escape' || key === 'p') && mine.kind === 'nope') send({ type: 'pass' })
      else if (key === 'n' && mine.kind === 'nope') send({ type: 'nope' })
      else if (key === 'd' && mine.kind === 'turn' && view.actions.some((action) => action.type === 'draw')) send({ type: 'draw' })
      else if (mine.kind === 'defuse' && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (view.actions.some((action) => action.type === 'defuse' && action.index === index)) send({ type: 'defuse', index })
        else return
      } else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interactive, mine, selected.length, askSeat, send, view.actions])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    for (const id of display.order) {
      const el = root.querySelector(`[data-testid="seat-${CSS.escape(id)}"]`)
      const seat = display.seats[id]
      if (!el || !seat) continue
      el.setAttribute('data-alive', seat.alive ? 'true' : 'false')
      el.setAttribute('data-count', String(id === humanSeat ? display.hand.length : seat.count))
      el.setAttribute('data-pick', picks.includes(id) ? 'true' : 'false')
      el.setAttribute('data-owed', display.turn === id ? String(owedBadge(display.owed)) : '')
    }
  })

  const acting = playback.playing ? playback.actingSeat : display.turn
  const stateOf = (id: SeatId): SeatState => {
    if (display.winner === id) return 'win'
    const seat = display.seats[id]
    if (seat && !seat.alive) return 'out'
    return acting === id ? 'active' : 'idle'
  }

  const opponents: OpponentSeatModel<EkFace>[] = display.order
    .filter((id) => id !== humanSeat)
    .flatMap((id) => {
      const seat = seats.find((item) => item.id === id)
      const bits = display.seats[id]
      if (!seat || !bits) return []
      const alive = bits.alive
      return [
        {
          seat,
          cards: alive ? backs(id, bits.count, display.drawnId[id]) : [],
          total: display.turn === id ? owedBadge(display.owed) : null,
          state: stateOf(id),
        },
      ]
    })

  const onTopClick = (event: MouseEvent) => {
    const el = (event.target as Element).closest('.nc-seat')
    const raw = el?.getAttribute('data-testid')
    if (raw?.startsWith('seat-')) onSeat(raw.slice('seat-'.length))
  }

  const hand = display.hand
  // Phone keeps the owed digit in the top bar. Beside the fan it shoved the first card off the screen.
  const limit = metrics.phone ? metrics.width - 64 : Math.min(metrics.width * 0.7, 860)
  const layout = handLayout(hand.length, metrics.card.hand, 'fan', limit, 'hand')
  const owner = new Map<Title, string>()
  if (mine?.kind === 'turn') {
    for (const title of TITLE_ORDER) {
      const ofTitle = hand.filter((card) => card.face?.title === title)
      const pick = ofTitle.find((card) => !selected.includes(card.id)) ?? ofTitle[0]
      if (pick) owner.set(title, pick.id)
    }
  }

  const names = askSeat ? TITLE_ORDER.filter((title) => actionForName(view.hand, view.actions, selected, askSeat, title)) : []
  const kitten = mine?.kind === 'defuse' ? mine.kitten : display.revealed
  const topDiscard = display.discard.slice(-4)
  const myState = stateOf(humanSeat)
  const owed =
    display.turn === humanSeat ? <ScoreBadge value={owedBadge(display.owed)} testId="owed" tone="pink" state={myState} /> : null

  const controls =
    display.winner ? (
      <div className="ek-crown" data-testid="game-over" data-winner={display.winner}>
        <PixelSprite bitmap={crown} color={toneColor[display.winner === humanSeat ? 'gold' : 'cyan']} scale={8} />
      </div>
    ) : mine?.kind === 'defuse' ? (
      <div className="ek-inserts" data-testid="inserts" data-count={view.drawCount + 1}>
        {Array.from({ length: view.drawCount + 1 }, (_, index) => (
          <button
            key={index}
            type="button"
            data-testid={`insert-${index}`}
            data-end={index === 0 ? 'top' : index === view.drawCount ? 'bottom' : undefined}
            aria-label={index === 0 ? 'Top' : index === view.drawCount ? 'Bottom' : `Plant ${index}`}
            onClick={() => send({ type: 'defuse', index })}
          />
        ))}
      </div>
    ) : mine?.kind === 'nope' ? (
      <ActionBar
        columns={{ phone: 2, desktop: 2 }}
        onAction={(id) => send(id === 'nope' ? { type: 'nope' } : { type: 'pass' })}
        actions={[
          { id: 'nope', label: <NopeIcon />, primary: true, ariaLabel: 'Nope' },
          { id: 'pass', label: <PassIcon />, tone: 'cyan', ariaLabel: 'Pass' },
        ]}
      />
    ) : (
      <ActionBar
        columns={{ phone: 1, desktop: 1 }}
        onAction={() => {
          clearPick()
          send({ type: 'draw' })
        }}
        actions={[
          {
            id: 'draw',
            label: <DrawIcon />,
            primary: true,
            ariaLabel: 'Draw',
            disabled: !(interactive && mine?.kind === 'turn' && view.actions.some((action) => action.type === 'draw')),
          },
        ]}
      />
    )

  return (
    <div
      ref={rootRef}
      className="ek"
      data-testid="ek-table"
      data-state={display.winner ? 'over' : 'playing'}
      data-busy={String(busy || !settled)}
      data-pending={mine?.kind ?? ''}
      data-nopes={mine?.kind === 'nope' ? mine.nopes : undefined}
      data-effect={mine?.kind === 'nope' ? mine.effect.type : undefined}
      data-picking={String(picks.length > 0)}
    >
      <TableLayout
        hud={<Hud bankroll={null} left={metrics.phone ? owed : null} right={hudIcons} />}
        top={
          <div className="ek-top" onClick={onTopClick}>
            <OpponentRows seats={opponents} renderer={ekFace} />
          </div>
        }
        middle={
          <div className="ek-middle">
            <div className="ek-pile" data-testid="draw" data-count={display.drawCount}>
              <PlayingCard card={{ id: 'pile', deck: 'exploding-kittens', face: null }} renderer={ekFace} size="compact" />
              {display.pileBack && <PlayingCard card={display.pileBack} renderer={ekFace} size="compact" />}
              <span className="ek-count">{display.drawCount}</span>
            </div>
            {display.knownTop.length > 0 && (
              <div className="ek-known" data-testid="known-top" data-count={display.knownTop.length}>
                {display.knownTop.map((card) => (
                  <PlayingCard key={card.id} card={card} renderer={ekFace} size="compact" />
                ))}
              </div>
            )}
            {display.plantedIndex !== null && !display.pileBack && (
              <div className="ek-planted" data-testid="planted" data-index={display.plantedIndex}>
                <PixelSprite bitmap={kittenMark} color={toneColor.pink} scale={2} />
                <span>{display.plantedIndex}</span>
              </div>
            )}
            {kitten && (
              <div className="ek-kitten" data-testid="defuse-kitten">
                <PlayingCard card={kitten} renderer={ekFace} size="tray" />
              </div>
            )}
            <div className="ek-discard" data-testid="discard" data-count={display.discard.length}>
              {topDiscard.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="ek-discard-card"
                  data-dim={display.dimmed.includes(card.id) ? 'true' : undefined}
                  data-play={taking ? 'true' : undefined}
                  onClick={() => onDiscard(card.id)}
                >
                  <PlayingCard card={card} renderer={ekFace} size="compact" />
                </button>
              ))}
            </div>
            {names.length > 0 && (
              <div className="ek-ask" data-testid="ask">
                {names.map((title) => (
                  <button key={title} type="button" data-testid={`ask-${title}`} aria-label={FACE_LABEL[title]} onClick={() => {
                    if (!askSeat) return
                    const action = actionForName(view.hand, view.actions, selected, askSeat, title)
                    if (!action) return
                    clearPick()
                    send(action)
                  }}>
                    {faceCorner(title)}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
        bottom={
          <div
            className="ek-me"
            data-testid={`seat-${humanSeat}`}
            data-alive={display.seats[humanSeat]?.alive === false ? 'false' : 'true'}
            data-count={hand.length}
          >
            <PlayerSpot
              state={myState}
              badge={metrics.phone ? null : owed}
            >
              <div className="ek-hand" data-testid="you-hand" data-count={hand.length} style={{ width: layout.width, height: layout.card.h }}>
                {hand.map((card, index) => {
                  const slot = layout.slots[index] ?? { x: 0, y: 0, rotate: 0 }
                  const title = card.face?.title
                  const on = selected.includes(card.id)
                  const testId =
                    mine?.kind === 'give'
                      ? `give-${card.id}`
                      : title && owner.get(title) === card.id
                        ? `action-card-${title}`
                        : `card-pick-${card.id}`
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="ek-card-btn"
                      data-testid={testId}
                      data-card={card.id}
                      data-selected={on ? 'true' : 'false'}
                      aria-label={card.face ? FACE_LABEL[card.face.title] : 'face-down card'}
                      data-play={interactive && mine && (mine.kind === 'give' || mine.kind === 'turn') ? 'true' : undefined}
                      style={{
                        width: layout.card.w,
                        height: layout.card.h,
                        zIndex: index + (on ? 20 : 0),
                        transform: `translate(${slot.x}px, ${slot.y - (on ? 16 : 0)}px) rotate(${slot.rotate}deg)`,
                      }}
                      onClick={() => onCard(card.id)}
                    >
                      <PlayingCard card={card} renderer={ekFace} size="hand" box={layout.card} state={myState} />
                    </button>
                  )
                })}
              </div>
            </PlayerSpot>
          </div>
        }
        controls={controls}
      />
      <CardInspect copy={inspect.copy} cardId={inspect.cardId} playable={inspect.playable} onPlay={inspect.confirm} onClose={inspect.close} />
    </div>
  )
}

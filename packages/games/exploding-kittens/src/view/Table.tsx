import './table.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { CardView, GameEvent, SeatId } from '@neon-cards/engine'
import {
  ActionBar,
  Hud,
  NeonButton,
  OpponentRows,
  PlayerSpot,
  PlayingCard,
  PixelSprite,
  ScoreBadge,
  TableLayout,
  straightRow,
  toneColor,
  useTableMetrics,
  type OpponentSeatModel,
  type SeatState,
  type TableProps,
} from '@neon-cards/ui'
import { TITLE_ORDER, type EkAction, type EkFace, type EkView, type Title } from '../rules'
import { FACE_LABEL } from '../rules/deck'
import { scenes } from './art'
import { applyEvent, displayFromView, owedBadge, type Display } from './display'
import { ekFace, faceCorner, kittenMark } from './face'
import { DrawIcon, PassIcon, crown } from './icons'
import { createJuice } from './juice'
import { useEkPlayback } from './playback'
import { playChoice, toggleRaised } from './select'

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
  const [target, setTarget] = useState<SeatId | null>(null)
  const [name, setName] = useState<Title | null>(null)
  const [takeId, setTakeId] = useState<string | null>(null)
  const [juice] = useState(() => createJuice(humanSeat))
  const viewRef = useRef(view)
  const rootRef = useRef<HTMLDivElement>(null)
  const metrics = useTableMetrics()
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
      setTarget(null)
      setName(null)
      setTakeId(null)
      setSettledId(id)
    })
  }, [events, play])

  const settled = settledId === events.id && !playback.playing
  const interactive = settled && !busy
  const pending = settled ? view.pending : null
  const mine = pending && pending.seat === humanSeat ? pending : null
  const raising = mine?.kind === 'turn' || mine?.kind === 'nope' || mine?.kind === 'give' ? mine.kind : null
  const choice = useMemo(
    () => (raising ? playChoice(view.hand, view.actions, selected, raising, view.discard, { target, name, takeId }) : null),
    [raising, view.hand, view.actions, view.discard, selected, target, name, takeId],
  )
  const picks = choice && choice.reason === 'Pick a player.' ? choice.targets : []

  const send = useCallback(
    (action: EkAction) => {
      if (interactive) void act(action)
    },
    [interactive, act],
  )

  const clearPick = () => {
    setSelected([])
    setTarget(null)
    setName(null)
    setTakeId(null)
  }

  const onCard = (id: string) => {
    if (!interactive || !raising) return
    setSelected((current) => toggleRaised(current, id))
    setTarget(null)
    setName(null)
    setTakeId(null)
  }

  const onSeat = (id: SeatId) => {
    if (!interactive || !picks.includes(id)) return
    setTarget(id)
  }

  const onDiscard = (id: string) => {
    if (!interactive || selected.length !== 5) return
    setTakeId(id)
  }

  const onPlay = () => {
    if (!choice?.action) return
    const action = choice.action
    clearPick()
    send(action)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'escape' && (selected.length > 0 || target || name)) {
        clearPick()
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
  }, [interactive, mine, selected.length, target, name, send, view.actions])

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
  // The Play column stays on the right, so the row never runs under it. The owed digit stays in the phone top bar.
  const playColumn = metrics.phone ? 176 : 208
  const badge = metrics.phone ? 0 : 72
  const limit = Math.max(140, metrics.width - playColumn - badge - 24)
  const layout = straightRow(hand.length, metrics.card.hand, limit)
  const owner = new Map<Title, string>()
  if (raising) {
    for (const title of TITLE_ORDER) {
      const ofTitle = hand.filter((card) => card.face?.title === title)
      const pick = ofTitle.find((card) => !selected.includes(card.id)) ?? ofTitle[0]
      if (pick) owner.set(title, pick.id)
    }
  }

  const focus = hand.find((card) => card.id === selected[selected.length - 1])
  const focusRule = focus?.face ? scenes[focus.face.title].rule : null
  const names = choice?.reason === 'Name a card.' ? choice.names : []
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
        columns={{ phone: 1, desktop: 1 }}
        onAction={() => send({ type: 'pass' })}
        actions={[{ id: 'pass', label: <PassIcon />, tone: 'cyan', ariaLabel: 'Pass' }]}
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
                  data-take={selected.length === 5 && (takeId ?? view.discard[view.discard.length - 1]?.id) === card.id ? 'true' : undefined}
                  onClick={() => onDiscard(card.id)}
                >
                  <PlayingCard card={card} renderer={ekFace} size="compact" />
                </button>
              ))}
            </div>
            {names.length > 0 && (
              <div className="ek-ask" data-testid="ask">
                {names.map((title) => (
                  <button
                    key={title}
                    type="button"
                    data-testid={`ask-${title}`}
                    aria-label={FACE_LABEL[title]}
                    data-on={name === title ? 'true' : undefined}
                    onClick={() => setName(title)}
                  >
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
            <div className="ek-bottom-row">
              <div className="ek-hand-col">
                {focusRule && (
                  <p className="nc-rule-line" data-testid="card-rule">
                    {focusRule}
                  </p>
                )}
                <PlayerSpot state={myState} badge={metrics.phone ? null : owed}>
                  <div
                    className="ek-hand-scroll"
                    data-testid="you-hand"
                    data-count={hand.length}
                    data-layout="strip"
                    style={{ width: layout.scrolls ? limit : layout.width }}
                  >
                    <div className="ek-hand-row" style={{ width: layout.width, height: layout.card.h }}>
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
                            style={{
                              width: layout.card.w,
                              height: layout.card.h,
                              zIndex: index + (on ? 20 : 0),
                              transform: `translate(${slot.x}px, ${on ? -36 : 0}px)`,
                            }}
                            onClick={() => onCard(card.id)}
                          >
                            <PlayingCard card={card} renderer={ekFace} size="hand" box={layout.card} state={myState} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </PlayerSpot>
              </div>
              <div className="nc-play-dock" data-testid="play-dock" data-open={selected.length > 0 ? 'true' : 'false'}>
                {selected.length > 0 && (
                  <>
                    {choice?.reason && (
                      <p className="nc-play-reason" data-testid="play-reason">
                        {choice.reason}
                      </p>
                    )}
                    <NeonButton primary testId="play-card" ariaLabel="Play" disabled={!choice?.action} onClick={onPlay}>
                      Play
                    </NeonButton>
                  </>
                )}
              </div>
            </div>
          </div>
        }
        controls={controls}
      />
    </div>
  )
}

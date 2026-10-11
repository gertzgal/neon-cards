import { useEffect, useRef, useState } from 'react'
import type { CardView, GameEvent, SeatId, StandardFace } from '@neon-cards/engine'
import { HUMAN, highCard, type HighCardAction, type HighCardView } from '@neon-cards/engine/testing'
import {
  ActionBar,
  definePlugin,
  Hand,
  Hud,
  OpponentRows,
  PlayerSpot,
  ScoreBadge,
  StatusBadge,
  standardFaceRenderer,
  TableLayout,
  usePlayback,
  type JuiceMap,
  type OpponentSeatModel,
  type TableProps,
} from '@neon-cards/ui'

// Dev-only table for the engine's test-only High Card game. It proves the multi-seat path in the real
// shell (pre-game settings -> config -> seats, server CPU turns, paced playback, opponent rows) without
// Flip 7 rules. The Worker serves the game only with DEV_RIG=1, so production answers 404 for it.

type Card = CardView<StandardFace>
interface Model {
  round: number
  hands: Record<SeatId, Card>
  status: Record<SeatId, string>
  scores: Record<SeatId, number>
  winners: SeatId[]
}

const fromView = (view: HighCardView): Model => ({
  round: view.round,
  hands: view.hands,
  status: Object.fromEntries(view.winners.map((id) => [id, 'WIN'])),
  scores: view.scores,
  winners: view.winners,
})

function applyEvent(m: Model, e: GameEvent): Model {
  const seat = e.seat ?? ''
  const card = e.card as Card | undefined
  switch (e.type) {
    case 'round':
      return { ...m, round: e.round as number, status: {}, winners: [] }
    case 'deal':
    case 'reveal':
      return card ? { ...m, hands: { ...m.hands, [seat]: card } } : m
    case 'swap':
      return card ? { ...m, hands: { ...m.hands, [seat]: card }, status: { ...m.status, [seat]: 'SWAP' } } : m
    case 'keep':
      return { ...m, status: { ...m.status, [seat]: 'KEEP' } }
    case 'roundEnd': {
      const winners = e.winners as SeatId[]
      const scores = { ...m.scores }
      for (const id of winners) scores[id] = (scores[id] ?? 0) + 1
      return { ...m, scores, winners, status: { ...m.status, ...Object.fromEntries(winners.map((id) => [id, 'WIN'])) } }
    }
    default:
      return m
  }
}

const juice: JuiceMap = {
  deal: (e, kit) => {
    kit.sfx('card')
    return kit.deal(`card-${(e.card as Card).id}`)
  },
  swap: (e, kit) => {
    kit.sfx('card')
    return kit.deal(`card-${(e.card as Card).id}`)
  },
  keep: (_e, kit) => kit.sfx('click'),
  reveal: (e, kit) => {
    kit.sfx('flip')
    return kit.flip(`card-${(e.card as Card).id}`)
  },
  roundEnd: async (e, kit) => {
    const winners = e.winners as SeatId[]
    const human = winners.includes(HUMAN)
    kit.sfx(human ? 'win' : 'lose')
    await Promise.all([
      ...winners.map((id) => kit.badgePulse(id === HUMAN ? 'player-total' : `seat-${id}-total`)),
      ...(human ? [kit.numberPop('+1', { tone: 'gold' })] : []),
    ])
  },
}

function HighCardTable({ seats, humanSeat, view, events, act, busy, hudIcons }: TableProps<HighCardView, HighCardAction>) {
  const [model, setModel] = useState(() => fromView(view))
  const [doneId, setDoneId] = useState<number | null>(null)
  const latestView = useRef(view)
  useEffect(() => {
    latestView.current = view
  })
  const playback = usePlayback({ juice, seats, apply: (e) => setModel((m) => applyEvent(m, e)) })
  const { play } = playback
  const started = useRef<number | null>(null)
  useEffect(() => {
    if (started.current === events.id) return
    started.current = events.id
    void play(events.events).then(() => {
      setModel((m) => {
        const synced = fromView(latestView.current)
        return { ...synced, status: { ...m.status, ...synced.status } }
      })
      setDoneId(events.id)
    })
  }, [events, play])

  const settled = doneId === events.id
  const shown = model
  const toAct = settled ? view.toAct : null
  const acting = playback.actingSeat

  const opponents: OpponentSeatModel<StandardFace>[] = seats
    .filter((s) => s.kind === 'cpu')
    .map((seat) => {
      const card = shown.hands[seat.id]
      const status = acting === seat.id && playback.thinking ? 'THINKING' : shown.status[seat.id]
      return {
        seat,
        cards: card ? [card] : [],
        total: shown.scores[seat.id] ?? 0,
        ...(status ? { status } : {}),
        state: shown.winners.includes(seat.id) ? 'win' : acting === seat.id ? 'active' : 'waiting',
      }
    })

  const mine = shown.hands[humanSeat]
  const over = settled && view.phase === 'over'
  const best = Math.max(...Object.values(view.scores))
  const status = over
    ? view.scores[humanSeat] === best
      ? 'YOU WIN'
      : 'GAME OVER'
    : shown.winners.length
      ? shown.winners.includes(humanSeat)
        ? 'ROUND WON'
        : 'ROUND LOST'
      : toAct === humanSeat
        ? 'YOUR TURN'
        : `ROUND ${shown.round}`

  const actions =
    settled && view.phase === 'settling'
      ? [{ id: 'next', label: 'NEXT ROUND', primary: true, disabled: busy }]
      : [
          { id: 'keep', label: 'KEEP', disabled: busy || toAct !== humanSeat },
          { id: 'swap', label: 'SWAP', primary: true, disabled: busy || toAct !== humanSeat },
        ]

  return (
    <div
      data-testid="high-card-table"
      data-phase={settled ? view.phase : 'playing'}
      data-playing={playback.playing}
      data-acting={acting ?? ''}
      data-settled={settled}
      style={{ display: 'contents' }}
    >
      <TableLayout
        hud={<Hud bankroll={null} right={hudIcons} />}
        top={<OpponentRows seats={opponents} renderer={standardFaceRenderer} />}
        middle={
          <StatusBadge tone={over || shown.winners.includes(humanSeat) ? 'gold' : 'cyan'} testId="round-status">
            {status}
          </StatusBadge>
        }
        bottom={
          <PlayerSpot
            state={shown.winners.includes(humanSeat) ? 'win' : toAct === humanSeat ? 'active' : 'idle'}
            badge={<ScoreBadge value={shown.scores[humanSeat] ?? 0} testId="player-total" />}
          >
            <Hand cards={mine ? [mine] : []} renderer={standardFaceRenderer} testId="player-hand" />
          </PlayerSpot>
        }
        controls={
          over ? null : <ActionBar actions={actions} onAction={(id) => void act({ type: id } as HighCardAction)} />
        }
      />
    </div>
  )
}

/** Routable at /games/high-card but never listed in the lobby or history filters. */
export const highCardPlugin = definePlugin({
  rules: highCard,
  Table: HighCardTable,
  faceRenderer: standardFaceRenderer,
  juice,
})

import type { CardView, GameEvent, Seat, SeatId, StandardFace } from '@neon-cards/engine'
import { useState } from 'react'
import type { JuiceMap, OpponentSeatModel } from '../api'
import { useBatchPlayback } from '../juice/provider'
import { ScoreBadge, StatusBadge } from '../primitives/badge'
import { ChipStack } from '../primitives/chips'
import { ActionBar } from '../primitives/controls'
import { DealerTray } from '../primitives/dealer-tray'
import { Hand } from '../primitives/hand'
import { OpponentRows } from '../primitives/opponent-rows'
import { standardFaceRenderer } from '../primitives/standard-face'
import { PlayerSpot, TableLayout } from '../primitives/table-layout'

type Card = CardView<StandardFace>
interface Model {
  hands: Record<SeatId, Card[]>
  status: Record<SeatId, string>
}

const seats: Seat[] = [
  { id: 'you', kind: 'human', name: 'YOU' },
  { id: 'cpu1', kind: 'cpu', name: 'ADA', difficulty: 'easy' },
  { id: 'cpu2', kind: 'cpu', name: 'BIX', difficulty: 'hard' },
]

const face = (code: string): StandardFace => ({ rank: code.slice(0, -1) as StandardFace['rank'], suit: code.slice(-1) as StandardFace['suit'] })
const deal = (seat: SeatId, id: string, code: string | null): GameEvent => ({ type: 'deal', seat, card: { id, deck: 'standard52', face: code ? face(code) : null } })

const round: GameEvent[] = [
  deal('you', 'y1', '9H'),
  deal('cpu1', 'a1', '10S'),
  deal('cpu2', 'b1', '7D'),
  deal('house', 'd1', 'QC'),
  deal('you', 'y2', 'AS'),
  deal('cpu1', 'a2', '6C'),
  deal('cpu2', 'b2', 'KH'),
  deal('house', 'hole', null),
  { type: 'turn', seat: 'cpu1' },
  deal('cpu1', 'a3', '9D'),
  { type: 'bust', seat: 'cpu1' },
  { type: 'turn', seat: 'cpu2' },
  { type: 'stand', seat: 'cpu2' },
  { type: 'reveal', seat: 'house', card: { id: 'hole', deck: 'standard52', face: face('7S') } },
  { type: 'handResult', seat: 'you', result: 'win', delta: 50 },
]

const empty = (): Model => ({ hands: {}, status: {} })

function applyEvent(m: Model, e: GameEvent): Model {
  const seat = e.seat ?? ''
  const card = e.card as Card | undefined
  if (e.type === 'deal' && card) return { ...m, hands: { ...m.hands, [seat]: [...(m.hands[seat] ?? []), card] } }
  if (e.type === 'reveal' && card) return { ...m, hands: { ...m.hands, [seat]: (m.hands[seat] ?? []).map((c) => (c.id === card.id ? card : c)) } }
  if (e.type === 'bust') return { ...m, status: { ...m.status, [seat]: 'BUST' } }
  if (e.type === 'stand') return { ...m, status: { ...m.status, [seat]: 'STAND' } }
  if (e.type === 'handResult') return { ...m, status: { ...m.status, [seat]: 'WIN' } }
  return m
}

const juice: JuiceMap = {
  deal: (e, kit) => {
    kit.sfx('card')
    return kit.deal(`card-${(e.card as Card).id}`)
  },
  reveal: (e, kit) => {
    kit.sfx('flip')
    return kit.flip(`card-${(e.card as Card).id}`)
  },
  bust: async (e, kit) => {
    kit.sfx('bust')
    await Promise.all([kit.shake('small', `seat-${e.seat ?? ''}`), kit.flash('bust', `seat-${e.seat ?? ''}`)])
  },
  handResult: async (_e, kit) => {
    kit.sfx('win')
    await Promise.all([
      kit.numberPop('+$50', { tone: 'gold' }),
      kit.chipsToPlayer([25, 25], { from: 'pot', to: 'player-spot' }),
      kit.badgePulse('player-total'),
    ])
  },
}

export function JuiceScene() {
  const [model, setModel] = useState(empty)
  const [batch, setBatch] = useState({ id: 0, events: [] as GameEvent[] })
  const playback = useBatchPlayback(batch, { juice, seats, apply: (e) => setModel((m) => applyEvent(m, e)) })
  const replay = () => {
    setModel(empty())
    setBatch((b) => ({ id: b.id + 1, events: round }))
  }
  const opponents: OpponentSeatModel<StandardFace>[] = seats
    .filter((s) => s.kind === 'cpu')
    .map((seat) => {
      const status = model.status[seat.id]
      return {
        seat,
        cards: model.hands[seat.id] ?? [],
        ...(status ? { status } : playback.actingSeat === seat.id && playback.thinking ? { status: 'THINKING' } : {}),
        state: status === 'BUST' ? 'bust' : playback.actingSeat === seat.id ? 'active' : 'waiting',
      }
    })
  const done = model.status.you === 'WIN'
  return (
    <div data-testid="juice-demo" data-playing={playback.playing} data-acting={playback.actingSeat ?? ''} style={{ display: 'contents' }}>
      <TableLayout
        top={
          <div className="nc-gallery-stack">
            <OpponentRows seats={opponents} renderer={standardFaceRenderer} />
            <DealerTray cards={model.hands.house ?? []} renderer={standardFaceRenderer} placeholder="PRESS DEAL" />
          </div>
        }
        middle={done ? <StatusBadge tone="gold">YOU WIN</StatusBadge> : <ChipStack chips={[25, 25]} />}
        bottom={
          <PlayerSpot state={done ? 'win' : 'idle'} badge={<ScoreBadge value={(model.hands.you ?? []).length ? 20 : ''} testId="player-total" />}>
            <Hand cards={model.hands.you ?? []} renderer={standardFaceRenderer} testId="player-hand" />
          </PlayerSpot>
        }
        controls={<ActionBar actions={[{ id: 'deal', label: 'DEAL', primary: true, disabled: playback.playing }]} onAction={replay} />}
      />
    </div>
  )
}

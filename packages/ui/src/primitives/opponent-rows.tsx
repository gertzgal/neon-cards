import type { Difficulty } from '@neon-cards/engine'
import type { OpponentRowsProps, OpponentSeatModel, CardFaceRenderer } from '../api'
import { ScoreBadge } from './badge'
import { Hand } from './hand'

const difficultyLevel: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

/** Three pixel pips, lit to the seat's difficulty, with its name for screen readers and tests. */
export function DifficultyPip({ difficulty }: { difficulty: Difficulty }) {
  const level = difficultyLevel[difficulty]
  return (
    <span className="nc-pips" data-difficulty={difficulty} title={difficulty} aria-label={`${difficulty} CPU`}>
      {[1, 2, 3].map((n) => (
        <i key={n} data-on={n <= level ? 'true' : undefined} />
      ))}
      <b>{difficulty.toUpperCase()}</b>
    </span>
  )
}

function OpponentSeat<Face>({ model, renderer }: { model: OpponentSeatModel<Face>; renderer: CardFaceRenderer<Face> }) {
  const { seat, cards, total, status, state } = model
  const stateProp = state ? { state } : {}
  return (
    <div className="nc-seat" data-testid={`seat-${seat.id}`} data-state={state} data-kind={seat.kind}>
      <div className="nc-seat-head">
        <span className="nc-seat-name">{seat.name}</span>
        {seat.difficulty && <DifficultyPip difficulty={seat.difficulty} />}
      </div>
      <div className="nc-seat-body">
        <Hand cards={cards} renderer={renderer} size="compact" testId={`seat-${seat.id}-hand`} {...stateProp} />
        <ScoreBadge value={total ?? null} tone="cyan" size="sm" testId={`seat-${seat.id}-total`} {...stateProp} />
      </div>
      <div className="nc-seat-status" data-testid={`seat-${seat.id}-status`}>
        {status ?? ''}
      </div>
    </div>
  )
}

/** The top zone for multi-seat games: slim stacked rows on phone, side-by-side seats on desktop. */
export function OpponentRows<Face>({ seats, renderer }: OpponentRowsProps<Face>) {
  return (
    <div className="nc-opponents" data-testid="opponent-rows" data-count={seats.length}>
      {seats.map((model) => (
        <OpponentSeat key={model.seat.id} model={model} renderer={renderer} />
      ))}
    </div>
  )
}

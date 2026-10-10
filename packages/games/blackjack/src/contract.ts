// Mirrors the core shapes in docs/architecture.md until packages/engine lands on main.
export type Rng = { next(): number; int(maxExclusive: number): number; state(): string }

export interface Card<Face = unknown> {
  id: string
  deck: string
  face: Face
}

export interface DeckSpec<Face> {
  id: string
  build(): Face[]
}

export type SeatId = string

export interface Seat {
  id: SeatId
  kind: 'human' | 'cpu' | 'house'
  name: string
}

export type GameEvent = { type: string; seat?: SeatId; [k: string]: unknown }

export interface Settlement {
  seat: SeatId
  delta: number
}

export type Phase = 'betting' | 'playing' | 'settling' | 'over'

export interface GameDefinition<Config, State, Action, View, Face> {
  id: string
  name: string
  version: number
  deck: DeckSpec<Face>
  seats: { min: number; max: number }
  defaultConfig: Config
  setup(config: Config, seats: Seat[], rng: Rng): State
  legalActions(state: State, seat: SeatId): Action[]
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }
  view(state: State, seat: SeatId): View
  phase(state: State): Phase
  settle(state: State): Settlement[]
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function buildShoe<Face>(spec: DeckSpec<Face>, copies: number, rng: Rng): Card<Face>[] {
  const faces: Face[] = []
  for (let i = 0; i < copies; i++) faces.push(...spec.build())
  return shuffle(faces, rng).map((face, i) => ({ id: `${spec.id}-${i}`, deck: spec.id, face }))
}

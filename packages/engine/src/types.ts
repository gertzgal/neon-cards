// Core data shapes from docs/architecture.md. Change them there first.

export interface Rng {
  next(): number
  int(maxExclusive: number): number
  state(): string
}

// `id` is unique per physical card in the shoe so animations can track it.
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

export type Difficulty = 'easy' | 'medium' | 'hard'

// 'house' seats are played by the rules inside apply(), never by a Policy.
export interface Seat {
  id: SeatId
  kind: 'human' | 'cpu' | 'house'
  name: string
  difficulty?: Difficulty
}

export type GameEvent = { type: string; seat?: SeatId; [k: string]: unknown }

/** `delta` is in the game's economy unit: chips or points. */
export interface Settlement {
  seat: SeatId
  delta: number
}

export type GamePhase = 'betting' | 'playing' | 'settling' | 'over'

export interface GameDefinition<Config, State, Action, View, Face> {
  id: string
  name: string
  version: number
  deck: DeckSpec<Face>
  seats: { min: number; max: number }
  defaultConfig: Config
  /** Validates client-sent config at the API boundary. Throws on invalid input. */
  parseConfig(input: unknown): Config
  /** Seats in turn order. */
  seatsFor(config: Config): Seat[]
  setup(config: Config, seats: Seat[], rng: Rng): State
  /** Never a 'house' seat. Null while nobody can act. */
  toAct(state: State): SeatId | null
  legalActions(state: State, seat: SeatId): Action[]
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }
  /** Must hide hidden information (hole card, shoe order, other seats' hidden cards). */
  view(state: State, seat: SeatId): View
  phase(state: State): GamePhase
  /** Valid once phase is 'settling'. */
  settle(state: State): Settlement[]
}

export interface Policy<View, Action> {
  choose(view: View, legal: Action[], rng: Rng): Action
}

export type Policies<View, Action> = Record<Difficulty, Policy<View, Action>>

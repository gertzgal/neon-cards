// Core data shapes from docs/architecture.md. Change them there first.

export interface Rng {
  next(): number
  int(maxExclusive: number): number
  state(): string
}

// `id` is unique per physical card in the shoe and never encodes the face, so a face-down card can keep its id.
export interface Card<Face = unknown> {
  id: string
  deck: string
  face: Face
}

/** What views and events carry. `face: null` is a face-down card. */
export type CardView<Face = unknown> = Card<Face | null>

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

/** Public: never carries information hidden from any seat. */
export type GameEvent = { type: string; seat?: SeatId; [k: string]: unknown }

export type TurnEvent = { type: 'turn'; seat: SeatId }

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
  /** Counts every seat seatsFor() can return, house seats included. */
  seats: { min: number; max: number }
  defaultConfig: Config
  /** Validates client-sent config at the API boundary. Throws on invalid input. */
  parseConfig(input: unknown): Config
  /** Seats in turn order. */
  seatsFor(config: Config): Seat[]
  setup(config: Config, seats: Seat[], rng: Rng): State
  /** Never a 'house' seat. Null while nobody can act. */
  toAct(state: State): SeatId | null
  /** The menu the UI renders and Policies pick from. [] for any seat that is not toAct(state). */
  legalActions(state: State, seat: SeatId): Action[]
  /** Never mutates `state`. Throws IllegalActionError for anything it rejects. */
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }
  /** Must hide hidden information (hole card, shoe order, other seats' hidden cards). */
  view(state: State, seat: SeatId): View
  phase(state: State): GamePhase
  /** Valid once phase is 'settling', or 'over' reached straight from play. */
  settle(state: State): Settlement[]
}

export interface Policy<View, Action> {
  choose(view: View, legal: Action[], rng: Rng): Action
}

export type Policies<View, Action> = Record<Difficulty, Policy<View, Action>>

export interface SettingSpec {
  key: string
  label: string
  options: { value: string | number; label: string }[]
}

export interface GameMeta {
  title: string
  description: string
  /** 'chips' games bet from and settle into the wallet; 'score' games never touch it. */
  economy: 'chips' | 'score'
  minBet?: number
  /** Shown on the pre-game sheet; values land in config[key]. */
  settings?: SettingSpec[]
}

/** What `@neon-cards/game-<id>/rules` exports. Pure: the Worker runs it. */
export interface GameRules<Config = unknown, State = unknown, Action = unknown, View = unknown, Face = unknown> {
  definition: GameDefinition<Config, State, Action, View, Face>
  /** Required when seatsFor() can return 'cpu' seats. */
  policies?: Policies<View, Action>
  meta: GameMeta
}

/** Everything the server persists for a live session, as plain JSON. */
export interface Match<Config = unknown, State = unknown> {
  gameId: string
  version: number
  seed: string
  config: Config
  seats: Seat[]
  state: State
  /** The deck Rng's state(). */
  rng: string
  /** Next action seq, equal to the action log's length. */
  seq: number
}

export interface ActionRecord<Action = unknown> {
  seq: number
  seat: SeatId
  action: Action
}

export interface Step<Config = unknown, State = unknown, Action = unknown> {
  match: Match<Config, State>
  /** The human action's events, then per CPU action a TurnEvent followed by its events. */
  events: GameEvent[]
  /** Every action applied in this step, human and CPU, in order. */
  log: ActionRecord<Action>[]
  /** One entry per round that ended in this step, in order. */
  rounds: Settlement[][]
}

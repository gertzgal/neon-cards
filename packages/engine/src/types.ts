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
  /** Counts every seat a roster can return, house seats included. */
  seats: { min: number; max: number }
  /** Dealer seats the roster appends. Empty for score games. */
  house: readonly { id: string; name: string }[]
  defaultConfig: Config
  /** Validates client-sent config at the API boundary. Throws on invalid input. */
  parseConfig(input: unknown): Config
  setup(config: Config, seats: Seat[], rng: Rng): State
  /** Never a 'house' seat. Null while nobody can act. */
  toAct(state: State): SeatId | null
  /** The menu the UI renders and Policies pick from. [] for any seat that is not toAct(state). */
  legalActions(state: State, seat: SeatId): Action[]
  /** Never mutates `state`. Throws IllegalActionError for anything it rejects. */
  apply(state: State, seat: SeatId, action: Action, rng: Rng): { state: State; events: GameEvent[] }
  /**
   * The action that opens a round when nobody is to act. Null while a hand is in progress.
   * Absent until a game opts in. The room calls this. The CPU loop does not.
   */
  opening?(state: State): Action | null
  /** Must hide hidden information (hole card, shoe order, other seats' hidden cards). */
  view(state: State, seat: SeatId): View
  phase(state: State): GamePhase
  /** Valid once phase is 'settling', or 'over' reached straight from play. */
  settle(state: State): Settlement[]
  /**
   * Chips `seat` has committed to a round that has not settled yet, which it forfeits if the session is
   * abandoned; 0 when no round is in play. Required for 'chips' games.
   */
  staked?(state: State, seat: SeatId): number
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
  /**
   * Action types that are a short window. A timeout plays `decline` and does not
   * call the policy or count a missed turn.
   */
  quick?: { types: readonly string[]; decline: unknown }
}

/** What `@neon-cards/game-<id>/rules` exports. Pure: the Worker runs it. */
export interface GameRules<Config = unknown, State = unknown, Action = unknown, View = unknown, Face = unknown> {
  definition: GameDefinition<Config, State, Action, View, Face>
  /** Required when a roster can return 'cpu' seats. */
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
  /**
   * Who chose the action when it was applied. Replay uses this instead of the seat's later kind.
   * Logs written before this field existed omit it. Replay then uses the seat's kind.
   */
  kind?: 'human' | 'cpu'
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

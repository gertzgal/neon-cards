/**
 * Types and signatures only. Nothing in this file runs, and the app does not import it.
 *
 * Caller, the room object (later, not this pull request):
 *
 *   const seats = seatList(request)
 *   const started = beginMatch({ kind: 'room', rules, request, seed })
 *   const next = command(room, playerId, generation, command)
 *   const woke = alarm(room, generation, now)
 *   const frame = frameFor(room, playerId)
 *   const restored = foldRows(rows)
 *
 * Caller, solo HTTP, same roster, no Room value:
 *
 *   const seats = seatList(soloRequest)
 *   const started = beginMatch({ kind: 'solo', rules, request: soloRequest, seed })
 *
 * A Flip 7 author does not import this file. setup(config, seats, rng) already
 * takes the Seat[] that seatList built. The game never sees a room, a code, or a host.
 *
 * Wire JSON is parsed at the worker boundary into ClientCommand. Illegal pairs
 * (a deal from a guest, settings during a hand) are rejected by command, not by
 * a second type, because the socket is one JSON union.
 */

declare const playerIdBrand: unique symbol
declare const seatIdBrand: unique symbol
declare const roomCodeBrand: unique symbol
declare const commandIdBrand: unique symbol
declare const generationBrand: unique symbol

export type PlayerId = string & { readonly [playerIdBrand]: true }
export type SeatId = string & { readonly [seatIdBrand]: true }
export type RoomCode = string & { readonly [roomCodeBrand]: true }
export type CommandId = string & { readonly [commandIdBrand]: true }
export type RoomGeneration = number & { readonly [generationBrand]: true }

export type Difficulty = 'easy' | 'medium' | 'hard'

/** Seat the engine stores. difficulty is present on cpu seats so a policy can run. */
export interface EngineSeat {
  id: SeatId
  kind: 'human' | 'cpu' | 'house'
  name: string
  difficulty?: Difficulty
}

/**
 * Seat the frame shows. An away friend is kind cpu with their nickname and no
 * difficulty, so the bot mark draws and DifficultyPip stays quiet.
 */
export interface DisplaySeat {
  id: SeatId
  kind: 'human' | 'cpu' | 'house'
  name: string
  difficulty?: Difficulty
}

export interface LobbyHuman {
  kind: 'human'
  seatId: SeatId
  playerId: PlayerId
  nickname: string
}

export interface LiveHuman {
  kind: 'human'
  seatId: SeatId
  playerId: PlayerId
  nickname: string
  misses: 0 | 1
}

/** away is the player a CPU is covering. Null means the seat was filled as a CPU. */
export interface CpuChair {
  kind: 'cpu'
  seatId: SeatId
  name: string
  difficulty: Difficulty
  away: PlayerId | null
}

export interface HouseChair {
  kind: 'house'
  seatId: SeatId
  name: string
}

export interface OpenChair {
  kind: 'open'
  seatId: SeatId
}

export type LobbyChair = LobbyHuman | OpenChair
export type LiveChair = LiveHuman | CpuChair | HouseChair

/** One watcher reserving one CPU seat for the next round boundary. */
export interface Hold {
  playerId: PlayerId
  seatId: SeatId
}

/** Positive counts only. A player at zero sockets is removed, which arms host grace. */
export type Presence = readonly { playerId: PlayerId; sockets: number }[]

export interface TurnDeadline {
  seatId: SeatId
  dueAt: number
}

export interface QuickDeadline {
  seatId: SeatId
  dueAt: number
}

export interface HostGrace {
  dueAt: number
}

/** At most one of turn and quick is set. Host grace may overlap either. */
export interface Deadlines {
  turn: TurnDeadline | null
  quick: QuickDeadline | null
  hostGrace: HostGrace | null
}

export interface RememberedCommand {
  commandId: CommandId
  playerId: PlayerId
  frame: Frame
}

export interface SeqFrame {
  seq: number
  playerId: PlayerId
  frame: Frame
}

/**
 * Engine match as the room stores it. frameFor is the only function that
 * turns private into a view. Retry rows store Frame, never this value.
 */
export interface StoredMatch {
  seq: number
  seed: string
  seats: readonly EngineSeat[]
  private: unknown
}

export interface RoomEmpty {
  kind: 'empty'
}

export interface RoomLobby {
  kind: 'lobby'
  code: RoomCode
  gameId: string
  hostId: PlayerId
  config: unknown
  chairs: readonly LobbyChair[]
  watching: readonly PlayerId[]
  present: Presence
  generation: RoomGeneration
  remembered: readonly RememberedCommand[]
}

export interface RoomLive {
  kind: 'live'
  code: RoomCode
  gameId: string
  hostId: PlayerId
  historyId: string
  config: unknown
  chairs: readonly LiveChair[]
  watching: readonly PlayerId[]
  holds: readonly Hold[]
  present: Presence
  deadlines: Deadlines
  match: StoredMatch
  generation: RoomGeneration
  remembered: readonly RememberedCommand[]
  seqFrames: readonly SeqFrame[]
  /** playing is a hand. between is ready or roundOver. over is gameOver. */
  phase: 'playing' | 'between' | 'over'
}

export interface RoomClosed {
  kind: 'closed'
}

export type Room = RoomEmpty | RoomLobby | RoomLive | RoomClosed

export type ClientCommand =
  | { type: 'act'; commandId: CommandId; seq: number; action: unknown }
  | { type: 'deal'; commandId: CommandId }
  | { type: 'settings'; commandId: CommandId; config: unknown }
  | { type: 'rematch'; commandId: CommandId }
  | { type: 'back'; commandId: CommandId }
  | { type: 'sit'; commandId: CommandId; seatId: SeatId }
  | { type: 'leave'; commandId: CommandId }
  | { type: 'watch'; commandId: CommandId }

export interface LobbyFrame {
  type: 'lobby'
  code: RoomCode
  gameId: string
  host: boolean
  you: SeatId | null
  seats: readonly DisplaySeat[]
  eyes: number
  canOpen: boolean
}

export interface LiveFrame {
  type: 'live'
  code: RoomCode
  gameId: string
  host: boolean
  you: SeatId | null
  canAct: boolean
  canOpen: boolean
  seats: readonly DisplaySeat[]
  eyes: number
  seq: number
  view: unknown
  events: unknown
  snap: boolean
  deadline: number | null
}

export interface ClosedFrame {
  type: 'closed'
}

export interface RejectedFrame {
  type: 'rejected'
  reason: 'not-your-turn' | 'seq' | 'not-host' | 'closed' | 'illegal' | 'hold' | 'chips'
}

export type Frame = LobbyFrame | LiveFrame | ClosedFrame | RejectedFrame

export interface QuickWindow {
  types: readonly string[]
  decline: unknown
}

/**
 * The slice of GameDefinition the room calls. opening is proposed, not on
 * the engine today. economy chips is rejected for kind room.
 */
export interface RoomRules {
  id: string
  version: number
  seats: { min: number; max: number }
  economy: 'score' | 'chips'
  house: readonly { name: string }[]
  opening(state: unknown): unknown | null
  quick?: QuickWindow
}

export interface SeatRequest {
  humans: readonly { playerId: PlayerId; nickname: string }[]
  cpuCount: number
  difficulty: Difficulty
  cpuNames: readonly string[]
  house: readonly { name: string }[]
  min: number
  max: number
  /** 0 on a room's first deal. seed % length for solo. 1 on rematch. */
  rotateBy: number
}

export type BeginRequest =
  | { kind: 'solo'; rules: RoomRules; request: SeatRequest; seed: string }
  | {
      kind: 'room'
      rules: RoomRules
      request: SeatRequest
      seed: string
      code: RoomCode
      hostId: PlayerId
    }

export type BeginMatchResult =
  | { ok: true; place: 'solo'; historyId: string; match: StoredMatch }
  | { ok: true; place: 'room'; historyId: string; match: StoredMatch; room: RoomLive }
  | { ok: false; reason: 'chips-room' | 'roster' }

export type CommandResult =
  | { type: 'applied'; room: Room; generation: RoomGeneration }
  | { type: 'replayed'; frame: Frame }
  | { type: 'rejected'; frame: RejectedFrame }

export type AlarmResult =
  | { type: 'applied'; room: Room; generation: RoomGeneration; nextAlarmAt: number | null }
  | { type: 'idle'; nextAlarmAt: number | null }

/** Redacted frames only. private match bytes are not a column. */
export interface StepRow {
  historyId: string
  seq: number
  seat: SeatId
  kind: 'human' | 'cpu'
  action: unknown
  frames: readonly { playerId: PlayerId; frame: Frame }[]
}

export interface SnapshotRow {
  historyId: string
  match: StoredMatch
  room: RoomLive
}

export type FoldRow = { kind: 'step'; row: StepRow } | { kind: 'snapshot'; row: SnapshotRow }

/** Proposed ActionRecord field. Replay reads kind from the log, not from the final roster. */
export interface LoggedAction {
  seq: number
  seat: SeatId
  kind: 'human' | 'cpu'
  action: unknown
}

export declare function seatList(request: SeatRequest): EngineSeat[]

export declare function beginMatch(input: BeginRequest): BeginMatchResult

export declare function command(
  room: RoomLobby | RoomLive,
  actor: PlayerId,
  generation: RoomGeneration,
  command: ClientCommand,
): CommandResult

export declare function alarm(room: RoomLive, generation: RoomGeneration, now: number): AlarmResult

export declare function frameFor(room: Room, playerId: PlayerId): Frame

export declare function foldRows(rows: readonly FoldRow[]): Room

/**
 * Proposed engine entry points. Bodies are not written here.
 * applyOpening applies rules.opening and then the CPU cascade.
 * autoAct plays one policy action for the seat to act, even when that chair is still human.
 * continueMatch runs CPUs until a human or nobody. It does not play opening().
 * replayTail applies a log onto an existing match and does not call setup or a policy.
 */
export declare function applyOpening(rules: RoomRules, match: StoredMatch): StoredMatch
export declare function autoAct(rules: RoomRules, match: StoredMatch, difficulty: Difficulty): StoredMatch
export declare function continueMatch(rules: RoomRules, match: StoredMatch): StoredMatch
export declare function replayTail(rules: RoomRules, match: StoredMatch, log: readonly LoggedAction[]): StoredMatch

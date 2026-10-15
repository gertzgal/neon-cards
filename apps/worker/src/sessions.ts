import {
  act,
  applyOpening,
  matchesOpening,
  soloSeats,
  startMatch,
  type GameEvent,
  type GameRules,
  type Match,
  type Seat,
  type Settlement,
  type Step,
} from '@neon-cards/engine'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { schema, type Db } from './db'
import { readBalance, readWallet, refillAmount, walletDelta, type LedgerReason } from './wallet'

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

/** Error names games and the engine throw, mapped to HTTP status. Matched by name so a game's own subclass still maps. */
function toApiError(err: unknown): unknown {
  if (err instanceof Error && err.name === 'IllegalActionError') return new ApiError(400, err.message)
  if (err instanceof Error && err.name === 'NotYourTurnError') return new ApiError(409, err.message)
  return err
}

export type SessionStatus = 'active' | 'over'

export interface SessionView {
  sessionId: string
  gameId: string
  seats: Seat[]
  view: unknown
  /** The `seq` the next human action must carry. */
  seq: number
  status: SessionStatus
  /** Wallet balance; 'chips' games only. */
  wallet?: number
}

export interface ActionResponse {
  events: GameEvent[]
  view: unknown
  seq: number
  status: SessionStatus
  /** Wallet balance after the step; 'chips' games only. */
  wallet?: number
}

export type Registry = ReadonlyMap<string, GameRules>

export function registry(games: readonly GameRules[]): Registry {
  return new Map(games.map((g) => [g.definition.id, g]))
}

function humanSeat(match: Match): Seat {
  const seat = match.seats.find((s) => s.kind === 'human')
  if (!seat) throw new Error(`${match.gameId} has no human seat`)
  return seat
}

function statusOf(rules: GameRules, match: Match): SessionStatus {
  return rules.definition.phase(match.state) === 'over' ? 'over' : 'active'
}

const isChips = (rules: GameRules) => rules.meta.economy === 'chips'

function rulesFor(games: Registry, gameId: string): GameRules {
  const rules = games.get(gameId)
  if (!rules) throw new ApiError(404, `unknown game "${gameId}"`)
  return rules
}

interface RoundRow {
  id: string
  roundNo: number
  net: number
  summary: unknown
}

interface StepEffects {
  rounds: RoundRow[]
  ledger: { delta: number; reason: LedgerReason; ref: string }[]
  /** Balance after the step for 'chips' games, null for 'score' games. */
  wallet: number | null
}

/**
 * What a Step does to rounds and the wallet. Round nets settle into the wallet; a `refill` event on the
 * human seat refills the wallet only if it is broke, so a wallet already refilled by GET /api/wallet stays put.
 */
function effectsOf(rules: GameRules, step: Step, sessionId: string, roundsSoFar: number, balance: number | null): StepEffects {
  const human = humanSeat(step.match)
  const effects: StepEffects = { rounds: [], ledger: [], wallet: balance }
  step.rounds.forEach((settlements, i) => {
    const roundNo = roundsSoFar + i + 1
    const id = `${sessionId}:${roundNo}`
    const net = balance === null ? 0 : netFor(settlements, human.id)
    const last = i === step.rounds.length - 1
    // A step can run past a round's end (CPU turns into the next round), so only the last round gets the closing view.
    const summary = { settlements, ...(last ? { view: rules.definition.view(step.match.state, human.id) } : {}) }
    effects.rounds.push({ id, roundNo, net, summary })
    if (effects.wallet !== null && net !== 0) {
      effects.ledger.push({ delta: net, reason: 'round', ref: id })
      effects.wallet += net
    }
  })
  if (effects.wallet === null) return effects
  for (const e of step.events) {
    if (e.type !== 'refill' || e.seat !== human.id) continue
    const delta = refillAmount(effects.wallet)
    if (!delta) continue
    effects.ledger.push({ delta, reason: 'refill', ref: sessionId })
    effects.wallet += delta
  }
  return effects
}

/**
 * Persists one engine Step as one D1 batch (a transaction): the new match, every action it applied, its
 * rounds, and its wallet changes. A concurrent request that applied the same `seq` first makes this
 * batch fail on the actions primary key instead of double-applying.
 */
async function persistStep(
  db: Db,
  rules: GameRules,
  playerId: string,
  sessionId: string,
  step: Step,
  effects: StepEffects,
  humanResponse: ActionResponse | null,
  now: number,
) {
  const [first, ...rest] = [
    db
      .update(schema.sessions)
      .set({ stateJson: JSON.stringify(step.match), status: statusOf(rules, step.match) })
      .where(eq(schema.sessions.id, sessionId)),
    ...step.log.map((rec, i) =>
      db.insert(schema.actions).values({
        sessionId,
        seq: rec.seq,
        seat: rec.seat,
        actionJson: JSON.stringify(rec.action),
        responseJson: i === 0 && humanResponse ? JSON.stringify(humanResponse) : null,
        createdAt: now,
      }),
    ),
    ...effects.rounds.map((r) =>
      db.insert(schema.rounds).values({
        id: r.id,
        sessionId,
        roundNo: r.roundNo,
        summaryJson: JSON.stringify(r.summary),
        net: r.net,
        createdAt: now,
      }),
    ),
    ...effects.ledger.flatMap((l) => walletDelta(db, playerId, l.delta, l.reason, l.ref, now)),
  ]
  await db.batch([first, ...rest])
}

const netFor = (settlements: Settlement[], seat: string) =>
  settlements.filter((s) => s.seat === seat).reduce((sum, s) => sum + s.delta, 0)

export async function createSession(
  db: Db,
  games: Registry,
  playerId: string,
  input: { gameId: string; config: unknown; seed?: string | undefined },
): Promise<SessionView & { events: GameEvent[] }> {
  const rules = rulesFor(games, input.gameId)
  const now = Date.now()
  let config: unknown
  let wallet: number | null = null
  const live = isChips(rules) ? await liveChipsSessions(db, games, playerId) : []
  if (isChips(rules)) {
    // The bankroll the wallet will hold once the live sessions below are closed and their stakes forfeited.
    const balance = (await readBalance(db, playerId)) - live.reduce((sum, s) => sum + s.staked, 0)
    wallet = balance + refillAmount(balance)
  }
  try {
    const raw = input.config ?? {}
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('config must be an object')
    config = rules.definition.parseConfig(wallet === null ? raw : { ...raw, bankroll: wallet })
  } catch (err) {
    throw new ApiError(400, `invalid config: ${err instanceof Error ? err.message : String(err)}`)
  }
  const seed = input.seed ?? crypto.randomUUID()
  const sessionId = crypto.randomUUID()
  let step: Step
  try {
    step = startMatch(rules, { config: config, seats: soloSeats(rules.definition, config), seed: seed })
  } catch (err) {
    throw toApiError(err)
  }
  if (isChips(rules)) {
    await closeSessions(db, playerId, live, now)
    wallet = (await readWallet(db, playerId, now)).balance
  }
  await db.insert(schema.sessions).values({
    id: sessionId,
    playerId,
    gameId: rules.definition.id,
    gameVersion: rules.definition.version,
    seed,
    config: JSON.stringify(config),
    stateJson: JSON.stringify(step.match),
    status: statusOf(rules, step.match),
    createdAt: now,
  })
  const effects = effectsOf(rules, step, sessionId, 0, wallet)
  if (step.log.length || effects.rounds.length) {
    await persistStep(db, rules, playerId, sessionId, step, effects, null, now)
  }
  wallet = effects.wallet
  const human = humanSeat(step.match)
  return {
    sessionId,
    gameId: rules.definition.id,
    seats: step.match.seats,
    events: step.events,
    view: rules.definition.view(step.match.state, human.id),
    seq: step.match.seq,
    status: statusOf(rules, step.match),
    ...(wallet === null ? {} : { wallet }),
  }
}

function chipsGames(games: Registry): string[] {
  return [...games.values()].filter(isChips).map((g) => g.definition.id)
}

interface LiveSession {
  id: string
  rules: GameRules
  match: Match
  /** Chips the human has on an unsettled round. */
  staked: number
}

async function liveChipsSessions(db: Db, games: Registry, playerId: string): Promise<LiveSession[]> {
  const rows = await db
    .select({ id: schema.sessions.id, gameId: schema.sessions.gameId, stateJson: schema.sessions.stateJson })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.playerId, playerId),
        eq(schema.sessions.status, 'active'),
        inArray(schema.sessions.gameId, chipsGames(games)),
      ),
    )
    .all()
  return rows.map((row) => {
    const rules = rulesFor(games, row.gameId)
    const match = JSON.parse(row.stateJson) as Match
    return { id: row.id, rules, match, staked: rules.definition.staked?.(match.state, humanSeat(match).id) ?? 0 }
  })
}

/**
 * One live chips session per player: its stack mirrors the wallet, so older ones are closed. A closed session
 * forfeits the chips on its unsettled round, recorded as a lost round, so walking away never undoes a bet.
 */
async function closeSessions(db: Db, playerId: string, live: LiveSession[], now: number) {
  for (const s of live) {
    const close = db.update(schema.sessions).set({ status: 'over' }).where(eq(schema.sessions.id, s.id))
    if (!s.staked) {
      await close
      continue
    }
    const played = await db.select({ n: count() }).from(schema.rounds).where(eq(schema.rounds.sessionId, s.id)).get()
    const roundNo = (played?.n ?? 0) + 1
    const id = `${s.id}:${roundNo}`
    const human = humanSeat(s.match).id
    const summary = {
      settlements: [{ seat: human, delta: -s.staked }],
      view: s.rules.definition.view(s.match.state, human),
      forfeit: true,
    }
    await db.batch([
      close,
      db.insert(schema.rounds).values({ id, sessionId: s.id, roundNo, summaryJson: JSON.stringify(summary), net: -s.staked, createdAt: now }),
      ...walletDelta(db, playerId, -s.staked, 'forfeit', id, now),
    ])
  }
}

interface OwnedSession {
  gameId: string
  gameVersion: number
  stateJson: string
  status: SessionStatus
  /** Joined wallet balance. Null when the player has no wallet row. */
  balance: number | null
  /** Rounds already stored for this session, from the same read. */
  roundCount: number
}

/**
 * One D1 round trip for everything an action needs before the engine runs: the match, the wallet,
 * and how many rounds are already stored. The rounds count rides a subquery so it doesn't wait
 * on its own query; `rounds(session_id, round_no)` is already unique, so the count is an index range.
 */
async function loadOwned(db: Db, playerId: string, sessionId: string): Promise<OwnedSession> {
  const row = await db
    .select({
      gameId: schema.sessions.gameId,
      gameVersion: schema.sessions.gameVersion,
      stateJson: schema.sessions.stateJson,
      status: schema.sessions.status,
      balance: schema.wallets.balance,
      roundCount: sql<number>`(select count(*) from ${schema.rounds} where ${schema.rounds.sessionId} = ${schema.sessions.id})`,
    })
    .from(schema.sessions)
    .leftJoin(schema.wallets, eq(schema.wallets.playerId, schema.sessions.playerId))
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.playerId, playerId)))
    .get()
  if (!row) throw new ApiError(404, 'session not found')
  return { ...row, balance: row.balance ?? null, roundCount: Number(row.roundCount) }
}

function chipsBalance(rules: GameRules, playerId: string, balance: number | null): number | null {
  if (!isChips(rules)) return null
  if (balance === null) throw new Error(`wallet missing for player ${playerId}`)
  return balance
}

export async function getSession(db: Db, games: Registry, playerId: string, sessionId: string): Promise<SessionView> {
  const row = await loadOwned(db, playerId, sessionId)
  const rules = rulesFor(games, row.gameId)
  const match = JSON.parse(row.stateJson) as Match
  const wallet = chipsBalance(rules, playerId, row.balance)
  return {
    sessionId,
    gameId: row.gameId,
    seats: match.seats,
    view: rules.definition.view(match.state, humanSeat(match).id),
    seq: match.seq,
    status: row.status,
    ...(wallet === null ? {} : { wallet }),
  }
}

async function storedResponse(db: Db, sessionId: string, seq: number): Promise<ActionResponse | null> {
  const row = await db
    .select({ responseJson: schema.actions.responseJson })
    .from(schema.actions)
    .where(and(eq(schema.actions.sessionId, sessionId), eq(schema.actions.seq, seq)))
    .get()
  return row?.responseJson ? (JSON.parse(row.responseJson) as ActionResponse) : null
}

export async function postAction(
  db: Db,
  games: Registry,
  playerId: string,
  sessionId: string,
  input: { action: unknown; seq: number },
): Promise<ActionResponse> {
  const row = await loadOwned(db, playerId, sessionId)
  const match = JSON.parse(row.stateJson) as Match
  if (input.seq < match.seq) {
    const stored = await storedResponse(db, sessionId, input.seq)
    if (stored) return stored
    throw new ApiError(409, `seq ${input.seq} was not a human action; next seq is ${match.seq}`)
  }
  if (input.seq > match.seq) throw new ApiError(409, `seq ${input.seq} is ahead; next seq is ${match.seq}`)
  if (row.status !== 'active') throw new ApiError(409, 'session is over')
  const rules = rulesFor(games, row.gameId)
  if (rules.definition.version !== row.gameVersion) throw new ApiError(409, 'session was created by an older game version')
  const human = humanSeat(match)
  let step: Step
  try {
    if (rules.definition.toAct(match.state) === null) {
      if (!matchesOpening(rules, match.state, input.action)) throw new ApiError(400, 'action does not open the round')
      step = applyOpening(rules, match)
    } else {
      step = act(rules, match, human.id, input.action)
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw toApiError(err)
  }
  const balance = chipsBalance(rules, playerId, row.balance)
  const effects = effectsOf(rules, step, sessionId, row.roundCount, balance)
  const response: ActionResponse = {
    events: step.events,
    view: rules.definition.view(step.match.state, human.id),
    seq: step.match.seq,
    status: statusOf(rules, step.match),
    ...(effects.wallet === null ? {} : { wallet: effects.wallet }),
  }
  try {
    await persistStep(db, rules, playerId, sessionId, step, effects, response, Date.now())
  } catch (err) {
    // A concurrent retry of this seq won the race; answer with what it stored.
    const stored = await storedResponse(db, sessionId, input.seq)
    if (stored) return stored
    throw err
  }
  return response
}

export interface HistoryEntry {
  id: string
  sessionId: string
  gameId: string
  roundNo: number
  net: number
  summary: unknown
  createdAt: number
}

export async function history(db: Db, playerId: string, gameId: string | undefined, limit = 50): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      id: schema.rounds.id,
      sessionId: schema.rounds.sessionId,
      gameId: schema.sessions.gameId,
      roundNo: schema.rounds.roundNo,
      net: schema.rounds.net,
      summaryJson: schema.rounds.summaryJson,
      createdAt: schema.rounds.createdAt,
    })
    .from(schema.rounds)
    .innerJoin(schema.sessions, eq(schema.rounds.sessionId, schema.sessions.id))
    .where(and(eq(schema.sessions.playerId, playerId), gameId ? eq(schema.sessions.gameId, gameId) : undefined))
    .orderBy(desc(schema.rounds.createdAt), desc(schema.rounds.roundNo))
    .limit(limit)
    .all()
  return rows.map(({ summaryJson, ...r }) => ({ ...r, summary: JSON.parse(summaryJson) as unknown }))
}

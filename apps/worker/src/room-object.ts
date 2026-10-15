import {
  NotYourTurnError,
  act as playAct,
  applyOpening,
  autoAct,
  continueMatch,
  startMatch,
  type GameRules,
  type Match,
  type Seat,
} from '@neon-cards/engine'
import {
  HOST_GRACE_MS,
  TURN_MS,
  applyHolds,
  addSocket,
  createLobby,
  dropSocket,
  earliest,
  frameAtSeq,
  isLive,
  leave,
  leaveLive,
  liveChairs,
  liveFrame,
  lobbyFrame,
  remember,
  rememberedFrame,
  rotatePlaying,
  roomSeats,
  seatPlayer,
  stripRig,
  wakePlan,
  watch,
  watchLive,
  type EngineMatch,
  type LiveRoom,
  type Lobby,
  type OutFrame,
  type RejectedFrame,
  type RoomSeat,
} from '@neon-cards/room'
import type { Env } from './env'
import { games } from './games'

interface Attachment {
  playerId: string
  connId: string
  nickname: string
}

interface Incoming {
  type?: unknown
  commandId?: unknown
  seq?: unknown
  action?: unknown
  config?: unknown
  seatId?: unknown
}

type Stored = Lobby | LiveRoom | { kind: 'closed'; code: string }

function isLobby(state: Stored): state is Lobby {
  return state.kind === 'lobby'
}

function rulesFor(gameId: string): GameRules | null {
  return games.find((rules) => rules.definition.id === gameId) ?? null
}

function phaseOf(rules: GameRules, state: unknown): LiveRoom['phase'] {
  if (rules.definition.phase(state) === 'over') return 'over'
  if (rules.definition.opening?.(state) != null) return 'between'
  return 'playing'
}

function asMatch(match: EngineMatch): Match {
  return match as Match
}

function storeMatch(match: Match): EngineMatch {
  return {
    gameId: match.gameId,
    version: match.version,
    seed: match.seed,
    config: match.config,
    seats: match.seats.map((seat) => ({
      id: seat.id,
      kind: seat.kind,
      name: seat.name,
      ...(seat.difficulty ? { difficulty: seat.difficulty } : {}),
    })),
    state: match.state,
    rng: match.rng,
    seq: match.seq,
  }
}

function difficultyOf(config: unknown): 'easy' | 'medium' | 'hard' {
  if (typeof config !== 'object' || config === null || !('difficulty' in config)) return 'medium'
  const value = (config as { difficulty: unknown }).difficulty
  return value === 'easy' || value === 'hard' ? value : 'medium'
}

function rejectReason(err: unknown): RejectedFrame['reason'] {
  if (err instanceof NotYourTurnError) return 'not-your-turn'
  return 'illegal'
}

export class RoomObject implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)')
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/init') return this.init(request)
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return this.join(request)
    return new Response('not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = this.attachment(ws)
    if (!att || typeof message !== 'string') return
    let command: Incoming
    try {
      command = JSON.parse(message) as Incoming
    } catch {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const state = this.read()
    if (!state || state.kind === 'closed') {
      this.send(ws, { type: 'closed' })
      return
    }
    const commandId = typeof command.commandId === 'string' ? command.commandId : ''
    if (!commandId) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const prior = rememberedFrame(state.remembered, commandId, att.playerId)
    if (prior) {
      this.send(ws, prior)
      return
    }
    if (command.type === 'deal') {
      await this.deal(ws, att, state, commandId)
      return
    }
    if (command.type === 'act') {
      await this.act(ws, att, state, commandId, command)
      return
    }
    if (command.type === 'settings') {
      await this.settings(ws, att, state, commandId, command.config)
      return
    }
    if (command.type === 'back') {
      await this.back(ws, att, state, commandId)
      return
    }
    if (command.type === 'rematch') {
      await this.rematch(ws, att, state, commandId)
      return
    }
    try {
      if (command.type === 'watch') this.save(isLive(state) ? watchLive(state, att.playerId) : watch(state, att.playerId))
      else if (command.type === 'sit') {
        if (isLive(state)) {
          const reason = this.holdSeat(state, att, typeof command.seatId === 'string' ? command.seatId : '')
          if (reason) {
            this.send(ws, { type: 'rejected', reason })
            return
          }
        } else this.save(seatPlayer(state, att.playerId, att.nickname))
      } else if (command.type === 'leave') {
        const next = isLive(state) ? leaveLive(state, att.playerId) : leave(state, att.playerId)
        if (next.kind === 'closed') {
          await this.closeRoom(state.code)
          return
        }
        this.save(next)
      } else {
        this.send(ws, { type: 'rejected', reason: 'illegal' })
        return
      }
    } catch (err) {
      const reason = err instanceof Error && err.message === 'full' ? 'full' : 'illegal'
      this.send(ws, { type: 'rejected', reason })
      return
    }
    await this.arm(this.read())
    this.publish()
  }

  async alarm(info?: { isRetry?: boolean }): Promise<void> {
    const state = this.read()
    if (!state || !isLive(state)) return
    const now = Date.now()
    const next = earliest(state.deadlines)
    if (info?.isRetry && (next === null || next > now)) return
    const plan = wakePlan(state.deadlines, now)
    if (plan.close) {
      await this.closeRoom(state.code)
      return
    }
    if (!plan.turn && !plan.quick) {
      await this.arm(state)
      return
    }
    const rules = rulesFor(state.gameId)
    if (!rules) return
    let room = state
    if (plan.turn) room = this.miss(rules, room, now)
    if (plan.quick) room = { ...room, deadlines: { ...room.deadlines, quick: null } }
    room = this.settleHolds(room)
    const saved = { ...room, generation: room.generation + 1 }
    this.save(saved)
    await this.arm(saved)
    this.publish(undefined, room.events)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = this.attachment(ws)
    const state = this.read()
    if (!att || !state || state.kind === 'closed') return
    this.save(this.withGrace(dropSocket(state, att.playerId), att.playerId))
    await this.arm(this.read())
    this.publish()
  }

  private async init(request: Request): Promise<Response> {
    const existing = this.read()
    if (existing) return Response.json(this.frameFor(existing, '', false, []))
    const body = (await request.json()) as { code: string; gameId: string; hostId: string; nickname: string; seats: number }
    const lobby = createLobby(body)
    this.save(lobby)
    return Response.json(lobbyFrame(lobby, body.hostId))
  }

  private async join(request: Request): Promise<Response> {
    const playerId = playerFrom(request)
    const nickname = new URL(request.url).searchParams.get('nickname')
    if (!playerId || !nickname) return new Response('missing player', { status: 401 })
    const state = this.read()
    if (!state || state.kind === 'closed') return Response.json({ type: 'closed' }, { status: 409 })
    let next: Lobby | LiveRoom
    if (isLobby(state)) {
      try {
        next = addSocket(seatPlayer(state, playerId, nickname), playerId)
      } catch {
        return Response.json({ type: 'rejected', reason: 'full' }, { status: 409 })
      }
    } else {
      const seated = state.chairs.some((chair) => chair.kind === 'human' && chair.playerId === playerId)
      const watching = seated || state.watching.includes(playerId) ? state : { ...state, watching: [...state.watching, playerId] }
      next = addSocket(watching, playerId)
      if (playerId === next.hostId) next = { ...next, deadlines: { ...next.deadlines, hostGrace: null } }
    }
    this.save(next)
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    if (!client || !server) throw new Error('websocket pair')
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId, connId: crypto.randomUUID(), nickname } satisfies Attachment)
    await this.arm(next)
    this.publish(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  private async deal(ws: WebSocket, att: Attachment, state: Lobby | LiveRoom, commandId: string): Promise<void> {
    if (att.playerId !== state.hostId) {
      this.send(ws, { type: 'rejected', reason: 'not-host' })
      return
    }
    const rules = rulesFor(state.gameId)
    if (!rules) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    try {
      if (isLobby(state)) await this.openMatch(rules, state, att.playerId, commandId)
      else await this.dealAgain(rules, state, att.playerId, commandId)
    } catch (err) {
      this.send(ws, { type: 'rejected', reason: rejectReason(err) })
    }
  }

  private async openMatch(rules: GameRules, lobby: Lobby, playerId: string, commandId: string): Promise<void> {
    const config = rules.definition.parseConfig(stripRig(lobby.config, this.env.DEV_RIG === '1'))
    const playing = roomSeats(lobby, difficultyOf(config))
    const house: RoomSeat[] = rules.definition.house.map((seat) => ({ id: seat.id, kind: 'house', name: seat.name }))
    const seats: Seat[] = [...playing, ...house]
    const seed = crypto.randomUUID()
    const started = startMatch(rules, { config, seats, seed })
    const step = applyOpening(rules, started.match)
    const live: LiveRoom = {
      kind: 'live',
      code: lobby.code,
      gameId: lobby.gameId,
      hostId: lobby.hostId,
      historyId: crypto.randomUUID(),
      config,
      chairs: liveChairs(lobby.chairs, [...playing, ...house]),
      watching: lobby.watching,
      holds: [],
      present: lobby.present,
      deadlines: { turn: null, quick: null, hostGrace: null },
      match: storeMatch(step.match),
      generation: lobby.generation,
      remembered: lobby.remembered,
      seqFrames: [],
      phase: phaseOf(rules, step.match.state),
      events: step.events,
    }
    await this.commit(rules, live, playerId, commandId, 0, step.events)
  }

  private async dealAgain(rules: GameRules, room: LiveRoom, playerId: string, commandId: string): Promise<void> {
    const settled = this.settleHolds(room)
    if (settled.phase !== 'between' || rules.definition.opening?.(settled.match.state) == null) throw new Error('illegal')
    const step = applyOpening(rules, asMatch(settled.match))
    const live: LiveRoom = {
      ...settled,
      match: storeMatch(step.match),
      phase: phaseOf(rules, step.match.state),
      events: step.events,
    }
    await this.commit(rules, live, playerId, commandId, settled.match.seq, step.events)
  }

  private async act(ws: WebSocket, att: Attachment, state: Lobby | LiveRoom, commandId: string, command: Incoming): Promise<void> {
    if (!isLive(state) || state.phase !== 'playing') {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const rules = rulesFor(state.gameId)
    if (!rules) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const chair = state.chairs.find((item) => item.kind === 'human' && item.playerId === att.playerId)
    const toAct = rules.definition.toAct(state.match.state)
    if (!chair || chair.seatId !== toAct) {
      this.send(ws, { type: 'rejected', reason: 'not-your-turn' })
      return
    }
    if (typeof command.seq !== 'number' || !Number.isInteger(command.seq)) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    if (command.seq > state.match.seq) {
      this.send(ws, { type: 'rejected', reason: 'seq' })
      return
    }
    if (command.seq < state.match.seq) {
      const stored = frameAtSeq(state.seqFrames, command.seq, att.playerId)
      this.send(ws, stored ?? { type: 'rejected', reason: 'seq' })
      return
    }
    try {
      const step = playAct(rules, asMatch(state.match), chair.seatId, command.action)
      const live: LiveRoom = {
        ...state,
        match: storeMatch(step.match),
        phase: phaseOf(rules, step.match.state),
        events: step.events,
      }
      await this.commit(rules, live, att.playerId, commandId, command.seq, step.events)
    } catch (err) {
      this.send(ws, { type: 'rejected', reason: rejectReason(err) })
    }
  }

  private settings(ws: WebSocket, att: Attachment, state: Lobby | LiveRoom, commandId: string, config: unknown): void {
    if (!isLobby(state)) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    if (att.playerId !== state.hostId) {
      this.send(ws, { type: 'rejected', reason: 'not-host' })
      return
    }
    const rules = rulesFor(state.gameId)
    if (!rules) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    try {
      const nextConfig = rules.definition.parseConfig(stripRig(config, this.env.DEV_RIG === '1'))
      const next = remember({ ...state, config: nextConfig }, commandId, att.playerId, lobbyFrame(state, att.playerId), null)
      this.save(next)
      this.publish()
    } catch {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
    }
  }

  private async commit(rules: GameRules, room: LiveRoom, playerId: string, commandId: string, seq: number, events: unknown[]): Promise<void> {
    const scheduled = this.schedule(rules, this.settleHolds(room), Date.now())
    const frame = this.liveFor(rules, scheduled, playerId, events, false)
    const saved = remember({ ...scheduled, events }, commandId, playerId, frame, seq)
    this.save(saved)
    await this.arm(saved)
    this.publish(undefined, events)
  }

  private schedule(rules: GameRules, room: LiveRoom, now: number): LiveRoom {
    const toAct = rules.definition.toAct(room.match.state)
    const human = room.chairs.find((chair) => chair.kind === 'human' && chair.seatId === toAct)
    const turn = human ? { seatId: human.seatId, dueAt: now + TURN_MS } : null
    return { ...room, deadlines: { ...room.deadlines, turn } }
  }

  private filler(room: LiveRoom): 'easy' | 'medium' | 'hard' {
    for (const chair of room.chairs) if (chair.kind === 'cpu') return chair.difficulty
    return difficultyOf(room.config)
  }

  private miss(rules: GameRules, room: LiveRoom, now: number): LiveRoom {
    const toAct = rules.definition.toAct(room.match.state)
    const chair = room.chairs.find((item) => item.seatId === toAct)
    if (!toAct || chair?.kind !== 'human') {
      return this.schedule(rules, { ...room, deadlines: { ...room.deadlines, turn: null } }, now)
    }
    const difficulty = this.filler(room)
    if (chair.misses === 0) {
      const step = autoAct(rules, asMatch(room.match), difficulty)
      const chairs = room.chairs.map((item) =>
        item.kind === 'human' && item.seatId === chair.seatId ? { ...item, misses: 1 as const } : item,
      )
      return this.schedule(
        rules,
        { ...room, chairs, match: storeMatch(step.match), phase: phaseOf(rules, step.match.state), events: step.events },
        now,
      )
    }
    const chairs = room.chairs.map((item) =>
      item.seatId === chair.seatId
        ? { kind: 'cpu' as const, seatId: chair.seatId, name: chair.nickname, difficulty, away: chair.playerId }
        : item,
    )
    const seats = room.match.seats.map((seat) =>
      seat.id === chair.seatId ? { id: seat.id, kind: 'cpu' as const, name: chair.nickname, difficulty } : seat,
    )
    const step = continueMatch(rules, { ...asMatch(room.match), seats })
    return this.schedule(
      rules,
      { ...room, chairs, match: storeMatch(step.match), phase: phaseOf(rules, step.match.state), events: step.events },
      now,
    )
  }

  private withGrace(state: Stored, playerId: string): Stored {
    if (!isLive(state) || playerId !== state.hostId) return state
    const sockets = state.present.find((row) => row.playerId === playerId)?.sockets ?? 0
    const hostGrace = sockets === 0 ? { dueAt: Date.now() + HOST_GRACE_MS } : null
    return { ...state, deadlines: { ...state.deadlines, hostGrace } }
  }

  private async arm(state: Stored | null): Promise<void> {
    if (!state || !isLive(state)) {
      await this.ctx.storage.deleteAlarm()
      return
    }
    const due = earliest(state.deadlines)
    if (due === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(due)
  }

  private async back(ws: WebSocket, att: Attachment, state: Lobby | LiveRoom, commandId: string): Promise<void> {
    if (!isLive(state)) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const rules = rulesFor(state.gameId)
    const chair = state.chairs.find((item) => item.kind === 'cpu' && item.away === att.playerId)
    if (!rules || chair?.kind !== 'cpu') {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const chairs = state.chairs.map((item) =>
      item.seatId === chair.seatId
        ? { kind: 'human' as const, seatId: chair.seatId, playerId: att.playerId, nickname: chair.name, misses: 0 as const }
        : item,
    )
    const seats = state.match.seats.map((seat) => (seat.id === chair.seatId ? { id: seat.id, kind: 'human' as const, name: chair.name } : seat))
    await this.commit(rules, { ...state, chairs, match: { ...state.match, seats } }, att.playerId, commandId, state.match.seq, [])
  }

  private liveFor(rules: GameRules, room: LiveRoom, playerId: string, events: unknown, snap: boolean): OutFrame {
    const chair = room.chairs.find((item) => item.kind === 'human' && item.playerId === playerId)
    const seat = chair?.seatId ?? room.match.seats[0]?.id
    const view = seat ? rules.definition.view(room.match.state, seat) : null
    const toAct = rules.definition.toAct(room.match.state)
    return liveFrame({
      room,
      playerId,
      view,
      events,
      snap,
      canAct: chair?.seatId === toAct && toAct !== null,
      canOpen: playerId === room.hostId && rules.definition.opening?.(room.match.state) != null,
    })
  }

  private holdSeat(room: LiveRoom, att: Attachment, seatId: string): RejectedFrame['reason'] | null {
    if (room.chairs.some((chair) => chair.kind === 'human' && chair.playerId === att.playerId)) return 'illegal'
    if (room.holds.some((hold) => hold.playerId === att.playerId || hold.seatId === seatId)) return 'hold'
    const chair = room.chairs.find((item) => item.seatId === seatId)
    if (chair?.kind !== 'cpu' || chair.away !== null) return 'illegal'
    const hold = { playerId: att.playerId, seatId, nickname: att.nickname }
    if (room.phase === 'playing') {
      this.save({ ...room, holds: [...room.holds, hold] })
      return null
    }
    const applied = applyHolds(room.chairs, [hold])
    this.save({
      ...room,
      chairs: applied.chairs,
      holds: [],
      match: humanSeats(room.match, applied.chairs),
      watching: room.watching.filter((id) => !applied.seated.includes(id)),
    })
    return null
  }

  private settleHolds(room: LiveRoom): LiveRoom {
    if (room.phase === 'playing' || room.holds.length === 0) return room
    const applied = applyHolds(room.chairs, room.holds)
    return {
      ...room,
      chairs: applied.chairs,
      holds: [],
      match: humanSeats(room.match, applied.chairs),
      watching: room.watching.filter((id) => !applied.seated.includes(id)),
    }
  }

  private async rematch(ws: WebSocket, att: Attachment, state: Lobby | LiveRoom, commandId: string): Promise<void> {
    if (!isLive(state)) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    if (att.playerId !== state.hostId) {
      this.send(ws, { type: 'rejected', reason: 'not-host' })
      return
    }
    if (state.phase !== 'over') {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const rules = rulesFor(state.gameId)
    if (!rules) {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const settled = this.settleHolds(state)
    const chairs = rotatePlaying(settled.chairs).map((chair) => (chair.kind === 'human' ? { ...chair, misses: 0 as const } : chair))
    const playing: RoomSeat[] = chairs.map((chair) => {
      if (chair.kind === 'human') return { id: chair.seatId, kind: 'human' as const, name: chair.nickname }
      if (chair.kind === 'cpu') return { id: chair.seatId, kind: 'cpu' as const, name: chair.name, difficulty: chair.difficulty }
      return { id: chair.seatId, kind: 'house' as const, name: chair.name }
    })
    const known = new Set(playing.map((seat) => seat.id))
    const house: RoomSeat[] = rules.definition.house.flatMap((seat) =>
      known.has(seat.id) ? [] : [{ id: seat.id, kind: 'house' as const, name: seat.name }],
    )
    try {
      const config = rules.definition.parseConfig(stripRig(settled.config, this.env.DEV_RIG === '1'))
      const seed = crypto.randomUUID()
      const started = startMatch(rules, { config, seats: [...playing, ...house], seed })
      const step = applyOpening(rules, started.match)
      const watching = settled.watching.filter((id) => !chairs.some((chair) => chair.kind === 'human' && chair.playerId === id))
      const live: LiveRoom = {
        ...settled,
        historyId: crypto.randomUUID(),
        chairs,
        watching,
        holds: [],
        match: storeMatch(step.match),
        remembered: [],
        seqFrames: [],
        phase: phaseOf(rules, step.match.state),
        events: step.events,
        deadlines: { turn: null, quick: null, hostGrace: settled.deadlines.hostGrace },
      }
      await this.commit(rules, live, att.playerId, commandId, 0, step.events)
    } catch (err) {
      this.send(ws, { type: 'rejected', reason: rejectReason(err) })
    }
  }

  private async closeRoom(code: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM room')
    await this.ctx.storage.deleteAlarm()
    await this.env.DB.prepare('UPDATE room_directory SET closed_at = ? WHERE code = ? AND closed_at IS NULL').bind(Date.now(), code).run()
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: 'closed' })
      ws.close(1000, 'closed')
    }
  }

  private read(): Stored | null {
    const rows = this.ctx.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
    const body = rows[0]?.body
    if (!body) return null
    return JSON.parse(body) as Stored
  }

  private save(state: Stored): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room (id, body) VALUES (1, ?)', JSON.stringify(state))
  }

  private publish(snapFor?: WebSocket, events: unknown[] = []): void {
    const state = this.read()
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws)
      if (!att) continue
      this.send(ws, this.frameFor(state, att.playerId, ws === snapFor, events))
    }
  }

  private frameFor(state: Stored | null, playerId: string, snap: boolean, events: unknown[]): OutFrame {
    if (!state || state.kind === 'closed') return { type: 'closed' }
    if (isLobby(state)) return lobbyFrame(state, playerId)
    const rules = rulesFor(state.gameId)
    if (!rules) return { type: 'closed' }
    return this.liveFor(rules, state, playerId, events, snap)
  }

  private attachment(ws: WebSocket): Attachment | null {
    const value = ws.deserializeAttachment() as Attachment | null
    if (!value || typeof value.playerId !== 'string') return null
    return value
  }

  private send(ws: WebSocket, frame: OutFrame): void {
    ws.send(JSON.stringify(frame))
  }
}

function humanSeats(match: EngineMatch, chairs: LiveRoom['chairs']): EngineMatch {
  return {
    ...match,
    seats: match.seats.map((seat) => {
      const chair = chairs.find((item) => item.seatId === seat.id)
      if (chair?.kind === 'human' && seat.kind !== 'human') return { id: seat.id, kind: 'human' as const, name: chair.nickname }
      return seat
    }),
  }
}

function playerFrom(request: Request): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === 'nc_player' && value) return value
  }
  return null
}

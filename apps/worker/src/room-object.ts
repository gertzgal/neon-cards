import {
  addSocket,
  createLobby,
  dropSocket,
  leave,
  lobbyFrame,
  seatPlayer,
  watch,
  type Lobby,
  type OutFrame,
  type RoomState,
} from '@neon-cards/room'
import type { Env } from './env'

interface Attachment {
  playerId: string
  connId: string
  nickname: string
}

function isLobby(state: RoomState): state is Lobby {
  return state.kind === 'lobby'
}

export class RoomObject implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)',
      )
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
    let command: { type?: unknown }
    try {
      command = JSON.parse(message) as { type?: unknown }
    } catch {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    const state = this.read()
    if (!state || !isLobby(state)) {
      this.send(ws, { type: 'closed' })
      return
    }
    if (command.type === 'deal' || command.type === 'settings' || command.type === 'rematch' || command.type === 'act') {
      this.send(ws, { type: 'rejected', reason: 'illegal' })
      return
    }
    try {
      if (command.type === 'watch') this.save(watch(state, att.playerId))
      else if (command.type === 'sit') this.save(seatPlayer(state, att.playerId, att.nickname))
      else if (command.type === 'leave') {
        const next = leave(state, att.playerId)
        if (!isLobby(next)) {
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
    this.broadcast()
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = this.attachment(ws)
    const state = this.read()
    if (!att || !state || !isLobby(state)) return
    this.save(dropSocket(state, att.playerId))
    this.broadcast()
  }

  private async init(request: Request): Promise<Response> {
    if (this.read()) return Response.json(this.frameFor(this.read(), ''))
    const body = (await request.json()) as { code: string; gameId: string; hostId: string; nickname: string; seats: number }
    const lobby = createLobby(body)
    this.save(lobby)
    return Response.json(lobbyFrame(lobby, body.hostId))
  }

  private join(request: Request): Response {
    const playerId = playerFrom(request)
    const nickname = new URL(request.url).searchParams.get('nickname')
    if (!playerId || !nickname) return new Response('missing player', { status: 401 })
    const state = this.read()
    if (!state || !isLobby(state)) return Response.json({ type: 'closed' }, { status: 409 })
    let next: Lobby
    try {
      next = seatPlayer(state, playerId, nickname)
    } catch {
      return Response.json({ type: 'rejected', reason: 'full' }, { status: 409 })
    }
    next = addSocket(next, playerId)
    this.save(next)
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    if (!client || !server) throw new Error('websocket pair')
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId, connId: crypto.randomUUID(), nickname } satisfies Attachment)
    this.broadcast()
    return new Response(null, { status: 101, webSocket: client })
  }

  private async closeRoom(code: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM room')
    await this.env.DB.prepare('UPDATE room_directory SET closed_at = ? WHERE code = ? AND closed_at IS NULL')
      .bind(Date.now(), code)
      .run()
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: 'closed' })
      ws.close(1000, 'closed')
    }
  }

  private read(): RoomState | null {
    const rows = this.ctx.storage.sql.exec<{ body: string }>('SELECT body FROM room WHERE id = 1').toArray()
    const body = rows[0]?.body
    if (!body) return null
    return JSON.parse(body) as RoomState
  }

  private save(state: RoomState): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room (id, body) VALUES (1, ?)', JSON.stringify(state))
  }

  private broadcast(): void {
    const state = this.read()
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.attachment(ws)
      if (!att) continue
      if (!state || !isLobby(state)) this.send(ws, { type: 'closed' })
      else this.send(ws, lobbyFrame(state, att.playerId))
    }
  }

  private frameFor(state: RoomState | null, playerId: string): OutFrame {
    if (!state || !isLobby(state)) return { type: 'closed' }
    return lobbyFrame(state, playerId)
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

function playerFrom(request: Request): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === 'nc_player' && value) return value
  }
  return null
}

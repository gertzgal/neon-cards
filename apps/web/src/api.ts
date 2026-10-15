import type { GameEvent, Seat } from '@neon-cards/engine'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// The Worker mints the anonymous player cookie on the first cookieless request. Concurrent
// first requests would each mint a different player, so every call waits for the first one.
let identity: Promise<unknown> | null = null

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const request = () =>
    fetch(`/api${path}`, {
      ...init,
      ...(init?.body ? { headers: { 'content-type': 'application/json' } } : {}),
    })
  let res: Response
  if (identity) {
    await identity
    res = await request()
  } else {
    const first = request()
    identity = first.catch(() => (identity = null))
    res = await first
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || body === null) throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`)
  return body
}

export interface SessionStart {
  sessionId: string
  seats: Seat[]
  events: GameEvent[]
  view: unknown
  /** The `seq` the next human action must carry (the action log's length, CPU actions included). */
  seq: number
  wallet?: number
}

export interface SessionState {
  sessionId: string
  gameId: string
  seats: Seat[]
  view: unknown
  seq: number
  status: string
  wallet?: number
}

export interface ActionResult {
  events: GameEvent[]
  view: unknown
  /** The `seq` the next human action must carry (the action log's length, CPU actions included). */
  seq: number
  wallet?: number
}

export interface Round {
  id: string
  gameId: string
  roundNo: number
  net: number
  summary: unknown
  createdAt: number
}

export const api = {
  wallet: () => call<{ balance: number }>('/wallet'),
  createSession: (gameId: string, config: unknown, seed?: string) =>
    call<SessionStart>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ gameId, config, ...(seed === undefined ? {} : { seed }) }),
    }),
  session: (id: string) => call<SessionState>(`/sessions/${encodeURIComponent(id)}`),
  act: (id: string, action: unknown, seq: number) =>
    call<ActionResult>(`/sessions/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, seq }),
    }),
  history: (gameId: string | null) =>
    call<{ rounds: Round[] }>(gameId ? `/history?gameId=${encodeURIComponent(gameId)}` : '/history'),
  createRoom: (gameId: string) =>
    call<{ code: string }>('/rooms', { method: 'POST', body: JSON.stringify({ gameId }) }),
}

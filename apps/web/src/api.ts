import type { GameEvent, Seat } from '@neon-cards/engine'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    ...(init?.body ? { headers: { 'content-type': 'application/json' } } : {}),
  })
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
  createSession: (gameId: string, config: unknown) =>
    call<SessionStart>('/sessions', { method: 'POST', body: JSON.stringify({ gameId, config }) }),
  session: (id: string) => call<SessionState>(`/sessions/${encodeURIComponent(id)}`),
  act: (id: string, action: unknown, seq: number) =>
    call<ActionResult>(`/sessions/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, seq }),
    }),
  history: (gameId: string | null) =>
    call<{ rounds: Round[] }>(gameId ? `/history?gameId=${encodeURIComponent(gameId)}` : '/history'),
}

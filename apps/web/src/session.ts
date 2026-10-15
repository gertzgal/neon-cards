import { useCallback, useEffect, useRef, useState } from 'react'
import type { Seat, SeatId } from '@neon-cards/engine'
import { api } from './api'
import type { EventBatch, GamePlugin } from '@neon-cards/ui'

export type SessionState =
  | { status: 'loading' }
  | { status: 'setup' }
  | { status: 'error'; message: string }
  | {
      status: 'playing'
      sessionId: string
      seats: Seat[]
      humanSeat: SeatId
      view: unknown
      events: EventBatch
      seq: number
      busy: boolean
    }

const storeKey = (gameId: string) => `neon-cards:session:${gameId}`

function humanSeatOf(seats: Seat[]): SeatId {
  const human = seats.find((seat) => seat.kind === 'human')
  if (!human) throw new Error('session has no human seat')
  return human.id
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** `?rig=` and `?seed=` on the game URL, forwarded only to a Worker running with DEV_RIG=1 (production answers 400). */
function devConfig(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  return Object.fromEntries(['rig', 'seed'].flatMap((key) => (params.has(key) ? [[key, params.get(key) ?? '']] : [])))
}

const nextBatchId = (prev: SessionState) => (prev.status === 'playing' ? prev.events.id + 1 : 1)

/**
 * Owns one game's server session: resume after reload, start with config from
 * the pre-game sheet, and send each human action with the `seq` the server last returned.
 * Games without settings skip the sheet and start as soon as they open.
 */
export function useGameSession(plugin: GamePlugin, onWallet: (balance: number) => void) {
  const gameId = plugin.rules.definition.id
  const autoStart = !plugin.rules.meta.settings?.length
  const chips = plugin.rules.meta.economy === 'chips'
  const [state, setState] = useState<SessionState>(() =>
    (localStorage.getItem(storeKey(gameId)) && !Object.keys(devConfig()).length) || autoStart ? { status: 'loading' } : { status: 'setup' },
  )
  const booted = useRef(false)

  const create = useCallback(
    (config: unknown) =>
      api.createSession(gameId, { ...(config as object), ...devConfig() }, devConfig()['seed']).then(
        (res) => {
          localStorage.setItem(storeKey(gameId), res.sessionId)
          if (chips && res.wallet !== undefined) onWallet(res.wallet)
          setState((prev) => ({
            status: 'playing',
            sessionId: res.sessionId,
            seats: res.seats,
            humanSeat: humanSeatOf(res.seats),
            view: res.view,
            events: { id: nextBatchId(prev), events: res.events },
            seq: res.seq,
            busy: false,
          }))
        },
        (err: unknown) => setState({ status: 'error', message: message(err) }),
      ),
    [gameId, chips, onWallet],
  )

  const resume = useCallback(
    (sessionId: string) =>
      api.session(sessionId).then((res) => {
        if (res.status !== 'active') throw new Error(`session is ${res.status}`)
        if (chips && res.wallet !== undefined) onWallet(res.wallet)
        setState((prev) => ({
          status: 'playing',
          sessionId,
          seats: res.seats,
          humanSeat: humanSeatOf(res.seats),
          view: res.view,
          events: { id: nextBatchId(prev), events: [] },
          seq: res.seq,
          busy: false,
        }))
      }),
    [chips, onWallet],
  )

  const start = useCallback(
    (config: unknown) => {
      setState({ status: 'loading' })
      void create(config)
    },
    [create],
  )

  const reset = useCallback(() => {
    localStorage.removeItem(storeKey(gameId))
    if (autoStart) start({})
    else setState({ status: 'setup' })
  }, [gameId, autoStart, start])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const stored = Object.keys(devConfig()).length ? null : localStorage.getItem(storeKey(gameId))
    if (stored) resume(stored).catch(reset)
    else if (autoStart) void create({})
  }, [gameId, autoStart, create, resume, reset])

  const act = useCallback(
    async (action: unknown) => {
      if (state.status !== 'playing' || state.busy) return
      const { sessionId, seq } = state
      setState({ ...state, busy: true })
      try {
        const res = await api.act(sessionId, action, seq)
        if (chips && res.wallet !== undefined) onWallet(res.wallet)
        setState((prev) =>
          prev.status === 'playing' && prev.sessionId === sessionId
            ? { ...prev, view: res.view, events: { id: prev.events.id + 1, events: res.events }, seq: res.seq, busy: false }
            : prev,
        )
      } catch {
        await resume(sessionId).catch((err: unknown) => setState({ status: 'error', message: message(err) }))
      }
    },
    [state, chips, onWallet, resume],
  )

  return { state, start, act, reset }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent, Seat, SeatId } from '@neon-cards/engine'
import type { EventBatch } from '@neon-cards/ui'
import { api } from './api'
import { findGame } from './games'
import { navigate } from './router'
import { HudIcons } from './shell/Hud'

interface SeatChip {
  id: string
  kind: 'human' | 'cpu' | 'house'
  name: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

interface LobbyWire {
  type: 'lobby'
  code: string
  gameId: string
  host: boolean
  you: string | null
  seats: SeatChip[]
  eyes: number
  canOpen: boolean
}

interface LiveWire {
  type: 'live'
  code: string
  gameId: string
  host: boolean
  you: string | null
  canAct: boolean
  canOpen: boolean
  seats: SeatChip[]
  eyes: number
  seq: number
  view: unknown
  events: unknown
  snap: boolean
  backSeat: string | null
}

type Wire = LobbyWire | LiveWire | { type: 'closed' } | { type: 'rejected'; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stageOf(view: unknown): string {
  if (!isRecord(view) || typeof view.stage !== 'string') return ''
  return view.stage
}

function asEvents(value: unknown): GameEvent[] {
  return Array.isArray(value) ? (value as GameEvent[]) : []
}

function asSeats(seats: SeatChip[]): Seat[] {
  return seats.map((seat) => ({
    id: seat.id,
    kind: seat.kind,
    name: seat.name,
    ...(seat.difficulty ? { difficulty: seat.difficulty } : {}),
  }))
}

export function RoomScreen({ code }: { code: string }) {
  const room = useRoom(code)
  const frame = room.frame
  const you = frame?.you ?? null
  const nickname = frame?.seats.find((seat) => seat.id === you)?.name
  const plugin = frame?.type === 'live' ? findGame(frame.gameId) : undefined
  const rematch = frame?.type === 'live' && frame.host && stageOf(frame.view) === 'gameOver'
  const openCpu = frame?.type === 'live' && you === null && frame.backSeat === null ? frame.seats.filter((seat) => seat.kind === 'cpu' && seat.difficulty) : []

  return (
    <div className="screen room" data-testid="room-screen" data-you={you ?? ''} data-state={room.status}>
      <div className="room-bar">
        <span className="room-chip" data-testid="room-code">
          {code}
        </span>
        {nickname && (
          <span className="room-chip" data-testid="nickname">
            {nickname}
          </span>
        )}
        <span className="room-chip" data-testid="spectator-count">
          {frame?.eyes ?? 0}
        </span>
        {frame?.canOpen && (
          <button type="button" className="room-chip main" data-testid="room-deal" disabled={!room.rigReady || room.busy} onClick={room.deal}>
            Deal
          </button>
        )}
        {frame?.type === 'live' && frame.backSeat && (
          <button type="button" className="room-chip main" data-testid="room-back" disabled={room.busy} onClick={room.back}>
            I'm back
          </button>
        )}
        {rematch && (
          <button type="button" className="room-chip main" data-testid="room-rematch" disabled={room.busy} onClick={room.rematch}>
            Rematch
          </button>
        )}
        {openCpu.map((seat) => (
          <button key={seat.id} type="button" className="room-chip" data-testid={`sit-${seat.id}`} disabled={room.busy} onClick={() => room.sit(seat.id)}>
            Take {seat.name}
          </button>
        ))}
        {room.status === 'open' && (
          <button type="button" className="room-chip" data-testid="room-leave" onClick={room.leave}>
            Leave
          </button>
        )}
      </div>
      <div className="room-body">
        {room.status === 'connecting' && (
          <p className="center-msg" data-testid="room-joining">
            Joining…
          </p>
        )}
        {room.status === 'missing' && (
          <p className="center-msg" data-testid="room-missing">
            No room with that code.
          </p>
        )}
        {room.status === 'closed' && (
          <p className="center-msg" data-testid="room-closed">
            This room is closed.
          </p>
        )}
        {frame?.type === 'lobby' && (
          <ul className="room-seats" data-testid="room-seats">
            {frame.seats.map((seat) => (
              <li key={seat.id} data-testid={`seat-${seat.id}`}>
                {seat.name}
              </li>
            ))}
          </ul>
        )}
        {frame?.type === 'live' && plugin && (
          <plugin.Table
            seats={asSeats(frame.seats)}
            humanSeat={(you ?? '') as SeatId}
            view={frame.view}
            events={room.events}
            wallet={null}
            busy={room.busy}
            act={room.act}
            canOpen={false}
            hudIcons={<HudIcons />}
          />
        )}
      </div>
    </div>
  )
}

function useRoom(code: string) {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'missing'>('connecting')
  const [frame, setFrame] = useState<LobbyWire | LiveWire | null>(null)
  const [events, setEvents] = useState<EventBatch>({ id: 0, events: [] })
  const [busy, setBusy] = useState(false)
  const [rigReady, setRigReady] = useState(() => new URLSearchParams(window.location.search).get('rig') === null)
  const wsRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const batchRef = useRef(0)
  const rigSent = useRef(false)
  const leaveRef = useRef(false)
  const closedRef = useRef(false)
  const waitRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let timer = 0
    const connect = () => {
      if (stopped || leaveRef.current || closedRef.current) return
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${proto}//${window.location.host}/api/rooms/${code}`)
      socket = ws
      wsRef.current = ws
      let seen = false
      ws.onmessage = (event) => {
        seen = true
        const msg = JSON.parse(String(event.data)) as Wire
        if (msg.type === 'rejected') {
          if (rigSent.current) setRigReady(true)
          waitRef.current?.()
          waitRef.current = null
          setBusy(false)
          return
        }
        if (msg.type === 'closed') {
          closedRef.current = true
          setFrame(null)
          setStatus('closed')
          return
        }
        if (msg.type === 'live') {
          seqRef.current = msg.seq
          batchRef.current += 1
          setEvents({ id: batchRef.current, events: msg.snap ? [] : asEvents(msg.events) })
        }
        if (msg.type === 'lobby') {
          const rig = new URLSearchParams(window.location.search).get('rig')
          if (rig && msg.host && !rigSent.current) {
            rigSent.current = true
            ws.send(JSON.stringify({ type: 'settings', commandId: crypto.randomUUID(), config: { rig, difficulty: 'medium' } }))
          } else setRigReady(true)
        }
        setFrame(msg)
        setStatus('open')
        waitRef.current?.()
        waitRef.current = null
        setBusy(false)
      }
      ws.onclose = () => {
        if (stopped || leaveRef.current || closedRef.current) return
        if (!seen) {
          setStatus('missing')
          return
        }
        timer = window.setTimeout(connect, 400)
      }
    }
    void api.wallet().finally(() => {
      if (!stopped) connect()
    })
    return () => {
      stopped = true
      window.clearTimeout(timer)
      socket?.close()
    }
  }, [code])

  const send = useCallback((body: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    setBusy(true)
    ws.send(JSON.stringify({ ...body, commandId: crypto.randomUUID() }))
  }, [])

  const act = useCallback((action: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve()
    setBusy(true)
    return new Promise<void>((resolve) => {
      waitRef.current = resolve
      ws.send(JSON.stringify({ type: 'act', commandId: crypto.randomUUID(), seq: seqRef.current, action }))
    })
  }, [])

  const leave = useCallback(() => {
    leaveRef.current = true
    send({ type: 'leave' })
    navigate({ name: 'home' })
  }, [send])

  return {
    status,
    frame,
    events,
    busy,
    rigReady,
    deal: () => send({ type: 'deal' }),
    back: () => send({ type: 'back' }),
    rematch: () => send({ type: 'rematch' }),
    sit: (seatId: string) => send({ type: 'sit', seatId }),
    leave,
    act,
  }
}

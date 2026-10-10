import { useCallback, useRef, useState } from 'react'
import type { Rng } from '@neon-cards/engine'
import { blackjack, type BlackjackAction, type BlackjackState, type BlackjackView } from '../rules'
import type { EventBatch, TableProps } from './contract'

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, int: (n: number) => Math.floor(next() * n), state: () => String(a) }
}

interface LocalSession {
  rng: Rng
  state: BlackjackState
}

/**
 * TableProps backed by the rules running in the browser, for the dev harness and component tests.
 * `config` goes through the same `parseConfig` the server uses.
 */
export function useLocalSession(config: unknown, seed: number): TableProps<BlackjackView, BlackjackAction> {
  const [session] = useState<LocalSession>(() => {
    const rng = mulberry32(seed)
    const parsed = blackjack.parseConfig(config)
    return { rng, state: blackjack.setup(parsed, blackjack.seatsFor(parsed), rng) }
  })
  const seats = blackjack.seatsFor(session.state.config)
  const seat = session.state.seat
  const [view, setView] = useState(() => blackjack.view(session.state, seat))
  const [events, setEvents] = useState<EventBatch>({ id: 0, events: [] })
  const [busy, setBusy] = useState(false)
  const batchId = useRef(0)

  const act = useCallback(
    async (action: BlackjackAction) => {
      setBusy(true)
      try {
        await new Promise((r) => setTimeout(r, 30))
        const out = blackjack.apply(session.state, seat, action, session.rng)
        session.state = out.state
        batchId.current += 1
        setEvents({ id: batchId.current, events: out.events })
        setView(blackjack.view(out.state, seat))
      } finally {
        setBusy(false)
      }
    },
    [session, seat],
  )

  return { seats, humanSeat: seat, view, events, wallet: view.stack, act, busy }
}

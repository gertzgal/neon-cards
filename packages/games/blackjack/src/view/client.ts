import { useCallback, useRef, useState } from 'react'
import { soloSeats, createRng, type Rng } from '@neon-cards/engine'
import { blackjack, type BlackjackAction, type BlackjackState, type BlackjackView } from '../rules'
import type { EventBatch, TableProps } from './contract'

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
    const rng = createRng(String(seed))
    const parsed = blackjack.parseConfig(config)
    return { rng, state: blackjack.setup(parsed, soloSeats(blackjack, parsed), rng) }
  })
  const seats = soloSeats(blackjack, session.state.config)
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

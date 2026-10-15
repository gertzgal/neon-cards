import type { GameEvent, SeatId } from '@neon-cards/engine'
import { runPlayback, useJuice, prefersReducedMotion, type JuiceKit, type Playback, type PlaybackOptions } from '@neon-cards/ui'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const PASS_MS = 120
const TURN_MS = 500

/** Events before the first `turn` are the human beat. Each later beat starts at a `turn`. */
export function splitBeats(events: readonly GameEvent[]): { events: GameEvent[]; thinkingMs: number }[] {
  const groups: GameEvent[][] = []
  let current: GameEvent[] = []
  for (const event of events) {
    if (event.type === 'turn' && current.length > 0) {
      groups.push(current)
      current = [event]
    } else current.push(event)
  }
  if (current.length > 0) groups.push(current)
  return groups.map((group) => ({ events: group, thinkingMs: thinkingMs(group) }))
}

/** 0 before any CPU turn. 120 for a pass that does not nope or play. 500 for every other CPU beat. */
export function thinkingMs(events: readonly GameEvent[]): number {
  if (!events.some((event) => event.type === 'turn')) return 0
  const types = new Set(events.map((event) => event.type))
  if (types.has('Passed') && !types.has('Noped') && !types.has('Played')) return PASS_MS
  return TURN_MS
}

type Skippable = JuiceKit & { skip?: () => void; resume?: () => void }

/**
 * Plays one server batch by calling `runPlayback` once per beat.
 * `usePlayback` is not used: that hook waits 500 ms on every CPU `turn`.
 */
export function useEkPlayback(options: PlaybackOptions): Playback {
  const kit = useJuice() as Skippable
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const [playing, setPlaying] = useState(false)
  const [actingSeat, setActingSeat] = useState<SeatId | null>(null)
  const [thinking, setThinking] = useState(false)
  const skipped = useRef(false)
  const queue = useRef<Promise<void>>(Promise.resolve())

  const play = useCallback(
    (events: GameEvent[]) => {
      const run = async () => {
        await Promise.resolve()
        skipped.current = false
        kit.resume?.()
        setPlaying(true)
        const reduced = prefersReducedMotion()
        try {
          for (const beat of splitBeats(events)) {
            await runPlayback(beat.events, {
              juice: latest.current.juice,
              kit,
              apply: (event) => flushSync(() => latest.current.apply(event)),
              isCpu: (id) => latest.current.seats.some((seat) => seat.id === id && seat.kind === 'cpu'),
              settle: () => Promise.resolve(),
              thinkingMs: reduced ? 0 : beat.thinkingMs,
              skipped: () => skipped.current,
              onTurn: (seat, isThinking) => {
                setActingSeat(seat)
                setThinking(isThinking)
              },
            })
          }
        } finally {
          kit.resume?.()
          setThinking(false)
          setPlaying(false)
        }
      }
      queue.current = queue.current.then(run, run)
      return queue.current
    },
    [kit],
  )

  const skip = useCallback(() => {
    skipped.current = true
    kit.skip?.()
  }, [kit])

  useEffect(() => {
    if (!playing) return
    const onTap = () => skip()
    window.addEventListener('pointerdown', onTap, { capture: true })
    return () => window.removeEventListener('pointerdown', onTap, { capture: true })
  }, [playing, skip])

  return { play, skip, playing, actingSeat, thinking }
}

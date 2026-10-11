import type { GameEvent, SeatId } from '@neon-cards/engine'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { EventBatch, JuiceKit, Playback, PlaybackOptions, SfxName } from '../api'
import { prefersReducedMotion } from '../primitives/motion'
import { durations } from '../theme/tokens'
import { createJuiceKit, type ControlledKit } from './kit'
import { runPlayback } from './playback'

const JuiceContext = createContext<ControlledKit | null>(null)

let detached: ControlledKit | null = null
function detachedKit(): ControlledKit {
  detached ??= createJuiceKit({
    stage: () => document.querySelector<HTMLElement>('.nc-stage'),
    fx: () => document.querySelector<HTMLElement>('.nc-fx'),
    reducedMotion: prefersReducedMotion,
    sfx: () => {},
  })
  return detached
}

export interface JuiceProviderProps {
  children: ReactNode
  /** Value of the `data-nc-root` attribute on the NeonRoot element that holds `.nc-stage` and `.nc-fx`. */
  root: string
  sfx?(name: SfxName): void
}

/** Hosts the juice kit for a NeonRoot. NeonRoot renders it; games only call useJuice(). */
export function JuiceProvider({ children, root, sfx }: JuiceProviderProps) {
  const [sink] = useState(() => ({ sfx }))
  useLayoutEffect(() => {
    Object.assign(sink, { sfx })
  }, [sink, sfx])
  const [kit] = useState(() => {
    const within = (selector: string) => document.querySelector<HTMLElement>(`[data-nc-root="${CSS.escape(root)}"] ${selector}`)
    return createJuiceKit({
      stage: () => within('.nc-stage'),
      fx: () => within('.nc-fx'),
      reducedMotion: prefersReducedMotion,
      sfx: (name) => sink.sfx?.(name),
    })
  })
  return <JuiceContext.Provider value={kit}>{children}</JuiceContext.Provider>
}

function useControlledKit(): ControlledKit {
  return useContext(JuiceContext) ?? detachedKit()
}

/** The shared juice primitives, for one-off effects outside an event queue. */
export function useJuice(): JuiceKit {
  return useControlledKit()
}

/** Paced playback of event queues: CPU thinking beats, then each event's juice. Tap anywhere to skip. */
export function usePlayback(options: PlaybackOptions): Playback {
  const kit = useControlledKit()
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
        kit.resume()
        setPlaying(true)
        try {
          await runPlayback(events, {
            juice: latest.current.juice,
            kit,
            apply: (event) => flushSync(() => latest.current.apply(event)),
            isCpu: (id) => latest.current.seats.some((s) => s.id === id && s.kind === 'cpu'),
            settle: () => Promise.resolve(),
            thinkingMs: durations.thinkingBeat,
            skipped: () => skipped.current,
            onTurn: (seat, isThinking) => {
              setActingSeat(seat)
              setThinking(isThinking)
            },
          })
        } finally {
          kit.resume()
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
    kit.skip()
  }, [kit])

  useEffect(() => {
    if (!playing) return
    const onTap = () => skip()
    window.addEventListener('pointerdown', onTap, { capture: true })
    return () => window.removeEventListener('pointerdown', onTap, { capture: true })
  }, [playing, skip])

  return { play, skip, playing, actingSeat, thinking }
}

/** usePlayback that plays each new EventBatch once (by `id`), as a Table receives them in TableProps. */
export function useBatchPlayback(batch: EventBatch, options: PlaybackOptions): Playback {
  const playback = usePlayback(options)
  const played = useRef<number | null>(null)
  const { play } = playback
  useEffect(() => {
    if (played.current === batch.id) return
    played.current = batch.id
    void play(batch.events)
  }, [batch, play])
  return playback
}

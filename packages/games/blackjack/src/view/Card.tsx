import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { BlackjackFace, VisibleCard } from '../rules'
import { BlackjackFaceArt, faceLabel, suitTone } from './face'
import { reducedMotion } from './juice'
import type { Slot } from './layout'

export const faceCode = (face: BlackjackFace | null) => (face ? face.rank + face.suit : 'hidden')

/** Notch, rim, and rank. The table hand and the guide card both read this, so the felt card matches. */
export function cardFrameVars(w: number, h: number): CSSProperties {
  return {
    '--n': `${Math.max(4, w * 0.05)}px`,
    '--bw': `${Math.max(3, Math.round(w * 0.025))}px`,
    '--rk': `${h * 0.2}px`,
  } as CSSProperties
}

interface CardProps {
  card: VisibleCard
  slot: Slot
  w: number
  h: number
  z: number
  /** Last known screen rect per card key, so a card that remounts (a split) slides instead of re-dealing. */
  memory: Map<string, DOMRect>
  memoryKey: string
  testId: string
}

/** Where dealt cards fly in from: the shoe, just above the top edge. */
export const DEAL_FROM = () => ({ x: innerWidth / 2, y: -Math.min(innerHeight * 0.3, 240) })

export function PlayingCard({ card, slot, w, h, z, memory, memoryKey, testId }: CardProps) {
  const fly = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const prevFace = useRef(card.face)

  useLayoutEffect(() => {
    const el = fly.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const before = memory.get(memoryKey)
    if (before) {
      const dx = before.left + before.width / 2 - cx
      const dy = before.top + before.height / 2 - cy
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' })
      return
    }
    if (reducedMotion()) return
    const from = DEAL_FROM()
    el.animate(
      [
        { transform: `translate(${from.x - cx}px,${from.y - cy}px) rotate(-18deg) scale(.8)`, opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 230, easing: 'cubic-bezier(.2,.9,.3,1)' },
    ).finished.then(
      () => el.animate([{ transform: 'scale(1.12,.86)' }, { transform: 'scale(.96,1.05)' }, { transform: 'none' }], { duration: 150, easing: 'ease-out' }),
      () => undefined,
    )
    // Mount only: later moves are CSS transitions on the slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (fly.current) memory.set(memoryKey, fly.current.getBoundingClientRect())
  })

  useLayoutEffect(() => {
    if (prevFace.current === null && card.face !== null) {
      frame.current?.animate(
        [
          { transform: 'scaleX(0) scaleY(1.12)' },
          { transform: 'scaleX(1.12) scaleY(.9)' },
          { transform: 'scaleX(.97) scaleY(1.03)' },
          { transform: 'none' },
        ],
        { duration: 220, easing: 'ease-out' },
      )
    }
    prevFace.current = card.face
  }, [card.face])

  const tone = card.face ? suitTone(card.face.suit) : 'back'
  return (
    <div
      className="bj-slot"
      data-testid={testId}
      data-face={faceCode(card.face)}
      aria-label={card.face ? faceLabel(card.face) : 'face-down card'}
      style={{ width: w, height: h, zIndex: z, transform: `translate(${slot.x}px,${slot.y}px) rotate(${slot.rot}deg)` }}
    >
      <div className="bj-fly" ref={fly}>
        <div className="bj-sway">
          <div className="bj-card" data-tone={tone} ref={frame}>
            <div className="bj-card-in">{card.face && <BlackjackFaceArt face={card.face} />}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

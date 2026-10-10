import type { CSSProperties } from 'react'
import type { PlayingCardProps } from '../api'
import { toneColor } from '../theme/tokens'
import { useTableMetrics, type Size } from './metrics'

/** Frame variables shared by the card rim, the notched pixel corners, and the corner ranks. */
export function cardFrameStyle({ w, h }: Size): CSSProperties {
  return {
    width: w,
    height: h,
    '--nc-notch': `${Math.max(4, w * 0.05)}px`,
    '--nc-rim': `${Math.max(3, Math.round(w * 0.025))}px`,
    '--nc-rank': `${h * 0.2}px`,
  } as CSSProperties
}

/** Oversized corner ranks (top-left and bottom-right), sized from the frame. */
export function CornerRanks({ text }: { text: string }) {
  return (
    <>
      <span className="nc-rank nc-rank-tl">{text}</span>
      <span className="nc-rank nc-rank-br">{text}</span>
    </>
  )
}

/** The shared card frame. The face inside comes entirely from the game's renderer. */
export function PlayingCard<Face>({ card, renderer, size = 'hand', state, box: fitted }: PlayingCardProps<Face> & { box?: Size }) {
  const metrics = useTableMetrics()
  const box = fitted ?? metrics.card[size]
  const face = card.face
  const faceDown = face === null
  const tone = face === null ? 'pink' : renderer.tone(face)
  return (
    <div
      className={`nc-card${faceDown ? ' nc-card-back' : ''}`}
      data-testid={`card-${card.id}`}
      data-face={faceDown ? 'down' : 'up'}
      data-state={state}
      aria-label={face === null ? 'face-down card' : renderer.label(face)}
      style={{ ...cardFrameStyle(box), '--nc-c': toneColor[tone] } as CSSProperties}
    >
      <div className="nc-card-in">{face !== null && renderer.render(face, { size, widthPx: box.w })}</div>
    </div>
  )
}

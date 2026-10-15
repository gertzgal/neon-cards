import type { ReactNode } from 'react'
import type { CardFaceRenderer } from '../api'
import { PlayingCard } from './playing-card'

/** Width over height. Stays in this module so a second painter cannot drift. */
const FELT_ASPECT = 0.74

/** The kit felt card at the guide's column width. Flip 7 and Exploding Kittens call this from `paint`. */
export function guideFeltCard<Face>({
  id,
  deck,
  face,
  renderer,
  widthPx,
}: {
  id: string
  deck: string
  face: Face
  renderer: CardFaceRenderer<Face>
  widthPx: number
}): ReactNode {
  return (
    <PlayingCard
      card={{ id, deck, face }}
      renderer={renderer}
      size="hand"
      box={{ w: widthPx, h: Math.round(widthPx / FELT_ASPECT) }}
    />
  )
}

import type { StandardFace } from '@neon-cards/engine'
import type { CardFaceRenderer } from '../api'
import { toneColor } from '../theme/tokens'
import { CornerRanks } from './playing-card'
import { bitmaps, PixelSprite, pixelScale } from './pixel'

const suitBitmap = { H: bitmaps.heart, D: bitmaps.diamond, S: bitmaps.spade, C: bitmaps.club } as const
const suitSymbol = { H: '♥', D: '♦', S: '♠', C: '♣' } as const

export const standardFaceRenderer: CardFaceRenderer<StandardFace> = {
  deck: 'standard52',
  tone: (face) => (face.suit === 'H' || face.suit === 'D' ? 'pink' : 'cyan'),
  label: (face) => `${face.rank}${suitSymbol[face.suit]}`,
  render(face, { widthPx }) {
    const color = toneColor[standardFaceRenderer.tone(face)]
    const court = face.rank === 'J' || face.rank === 'Q' || face.rank === 'K'
    return (
      <>
        <CornerRanks text={face.rank} />
        {court && (
          <div className="nc-face-crown">
            <PixelSprite bitmap={bitmaps.crown} color={color} scale={pixelScale(widthPx, 7, 0.28)} glow={false} />
          </div>
        )}
        <div className="nc-face-center">
          <PixelSprite bitmap={suitBitmap[face.suit]} color={color} scale={pixelScale(widthPx, 11)} />
        </div>
      </>
    )
  },
}

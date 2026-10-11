import type { Flip7Face } from '@neon-cards/engine'
import { bitmaps, CornerRanks, PixelSprite, pixelScale, toneColor, type CardFaceRenderer, type Tone } from '@neon-cards/ui'

const actionArt = {
  freeze: { tone: 'cyan', bitmap: bitmaps.snowflake, label: 'FREEZE', corner: null },
  flipThree: { tone: 'violet', bitmap: bitmaps.bolt, label: 'FLIP THREE', corner: '3' },
  secondChance: { tone: 'pink', bitmap: bitmaps.shield, label: 'SECOND CHANCE', corner: null },
} as const

/** What a card shows: the number, "+4", "×2". Action cards draw a sprite instead. */
export function faceText(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `+${face.value}` : '×2'
  return actionArt[face.action].label
}

export function faceTone(face: Flip7Face): Tone {
  if (face.kind === 'modifier') return 'gold'
  if (face.kind === 'action') return actionArt[face.action].tone
  return face.value <= 4 ? 'cyan' : face.value <= 8 ? 'violet' : 'pink'
}

export const flip7Face: CardFaceRenderer<Flip7Face> = {
  deck: 'flip7',
  tone: faceTone,
  label: faceText,
  render(face, { widthPx, size }) {
    const color = toneColor[faceTone(face)]
    if (face.kind === 'action') {
      const art = actionArt[face.action]
      return (
        <>
          {art.corner && size !== 'compact' && <CornerRanks text={art.corner} />}
          <div className="nc-face-center">
            <PixelSprite bitmap={art.bitmap} color={color} scale={pixelScale(widthPx, art.bitmap[0].length, 0.5)} />
          </div>
        </>
      )
    }
    const text = faceText(face)
    return (
      <>
        {size !== 'compact' && <CornerRanks text={text} />}
        <div
          className="nc-face-center"
          style={{
            fontSize: widthPx * (text.length > 2 ? 0.42 : text.length > 1 ? 0.56 : 0.66),
            lineHeight: 0.8,
            color,
            textShadow: `0 0 8px ${color}, 0 0 2px ${color}`,
          }}
        >
          {text}
        </div>
      </>
    )
  },
}

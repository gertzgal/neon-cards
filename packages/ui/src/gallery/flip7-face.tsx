import type { CardFaceRenderer } from '../api'
import { CornerRanks } from '../primitives/playing-card'
import { bitmaps, PixelSprite, pixelScale } from '../primitives/pixel'
import { toneColor, type Tone } from '../theme/tokens'

/** The Flip 7 face shape from docs/architecture.md. The gallery uses it to prove faces are game-defined. */
export type Flip7Face =
  | { kind: 'number'; value: number }
  | { kind: 'modifier'; op: 'add'; value: 2 | 4 | 6 | 8 | 10 }
  | { kind: 'modifier'; op: 'times'; value: 2 }
  | { kind: 'action'; action: 'freeze' | 'flipThree' | 'secondChance' }

const actionArt = {
  freeze: { tone: 'cyan', bitmap: bitmaps.snowflake, label: 'FREEZE', corner: 'F' },
  flipThree: { tone: 'violet', bitmap: bitmaps.bolt, label: 'FLIP 3', corner: '3' },
  secondChance: { tone: 'pink', bitmap: bitmaps.shield, label: '2ND CHANCE', corner: '2' },
} as const

function corner(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `+${face.value}` : 'x2'
  return actionArt[face.action].corner
}

export const flip7FaceRenderer: CardFaceRenderer<Flip7Face> = {
  deck: 'flip7',
  tone(face): Tone {
    if (face.kind === 'modifier') return 'gold'
    if (face.kind === 'action') return actionArt[face.action].tone
    return face.value <= 4 ? 'cyan' : face.value <= 8 ? 'violet' : 'pink'
  },
  label(face) {
    return face.kind === 'action' ? actionArt[face.action].label : corner(face)
  },
  render(face, { widthPx, size }) {
    const color = toneColor[flip7FaceRenderer.tone(face)]
    if (face.kind === 'action') {
      const art = actionArt[face.action]
      return (
        <>
          <CornerRanks text={art.corner} />
          <div className="nc-face-center">
            <PixelSprite bitmap={art.bitmap} color={color} scale={pixelScale(widthPx, art.bitmap[0].length, 0.42)} />
          </div>
        </>
      )
    }
    const text = corner(face)
    return (
      <>
        {size !== 'compact' && <CornerRanks text={text} />}
        <div
          className="nc-face-center"
          style={{
            fontSize: widthPx * (text.length > 2 ? 0.42 : 0.62),
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

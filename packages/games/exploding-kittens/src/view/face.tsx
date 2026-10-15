import type { EkFace, Title } from '../rules'
import { FACE_LABEL } from '../rules/deck'
import { bitmaps, CornerRanks, PixelSprite, pixelScale, toneColor, type Bitmap, type CardFaceRenderer, type Tone } from '@neon-cards/ui'

const kitten: Bitmap = ['X...X...X', '.X.X.X.X.', '..XXXXX..', '.X.X.X.X.', 'XXXXXXXXX', '.XX.X.XX.', '..XXXXX..', '...X.X...']
const nope: Bitmap = ['XX.....XX', '.XX...XX.', '..XX.XX..', '...XXX...', '..XX.XX..', '.XX...XX.', 'XX.....XX']
const skip: Bitmap = ['..XX.....', '..XXXX...', '..XXXXXX.', 'XXXXXXXXX', '..XXXXXX.', '..XXXX...', '..XX.....']
const shuffle: Bitmap = ['XXXX.....', 'XXXXX....', '.....XXXX', 'XXXXXXXXX', 'XXXX.....', '....XXXXX', '.....XXXX']
const eye: Bitmap = ['..XXXXX..', '.XXXXXXX.', 'XX.XXX.XX', 'XXX.X.XXX', 'XX.XXX.XX', '.XXXXXXX.', '..XXXXX..']
const tacocat: Bitmap = ['XX.......XX', '.XX.....XX.', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '.XXX...XXX.', '..XX...XX..', '...XXXXX...']
const potato: Bitmap = ['...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...']
const rainbow: Bitmap = ['..X.....X..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XX.......XX', 'XXXXXXXXXXX', 'XX.......XX', '.XXXXXXXXX.', '..XXXXXXX..']
const beard: Bitmap = ['..X.....X..', '.XXX...XXX.', 'XXXXXXXXXXX', 'XX.XX.XX.XX', '.XXXXXXXXX.', '..XXXXXXX..', '..XX...XX..', '.XXX...XXX.', 'XXXXXXXXXXX']
const melon: Bitmap = ['...XXXXX...', '..X.XXX.X..', '.XXXXXXXXX.', 'XX.XXXXX.XX', '.XXXXXXXXX.', 'XX.XXXXX.XX', '..XXXXXXX..', '...XXXXX...']

const art: Record<Title, { tone: Tone; bitmap: Bitmap; corner: string }> = {
  kitten: { tone: 'pink', bitmap: kitten, corner: '!' },
  defuse: { tone: 'cyan', bitmap: bitmaps.shield, corner: '+' },
  nope: { tone: 'pink', bitmap: nope, corner: 'N' },
  attack: { tone: 'violet', bitmap: bitmaps.bolt, corner: 'A' },
  skip: { tone: 'cyan', bitmap: skip, corner: 'S' },
  favor: { tone: 'gold', bitmap: bitmaps.heart, corner: 'F' },
  shuffle: { tone: 'violet', bitmap: shuffle, corner: 'Z' },
  future: { tone: 'gold', bitmap: eye, corner: '?' },
  tacocat: { tone: 'gold', bitmap: tacocat, corner: 'T' },
  hairyPotato: { tone: 'pink', bitmap: potato, corner: 'P' },
  rainbowRalphing: { tone: 'violet', bitmap: rainbow, corner: 'R' },
  beard: { tone: 'cyan', bitmap: beard, corner: 'B' },
  cattermelon: { tone: 'pink', bitmap: melon, corner: 'C' },
}

export function faceTone(face: EkFace): Tone {
  return art[face.title].tone
}

export function faceCorner(title: Title): string {
  return art[title].corner
}

export const kittenMark = kitten

export const ekFace: CardFaceRenderer<EkFace> = {
  deck: 'exploding-kittens',
  tone: faceTone,
  label: (face) => FACE_LABEL[face.title],
  render(face, { widthPx, size }) {
    const { bitmap, corner } = art[face.title]
    const color = toneColor[faceTone(face)]
    return (
      <>
        {size !== 'compact' && <CornerRanks text={corner} />}
        <div className="nc-face-center">
          <PixelSprite bitmap={bitmap} color={color} scale={pixelScale(widthPx, bitmap[0]?.length ?? 1, size === 'compact' ? 0.62 : 0.46)} />
        </div>
      </>
    )
  },
}

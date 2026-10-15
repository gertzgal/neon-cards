import type { CSSProperties } from 'react'
import { FACE_LABEL } from '../rules/deck'
import type { EkFace, Title } from '../rules'
import { InkSprite, fitScale, type Bitmap, type CardFaceRenderer, type Tone } from '@neon-cards/ui'
import { scenes } from './art'
import { TITLE_LINES, titleFont } from './type-size'
import './face.css'

/** Small mark for the plant row. The card art is the multi-ink scene. */
export const kittenMark: Bitmap = ['X...X...X', '.X.X.X.X.', '..XXXXX..', '.X.X.X.X.', 'XXXXXXXXX', '.XX.X.XX.', '..XXXXX..', '...X.X...']

const corner: Record<Title, string> = {
  kitten: '!',
  defuse: '+',
  nope: 'N',
  attack: 'A',
  skip: 'S',
  favor: 'F',
  shuffle: 'Z',
  future: '?',
  tacocat: 'T',
  hairyPotato: 'P',
  rainbowRalphing: 'R',
  beard: 'B',
  cattermelon: 'C',
}

export function faceTone(face: EkFace): Tone {
  return scenes[face.title].tone
}

export function faceAccent(face: EkFace): string {
  return scenes[face.title].accent
}

export function faceCorner(title: Title): string {
  return corner[title]
}

export const ekFace: CardFaceRenderer<EkFace> = {
  deck: 'exploding-kittens',
  tone: faceTone,
  accent: faceAccent,
  label: (face) => FACE_LABEL[face.title],
  render(face, { widthPx, size }) {
    const scene = scenes[face.title]
    const compact = size === 'compact'
    const lines = compact ? [scene.short] : TITLE_LINES[face.title]
    const width = scene.art[0]?.length ?? 1
    const scale = fitScale(widthPx, width, compact ? 0.72 : lines.length > 2 ? 0.5 : lines.length > 1 ? 0.58 : 0.66)
    const style = {
      '--ek-ink': scene.accent,
      '--ek-field': scene.field,
    } as CSSProperties
    return (
      <div className={compact ? 'ek-face ek-face-compact' : 'ek-face'} style={style}>
        <div className="ek-face-title" style={{ fontSize: titleFont(widthPx, lines) }}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="ek-face-art">
          <InkSprite bitmap={scene.art} inks={scene.inks} scale={scale} />
        </div>
      </div>
    )
  },
}

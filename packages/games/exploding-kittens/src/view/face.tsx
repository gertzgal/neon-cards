import type { CSSProperties } from 'react'
import { FACE_LABEL } from '../rules/deck'
import type { EkFace, Title } from '../rules'
import { InkSprite, fitScale, type Bitmap, type CardFaceRenderer, type Tone } from '@neon-cards/ui'
import { sceneTitle, scenes } from './art'
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

function titleSize(widthPx: number, text: string): number {
  return Math.max(8, Math.min(22, Math.floor((widthPx * 0.9) / (text.length * 0.56))))
}

export const ekFace: CardFaceRenderer<EkFace> = {
  deck: 'exploding-kittens',
  tone: faceTone,
  accent: faceAccent,
  label: (face) => FACE_LABEL[face.title],
  render(face, { widthPx, size }) {
    const scene = scenes[face.title]
    const compact = size === 'compact'
    const title = compact ? scene.short : sceneTitle(face.title)
    const width = scene.art[0]?.length ?? 1
    const scale = fitScale(widthPx, width, compact ? 0.78 : 0.7)
    const style = {
      '--ek-ink': scene.accent,
      '--ek-field': scene.field,
    } as CSSProperties
    return (
      <div className={compact ? 'ek-face ek-face-compact' : 'ek-face'} style={style}>
        <div className="ek-face-title" style={{ fontSize: titleSize(widthPx, title) }}>
          {title}
        </div>
        <div className="ek-face-art">
          <InkSprite bitmap={scene.art} inks={scene.inks} scale={scale} />
        </div>
        <div className="ek-face-rule" style={{ fontSize: Math.max(8, Math.round(widthPx * 0.078)) }}>
          {scene.rule}
        </div>
      </div>
    )
  },
}

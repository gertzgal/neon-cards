import type { CSSProperties, ReactNode } from 'react'
import type { Flip7Face } from '@neon-cards/engine'
import { InkSprite, PixelSprite, fitScale, type CardFaceRenderer, type Tone } from '@neon-cards/ui'
import { burstIcon, flipThreeIcon, freezeIcon, secondChanceIcon, wordBitmap } from './glyphs'
import './face.css'

/** One hue per number, echoing the physical deck's rainbow. The numeral is that color. */
const NUMBER_INK = [
  '#d5d0e6',
  '#ff4d3a',
  '#ff8a1e',
  '#ffe14a',
  '#b6ff3c',
  '#3dff8a',
  '#2ef2ff',
  '#7aa6ff',
  '#c084ff',
  '#ff2e88',
  '#ff5a7a',
  '#ff7a3c',
  '#ffd23f',
] as const

const NUMBER_TONE: Tone[] = ['ink', 'pink', 'gold', 'gold', 'cyan', 'cyan', 'cyan', 'cyan', 'violet', 'pink', 'pink', 'gold', 'gold']

const ADD_INK: Record<2 | 4 | 6 | 8 | 10, string> = {
  2: '#5dffa8',
  4: '#3dff6a',
  6: '#2ee6c8',
  8: '#7fd7ff',
  10: '#ffd23f',
}

const ACTION = {
  freeze: { tone: 'cyan' as const, ink: '#9af6ff', words: ['FREEZE'], icon: freezeIcon },
  flipThree: { tone: 'gold' as const, ink: '#ffe14a', words: ['FLIP', 'THREE'], icon: flipThreeIcon },
  secondChance: { tone: 'cyan' as const, ink: '#7dff6a', words: ['SECOND', 'CHANCE'], icon: secondChanceIcon },
}

const FIELD = '#0c0a12'

/** What a card shows: the number, "+4", "×2". Action cards draw a sprite instead. */
export function faceText(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `+${face.value}` : '\u00d72'
  return ACTION[face.action].words.join(' ')
}

export function faceTone(face: Flip7Face): Tone {
  if (face.kind === 'number') return NUMBER_TONE[face.value] ?? 'ink'
  if (face.kind === 'modifier') return face.op === 'times' ? 'gold' : 'cyan'
  return ACTION[face.action].tone
}

/** The rule line and the guide both read this. Every face has one sentence. */
export function actionSentence(face: Flip7Face): string {
  switch (face.kind) {
    case 'number':
      return 'A second copy busts. Seven different numbers scores Flip 7.'
    case 'modifier':
      switch (face.op) {
        case 'add':
          return `Add ${face.value} to the round.`
        case 'times':
          return 'Double your number cards.'
        default: {
          const unreachable: never = face
          return unreachable
        }
      }
    case 'action':
      switch (face.action) {
        case 'freeze':
          return 'That player banks their score and sits this round out.'
        case 'flipThree':
          return 'That player flips the next three cards.'
        case 'secondChance':
          return 'Your next duplicate is discarded instead of busting you.'
        default: {
          const unreachable: never = face.action
          return unreachable
        }
      }
    default: {
      const unreachable: never = face
      return unreachable
    }
  }
}

/** How long a drawn action's sentence stays up. A tap does not use this. */
export const ACTION_HINT_MS = 2200

export function faceInk(face: Flip7Face): string {
  if (face.kind === 'number') return NUMBER_INK[face.value] ?? NUMBER_INK[0]
  if (face.kind === 'modifier') return face.op === 'add' ? ADD_INK[face.value] : '#fff3b0'
  return ACTION[face.action].ink
}

function shell(ink: string, className: string, children: ReactNode) {
  const style = { '--f7-ink': ink, '--f7-field': FIELD } as CSSProperties
  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}

export const flip7Face: CardFaceRenderer<Flip7Face> = {
  deck: 'flip7',
  tone: faceTone,
  accent: faceInk,
  label: faceText,
  render(face, { widthPx, size }) {
    const ink = faceInk(face)
    if (face.kind === 'action') {
      const art = ACTION[face.action]
      const longest = Math.max(...art.words.map((word) => wordBitmap(word)[0]?.length ?? 1))
      const wordScale = fitScale(widthPx, longest, 0.98)
      // Scale 1 is a speck. Opponent pips stay an icon. A hand card gets the word.
      const showWords = wordScale >= 2
      const iconScale = fitScale(widthPx, art.icon[0]?.length ?? 1, showWords ? (size === 'compact' ? 0.42 : 0.34) : 0.84)
      return shell(
        ink,
        'f7-face f7-face-action',
        <>
          <InkSprite bitmap={art.icon} inks={{ K: ink }} scale={iconScale} />
          {showWords &&
            art.words.map((word) => <InkSprite key={word} bitmap={wordBitmap(word)} inks={{ X: ink }} scale={wordScale} />)}
        </>,
      )
    }
    const text = faceText(face)
    const numeral = face.kind === 'number'
    // A modifier is the card. The mark fills a phone extra, not a caption under a glyph.
    const fontSize = numeral
      ? widthPx * (text.length > 1 ? 0.52 : 0.78)
      : widthPx * (text.length > 2 ? 0.74 : 0.86)
    return shell(
      ink,
      numeral ? 'f7-face f7-face-num' : 'f7-face f7-face-mod',
      <>
        {!numeral && (
          <div className="f7-burst">
            <PixelSprite bitmap={burstIcon} color={ink} scale={fitScale(widthPx, burstIcon[0]?.length ?? 1, 0.86)} glow={false} />
          </div>
        )}
        <span className="f7-face-mark" style={{ fontSize }}>
          {text}
        </span>
      </>,
    )
  },
}

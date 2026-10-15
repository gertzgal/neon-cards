import type { CSSProperties } from 'react'
import type { CardFaceRenderer } from '../api'
import { bitmaps, PixelSprite, pixelScale } from '../primitives/pixel'
import type { Tone } from '../theme/tokens'

/** The Flip 7 face shape from docs/architecture.md. The gallery uses it to prove faces are game-defined. */
export type Flip7Face =
  | { kind: 'number'; value: number }
  | { kind: 'modifier'; op: 'add'; value: 2 | 4 | 6 | 8 | 10 }
  | { kind: 'modifier'; op: 'times'; value: 2 }
  | { kind: 'action'; action: 'freeze' | 'flipThree' | 'secondChance' }

const NUMBER_INK = ['#d5d0e6', '#ff4d3a', '#ff8a1e', '#ffe14a', '#b6ff3c', '#3dff8a', '#2ef2ff', '#7aa6ff', '#c084ff', '#ff2e88', '#ff5a7a', '#ff7a3c', '#ffd23f']
const ADD_INK: Record<2 | 4 | 6 | 8 | 10, string> = { 2: '#5dffa8', 4: '#3dff6a', 6: '#2ee6c8', 8: '#7fd7ff', 10: '#ffd23f' }

const actionArt = {
  freeze: { tone: 'cyan' as const, ink: '#9af6ff', bitmap: bitmaps.snowflake, label: 'FREEZE' },
  flipThree: { tone: 'gold' as const, ink: '#ffe14a', bitmap: bitmaps.bolt, label: 'FLIP 3' },
  secondChance: { tone: 'cyan' as const, ink: '#7dff6a', bitmap: bitmaps.shield, label: '2ND CHANCE' },
}

function textOf(face: Flip7Face): string {
  if (face.kind === 'number') return String(face.value)
  if (face.kind === 'modifier') return face.op === 'add' ? `+${face.value}` : 'x2'
  return actionArt[face.action].label
}

function inkOf(face: Flip7Face): string {
  if (face.kind === 'number') return NUMBER_INK[face.value] ?? NUMBER_INK[0] ?? '#fff'
  if (face.kind === 'modifier') return face.op === 'add' ? ADD_INK[face.value] : '#fff3b0'
  return actionArt[face.action].ink
}

function toneOf(face: Flip7Face): Tone {
  if (face.kind === 'modifier') return 'gold'
  if (face.kind === 'action') return actionArt[face.action].tone
  if (face.value >= 9) return 'pink'
  if (face.value >= 5) return 'violet'
  if (face.value === 0) return 'ink'
  return 'cyan'
}

export const flip7FaceRenderer: CardFaceRenderer<Flip7Face> = {
  deck: 'flip7',
  tone: toneOf,
  accent: inkOf,
  label: textOf,
  render(face, { widthPx }) {
    const ink = inkOf(face)
    const text = textOf(face)
    const style: CSSProperties = {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6%',
      background: `radial-gradient(circle at 50% 44%, color-mix(in srgb, ${ink} 58%, #14121c), #0c0a12 74%)`,
      boxShadow: `inset 0 0 0 3px color-mix(in srgb, ${ink} 82%, transparent)`,
      color: ink,
      textShadow: `0 0 8px ${ink}`,
      lineHeight: 0.8,
      fontSize: widthPx * (text.length > 6 ? 0.16 : text.length > 2 ? 0.28 : text.length > 1 ? 0.5 : 0.72),
      textAlign: 'center',
    }
    if (face.kind === 'action') {
      const art = actionArt[face.action]
      return (
        <div style={style}>
          <PixelSprite bitmap={art.bitmap} color={ink} scale={pixelScale(widthPx, art.bitmap[0]?.length ?? 1, 0.42)} glow={false} />
          <span>{art.label}</span>
        </div>
      )
    }
    return <div style={style}>{text}</div>
  },
}

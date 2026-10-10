// Values from docs/look-and-feel-brief.md and the prototype (docs/reference/prototype-reference.html).

export const palette = {
  bg: '#050409',
  table: '#0b0b12',
  pink: '#ff2e88',
  pinkSoft: '#ff7ab4',
  cyan: '#2ef2ff',
  violet: '#a64dff',
  gold: '#ffd23f',
  bust: '#ff2e5a',
  ink: '#f4f0ff',
  dim: '#8d87a8',
  cardFace: '#0e0b16',
  panel: 'rgba(10, 8, 18, 0.88)',
  panelRim: '#241f36',
} as const

/** Semantic neon accents. Pink is the player, wins and main buttons; cyan is the dealer, info and secondary. */
export type Tone = 'pink' | 'cyan' | 'violet' | 'gold' | 'ink'

export const toneColor: Record<Tone, string> = {
  pink: palette.pink,
  cyan: palette.cyan,
  violet: palette.violet,
  gold: palette.gold,
  ink: palette.ink,
}

/** Chip denominations and their single color each (brief: 5 cyan, 25 pink, 100 violet, 500 gold). */
export const chipValues = [5, 25, 100, 500] as const
export type ChipValue = (typeof chipValues)[number]
export const chipColor: Record<ChipValue, string> = {
  5: palette.cyan,
  25: palette.pink,
  100: palette.violet,
  500: palette.gold,
}

export const font = {
  family: '"Jersey 10", ui-monospace, monospace',
} as const

/** Milliseconds. Every effect stays short so hand after hand never waits. */
export const durations = {
  dealFly: 230,
  dealSquash: 150,
  dealGap: 60,
  flipOut: 110,
  flipIn: 220,
  slide: 220,
  shakeSmall: 300,
  shakeBig: 420,
  flash: 700,
  flashBig: 900,
  numberPop: 1100,
  numberPopBig: 1900,
  chipFly: 320,
  chipBurst: 1300,
  badgePulse: 960,
  thinkingBeat: 500,
  bankrollCount: 400,
} as const

export const easing = {
  fly: 'cubic-bezier(.2,.9,.3,1)',
  chip: 'cubic-bezier(.3,.7,.4,1)',
  out: 'ease-out',
  in: 'ease-in',
} as const

/** Below this width the table uses the phone composition. */
export const phoneMaxWidth = 699

export const zIndex = {
  swirl: 0,
  stage: 1,
  fx: 30,
  flash: 29,
  pop: 31,
  crt: 40,
} as const

export const theme = { palette, toneColor, chipValues, chipColor, font, durations, easing, phoneMaxWidth, zIndex } as const
export type Theme = typeof theme

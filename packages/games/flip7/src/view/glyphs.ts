/** 3×5 pixel letters. Action names are sprites so the table's text stays FLIP and BUST. */
const GLYPH: Record<string, readonly string[]> = {
  A: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  C: ['.XX', 'X..', 'X..', 'X..', '.XX'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  F: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  N: ['X.X', 'XXX', 'X.X', 'X.X', 'X.X'],
  O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
}

export function wordBitmap(word: string): string[] {
  const rows: [string, string, string, string, string] = ['', '', '', '', '']
  const chars = [...word]
  chars.forEach((ch, i) => {
    const glyph = GLYPH[ch]
    if (!glyph) throw new Error(`no glyph for ${ch}`)
    const gap = i === chars.length - 1 ? '' : '.'
    for (let y = 0; y < 5; y++) {
      const row = rows[y]
      const line = glyph[y]
      if (row === undefined || line === undefined) throw new Error(`glyph row ${ch}`)
      rows[y] = row + line + gap
    }
  })
  return [...rows]
}

export const freezeIcon = [
  '.......K.......',
  '......KKK......',
  '.....K.K.K.....',
  '......KKK......',
  '.K...KKKKK...K.',
  '..K..KKKKK..K..',
  'KKKKK.KKK.KKKKK',
  '.KKKK.K.K.KKKK.',
  'KKKKK.KKK.KKKKK',
  '..K..KKKKK..K..',
  '.K...KKKKK...K.',
  '......KKK......',
  '.....K.K.K.....',
  '......KKK......',
  '.......K.......',
]

export const flipThreeIcon = [
  '........KKKKKK..',
  '......KKKK.KKKK.',
  '..KKKKK.K..K.KK.',
  '.K..K.K..K..KKK.',
  '.K..K.K..KKKK...',
  '.K..KKKKK.......',
  '.KKKKK..........',
  '................',
  '....KKKKKKK.....',
  '...K.......K....',
  '..K.........K...',
  '...K.......K....',
  '....KKKKKKK.....',
]

export const secondChanceIcon = [
  '...KKKKKKKK...',
  '..K........K..',
  '.K...KKKK...K.',
  'K...K....K...K',
  'K...K.KK.K...K',
  'K....K..K....K',
  '.K...KKKK...K.',
  '..K........K..',
  '...K..KK..K...',
  '....K....K....',
  '...K......K...',
  '..K........K..',
  '...KKKKKKKK...',
  '..........K...',
  '.........K....',
]

/** Rays behind a modifier so the + or × reads as its own card. */
export const burstIcon = [
  'X..............X',
  '.X.....XX.....X.',
  '..X...X..X...X..',
  '...X.X....X.X...',
  '....X......X....',
  '..XXX......XXX..',
  '....X......X....',
  '...X.X....X.X...',
  '..X...X..X...X..',
  '.X.....XX.....X.',
  'X..............X',
]

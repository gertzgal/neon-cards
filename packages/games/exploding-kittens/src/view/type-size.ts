import type { Title } from '../rules/types'

/** Jersey 10 advance, measured, with a hair of room so a line does not clip. */
const CHAR = 0.44

/** Titles broken on words so a phone hand can set them large. */
export const TITLE_LINES: Record<Title, readonly string[]> = {
  kitten: ['EXPLODING', 'KITTEN'],
  defuse: ['DEFUSE'],
  nope: ['NOPE'],
  attack: ['ATTACK'],
  skip: ['SKIP'],
  favor: ['FAVOR'],
  shuffle: ['SHUFFLE'],
  future: ['SEE THE', 'FUTURE'],
  tacocat: ['TACOCAT'],
  hairyPotato: ['HAIRY', 'POTATO', 'CAT'],
  cattermelon: ['CATTERMELON'],
  beard: ['BEARD', 'CAT'],
  rainbowRalphing: ['RAINBOW', 'RALPHING', 'CAT'],
}

/** Largest font that keeps every title line on one row, inside a top band. */
export function titleFont(widthPx: number, lines: readonly string[]): number {
  const height = widthPx / 0.74
  const band = height * (lines.length >= 3 ? 0.46 : lines.length === 2 ? 0.38 : 0.26)
  const maxPx = Math.max(1, Math.floor(band / lines.length))
  const longest = lines.reduce((best, line) => (line.length > best.length ? line : best))
  const byWidth = Math.floor((widthPx * 0.9) / (longest.length * CHAR))
  return Math.max(1, Math.min(maxPx, byWidth))
}

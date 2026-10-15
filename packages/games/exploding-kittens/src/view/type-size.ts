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

function fits(inner: number, text: string, font: number): boolean {
  return text.length * CHAR * font <= inner
}

/** Largest font that wraps `text` onto at most two lines inside the card. */
export function ruleFont(widthPx: number, rule: string): number {
  const inner = widthPx * 0.9
  const maxPx = Math.max(8, Math.floor((widthPx / 0.74) * 0.15))
  const words = rule.split(' ')
  for (let font = maxPx; font >= 8; font--) {
    let lines = 1
    let line = ''
    let ok = true
    for (const word of words) {
      if (!fits(inner, word, font)) {
        ok = false
        break
      }
      const next = line ? `${line} ${word}` : word
      if (fits(inner, next, font)) line = next
      else {
        lines += 1
        line = word
      }
    }
    if (ok && lines <= 2) return font
  }
  return 8
}

/** Largest font that keeps every title line on one row, inside a top band. */
export function titleFont(widthPx: number, lines: readonly string[]): number {
  const height = widthPx / 0.74
  const band = height * (lines.length >= 3 ? 0.46 : lines.length === 2 ? 0.38 : 0.26)
  const maxPx = Math.max(8, Math.floor(band / lines.length))
  const longest = lines.reduce((best, line) => (line.length > best.length ? line : best))
  const byWidth = Math.floor((widthPx * 0.9) / (longest.length * CHAR))
  return Math.max(8, Math.min(maxPx, byWidth))
}

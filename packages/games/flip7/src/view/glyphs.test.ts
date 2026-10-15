import { describe, expect, it } from 'vitest'
import { burstIcon, flipThreeIcon, freezeIcon, secondChanceIcon, wordBitmap } from './glyphs'

function even(bitmap: readonly string[]) {
  const width = bitmap[0]?.length ?? 0
  expect(width).toBeGreaterThan(0)
  for (const row of bitmap) expect(row).toHaveLength(width)
}

describe('flip 7 glyphs', () => {
  it('builds rectangular words and icons', () => {
    for (const word of ['FREEZE', 'FLIP', 'THREE', 'SECOND', 'CHANCE']) {
      const bitmap = wordBitmap(word)
      even(bitmap)
      expect(bitmap.join('')).toMatch(/^[X.]+$/)
    }
    even(freezeIcon)
    even(flipThreeIcon)
    even(secondChanceIcon)
    even(burstIcon)
  })
})

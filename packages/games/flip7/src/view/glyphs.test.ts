import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Flip7Face } from '@neon-cards/engine'
import { faceRule, flip7Face, ruleScale } from './face'
import { burstIcon, flipThreeIcon, freezeIcon, lineBitmap, secondChanceIcon, wordBitmap } from './glyphs'

function even(bitmap: readonly string[]) {
  const width = bitmap[0]?.length ?? 0
  expect(width).toBeGreaterThan(0)
  for (const row of bitmap) expect(row).toHaveLength(width)
}

describe('flip 7 glyphs', () => {
  it('builds rectangular words and icons', () => {
    for (const word of ['FREEZE', 'FLIP', 'THREE', 'SECOND', 'CHANCE', 'STOP', 'MORE', 'SAFE', 'ADD', 'TWO']) {
      const bitmap = wordBitmap(word)
      even(bitmap)
      expect(bitmap.join('')).toMatch(/^[X.]+$/)
      if (['STOP', 'MORE', 'SAFE', 'ADD', 'TWO'].includes(word)) expect(bitmap[0]?.length).toBeLessThanOrEqual(15)
    }
    even(freezeIcon)
    even(flipThreeIcon)
    even(secondChanceIcon)
    even(burstIcon)
  })

  it('prints a rule on specials without adding letters to the table text', () => {
    const faces: Flip7Face[] = [
      { kind: 'action', action: 'freeze' },
      { kind: 'action', action: 'flipThree' },
      { kind: 'action', action: 'secondChance' },
      { kind: 'modifier', op: 'add', value: 4 },
      { kind: 'modifier', op: 'times', value: 2 },
      { kind: 'number', value: 7 },
    ]
    for (const face of faces) {
      const html = renderToStaticMarkup(createElement('div', null, flip7Face.render(face, { widthPx: 36, size: 'compact' })))
      const text = html.replace(/<[^>]+>/g, '')
      expect(text).not.toMatch(/[A-Za-z]/)
      const rule = faceRule(face)
      if (rule) {
        const scale = ruleScale(36, lineBitmap(rule)[0]?.length ?? 1)
        expect(scale).toBeGreaterThanOrEqual(2)
        expect(html).toContain(`height="${5 * scale}"`)
      } else {
        expect(html).not.toContain('f7-face-rule')
      }
    }
  })
})

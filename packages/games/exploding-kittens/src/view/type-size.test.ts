import { describe, expect, it } from 'vitest'
import { TITLE_ORDER } from '../rules/types'
import { scenes } from './art'
import { TITLE_LINES, titleFont } from './type-size'

describe('phone hand type', () => {
  it('keeps titles large on a shrunk phone hand', () => {
    for (const title of TITLE_ORDER) {
      const lines = TITLE_LINES[title]
      expect(lines.length).toBeGreaterThan(0)
      expect(titleFont(95, lines)).toBeGreaterThanOrEqual(16)
      const fitted = titleFont(36, lines)
      const longest = lines.reduce((best, line) => (line.length > best.length ? line : best))
      expect(fitted * longest.length * 0.44).toBeLessThanOrEqual(36 * 0.9 + 0.5)
      expect(scenes[title].rule.length).toBeGreaterThan(8)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { TITLE_ORDER } from '../rules/types'
import { scenes } from './art'

describe('exploding kittens scenes', () => {
  it('gives every title a colored scene and a rule line', () => {
    for (const title of TITLE_ORDER) {
      const scene = scenes[title]
      expect(scene.art.length).toBeGreaterThan(8)
      const width = scene.art[0]?.length ?? 0
      expect(width).toBeGreaterThan(8)
      for (const row of scene.art) {
        expect(row).toHaveLength(width)
        for (const ch of row) {
          if (ch !== '.') expect(scene.inks[ch]).toBeTruthy()
        }
      }
      expect(scene.rule.length).toBeGreaterThan(8)
      expect(scene.accent.startsWith('#')).toBe(true)
      expect(scene.short.length).toBeGreaterThan(2)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { auditPlacement } from './audit'
import { placeTable, type Frame } from './place'
import { VIEWPORTS, longRows, roomRows, shellChrome } from './scenarios'

describe('auditPlacement', () => {
  it('fails the phone boxes measured on #85 and the desktop rights from #95', () => {
    const phone = VIEWPORTS.phone390
    // y is not in the cursor[bot] comment. These y values stay inside 844 so the
    // failure is the recorded horizontal clip, not a made-up vertical one.
    const nope: Frame = { id: 'nope', rowId: 'hand', x: 336, y: 200, w: 150, h: 80 }
    const bottom: Frame = { id: 'bottom', rowId: 'buttons', x: 638, y: 600, w: 64, h: 40 }
    const phoneIssues = auditPlacement(phone, [nope, bottom])
    expect(phoneIssues).toContainEqual({ kind: 'clip', id: 'nope', edge: 'right', value: 486, limit: 390 })
    expect(phoneIssues).toContainEqual({ kind: 'clip', id: 'bottom', edge: 'right', value: 702, limit: 390 })

    const desktop = VIEWPORTS.desktop1440
    const past = [1479, 1609, 1738].map((right, index) => ({
      id: `hand-${10 + index}`,
      rowId: 'hand',
      x: right - 180,
      y: 300,
      w: 180,
      h: 220,
    }))
    const desktopIssues = auditPlacement(desktop, past)
    const clipped = desktopIssues.filter((issue) => issue.kind === 'clip')
    expect(clipped.map((issue) => issue.value)).toEqual([1479, 1609, 1738])
  })

  it('fails a hud chip covering a score when both boxes are inside the viewport', () => {
    const viewport = VIEWPORTS.phone390
    const chip: Frame = { id: 'hud-chip', rowId: 'hud', x: 16, y: 20, w: 120, h: 36 }
    const score: Frame = { id: 'score-0', rowId: 'score', x: 90, y: 40, w: 80, h: 28 }
    for (const frame of [chip, score]) {
      expect(frame.x).toBeGreaterThanOrEqual(0)
      expect(frame.y).toBeGreaterThanOrEqual(0)
      expect(frame.x + frame.w).toBeLessThanOrEqual(viewport.width)
      expect(frame.y + frame.h).toBeLessThanOrEqual(viewport.height)
    }
    const issues = auditPlacement(viewport, [chip, score])
    expect(issues.some((issue) => issue.kind === 'clip')).toBe(false)
    expect(issues).toContainEqual({ kind: 'overlap', a: 'hud-chip', b: 'score-0' })
  })

  it('passes the engine at all four viewports, including hud-chip against score', () => {
    for (const viewport of Object.values(VIEWPORTS)) {
      for (const rows of [longRows(8), longRows(13), roomRows()]) {
        const frames = placeTable(viewport, shellChrome(viewport), rows).frames
        const issues = auditPlacement(viewport, frames)
        expect(issues).toEqual([])
        const chip = frames.find((frame) => frame.id === 'hud-chip')
        const score = frames.find((frame) => frame.rowId === 'score')
        expect(chip).toBeDefined()
        expect(score).toBeDefined()
      }
    }
  })
})

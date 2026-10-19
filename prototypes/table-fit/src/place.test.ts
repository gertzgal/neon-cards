import { describe, expect, it } from 'vitest'
import { auditPlacement } from './audit'
import { MIN_ITEM, placeTable, type FitRow, type Frame, type Viewport } from './place'
import { VIEWPORTS, longRows, roomRows, shellChrome } from './scenarios'

function rowFrames(frames: readonly Frame[], rowId: string): Frame[] {
  return frames.filter((frame) => frame.rowId === rowId)
}

function lineCounts(frames: readonly Frame[]): number[] {
  const counts = new Map<number, number>()
  for (const frame of frames) counts.set(frame.y, (counts.get(frame.y) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1])
}

function maxRight(frames: readonly Frame[]): number {
  return frames.reduce((max, frame) => Math.max(max, frame.x + frame.w), 0)
}

function place(viewport: Viewport, rows: readonly FitRow[]) {
  const frames = placeTable(viewport, shellChrome(viewport), rows).frames
  expect(auditPlacement(viewport, frames)).toEqual([])
  return frames
}

describe('placeTable', () => {
  it('fits an 8-card hand and 23 slots at all four viewports', () => {
    for (const viewport of Object.values(VIEWPORTS)) {
      const frames = place(viewport, longRows(8))
      expect(rowFrames(frames, 'hand')).toHaveLength(8)
      expect(rowFrames(frames, 'slots')).toHaveLength(23)
      expect(rowFrames(frames, 'buttons')).toHaveLength(2)
      expect(rowFrames(frames, 'score')).toHaveLength(1)
      expect(frames.some((frame) => frame.id === 'hud-chip')).toBe(true)
    }
  })

  it('fits a 13-card hand and 23 slots at all four viewports', () => {
    for (const viewport of Object.values(VIEWPORTS)) {
      const frames = place(viewport, longRows(13))
      expect(rowFrames(frames, 'hand')).toHaveLength(13)
      expect(rowFrames(frames, 'slots')).toHaveLength(23)
      const last = rowFrames(frames, 'hand').at(-1)
      expect(last).toBeDefined()
      expect((last?.x ?? 0) + (last?.w ?? 0)).toBeLessThanOrEqual(viewport.width)
    }
  })

  it('places a multiplayer table with the same function and no second size', () => {
    for (const viewport of [VIEWPORTS.phone360, VIEWPORTS.phone390]) {
      const frames = place(viewport, roomRows())
      expect(rowFrames(frames, 'opponent-a')).toHaveLength(5)
      expect(rowFrames(frames, 'opponent-b')).toHaveLength(5)
      expect(rowFrames(frames, 'opponent-c')).toHaveLength(4)
      expect(rowFrames(frames, 'hand')).toHaveLength(8)
      expect(rowFrames(frames, 'buttons')).toHaveLength(4)
      const hand = rowFrames(frames, 'hand')[0]
      const opponent = rowFrames(frames, 'opponent-a')[0]
      expect(hand).toBeDefined()
      expect(opponent).toBeDefined()
      if (!hand || !opponent) continue
      expect(hand.w / hand.h).toBeCloseTo(opponent.w / opponent.h, 1)
    }
  })

  it('wraps 23 slots at 360 instead of shrinking under the floor', () => {
    const width = VIEWPORTS.phone360.width
    expect(23 * MIN_ITEM).toBe(736)
    expect(23 * MIN_ITEM).toBeGreaterThan(width)
    const slots = rowFrames(place(VIEWPORTS.phone360, longRows(8)), 'slots')
    expect(lineCounts(slots)).toEqual([8, 8, 7])
    expect(slots[0]?.w).toBeGreaterThanOrEqual(MIN_ITEM)
    expect(slots[0]?.h).toBeGreaterThanOrEqual(MIN_ITEM)
    expect(maxRight(slots)).toBeLessThanOrEqual(width)
  })

  it('keeps every item at the floor when chrome is taller than the viewport', () => {
    const viewport = VIEWPORTS.phone360
    expect(10_000).toBeGreaterThan(viewport.height)
    const frames = placeTable(viewport, { top: 10_000, bottom: 10_000 }, longRows(8)).frames
    expect(auditPlacement(viewport, frames)).toEqual([])
    expect(rowFrames(frames, 'hand')).toHaveLength(8)
    expect(rowFrames(frames, 'slots')).toHaveLength(23)
    for (const frame of frames) {
      expect(frame.y + frame.h).toBeLessThanOrEqual(viewport.height)
      expect(frame.x + frame.w).toBeLessThanOrEqual(viewport.width)
      if (frame.rowId === 'hud') continue
      expect(frame.w).toBeGreaterThanOrEqual(MIN_ITEM)
      expect(frame.h).toBeGreaterThanOrEqual(MIN_ITEM)
    }
  })

  it('keeps a short viewport inside the floor instead of clipping', () => {
    const viewport = { width: 360, height: 200 }
    const frames = placeTable(viewport, { top: 0, bottom: 0 }, longRows(8)).frames
    const issues = auditPlacement(viewport, frames)
    expect(issues.filter((issue) => issue.kind === 'clip')).toEqual([])
    expect(issues.filter((issue) => issue.kind === 'floor')).toEqual([])
    expect(rowFrames(frames, 'slots').length).toBeGreaterThan(0)
  })

  it('caps a two-button row that would otherwise be 720 by 360', () => {
    const uncappedW = Math.floor(VIEWPORTS.desktop1440.width / 2)
    const uncappedH = Math.floor(uncappedW / 2)
    expect(uncappedW).toBe(720)
    expect(uncappedH).toBe(360)
    const frames = place(VIEWPORTS.desktop1440, longRows(8))
    const buttons = rowFrames(frames, 'buttons')
    const hand = rowFrames(frames, 'hand')
    expect(buttons[0]?.w).toBe(64)
    expect(buttons[0]?.h).toBe(32)
    expect(buttons[0]?.h).toBeLessThan(uncappedH)
    expect(buttons[0]?.h).toBeLessThan(hand[0]?.h ?? 0)
  })

  it('locks the boxes quoted in the spec', () => {
    const hand = (viewport: Viewport, cards: number) => rowFrames(place(viewport, longRows(cards)), 'hand')
    expect(hand(VIEWPORTS.phone360, 8)[0]).toMatchObject({ x: 0, y: 410, w: 45, h: 63 })
    expect(hand(VIEWPORTS.phone390, 8)[0]).toMatchObject({ x: 3, y: 681, w: 48, h: 67 })
    expect(hand(VIEWPORTS.desktop1280, 8)[0]).toMatchObject({ x: 0, y: 489, w: 160, h: 224 })
    expect(hand(VIEWPORTS.desktop1440, 8)[0]).toMatchObject({ x: 0, y: 554, w: 180, h: 252 })

    const slots = (viewport: Viewport) => {
      const group = rowFrames(place(viewport, longRows(8)), 'slots')
      return {
        w: group[0]?.w,
        h: group[0]?.h,
        lines: lineCounts(group),
        right: maxRight(group),
        y: group[0]?.y,
      }
    }
    expect(slots(VIEWPORTS.phone360)).toEqual({ w: 45, h: 45, lines: [8, 8, 7], right: 360, y: 473 })
    expect(slots(VIEWPORTS.phone390)).toEqual({ w: 32, h: 32, lines: [12, 11], right: 387, y: 748 })
    expect(slots(VIEWPORTS.desktop1280)).toEqual({ w: 55, h: 55, lines: [23], right: 1272, y: 713 })
    expect(slots(VIEWPORTS.desktop1440)).toEqual({ w: 62, h: 62, lines: [23], right: 1433, y: 806 })

    const buttons = (viewport: Viewport) => rowFrames(place(viewport, longRows(8)), 'buttons')[0]
    expect(buttons(VIEWPORTS.phone360)).toMatchObject({ x: 116, y: 608, w: 64, h: 32 })
    expect(buttons(VIEWPORTS.phone390)).toMatchObject({ x: 131, y: 812, w: 64, h: 32 })
    expect(buttons(VIEWPORTS.desktop1280)).toMatchObject({ x: 576, y: 768, w: 64, h: 32 })
    expect(buttons(VIEWPORTS.desktop1440)).toMatchObject({ x: 656, y: 868, w: 64, h: 32 })

    const score = (viewport: Viewport) => rowFrames(place(viewport, longRows(8)), 'score')[0]
    expect(score(VIEWPORTS.phone360)).toMatchObject({ x: 116, y: 378, w: 128, h: 32 })
    expect(score(VIEWPORTS.phone390)).toMatchObject({ x: 131, y: 649, w: 128, h: 32 })
    expect(score(VIEWPORTS.desktop1280)).toMatchObject({ x: 576, y: 457, w: 128, h: 32 })
    expect(score(VIEWPORTS.desktop1440)).toMatchObject({ x: 656, y: 522, w: 128, h: 32 })

    expect(lineCounts(hand(VIEWPORTS.phone360, 13))).toEqual([7, 6])
    expect(hand(VIEWPORTS.phone360, 13)[0]).toMatchObject({ x: 1, y: 331, w: 51, h: 71 })
    expect(maxRight(hand(VIEWPORTS.phone360, 13))).toBe(358)
    expect(lineCounts(hand(VIEWPORTS.phone390, 13))).toEqual([7, 6])
    expect(hand(VIEWPORTS.phone390, 13)[0]).toMatchObject({ x: 2, y: 594, w: 55, h: 77 })
    expect(maxRight(hand(VIEWPORTS.phone390, 13))).toBe(387)
    expect(hand(VIEWPORTS.desktop1280, 13)[0]).toMatchObject({ x: 3, y: 576, w: 98, h: 137 })
    expect(maxRight(hand(VIEWPORTS.desktop1280, 13))).toBe(1277)
    expect(hand(VIEWPORTS.desktop1440, 13)[0]).toMatchObject({ x: 5, y: 652, w: 110, h: 154 })
    expect(maxRight(hand(VIEWPORTS.desktop1440, 13))).toBe(1435)

    expect(rowFrames(place(VIEWPORTS.phone360, roomRows()), 'hand')[0]).toMatchObject({ w: 45, h: 63 })
    expect(rowFrames(place(VIEWPORTS.phone390, roomRows()), 'hand')[0]).toMatchObject({ w: 48, h: 67 })
    expect(rowFrames(place(VIEWPORTS.phone360, roomRows()), 'opponent-a')[0]).toMatchObject({
      x: 0,
      y: 187,
      w: 72,
      h: 100,
    })
    expect(rowFrames(place(VIEWPORTS.phone360, roomRows()), 'opponent-c')[0]).toMatchObject({
      x: 0,
      y: 387,
      w: 90,
      h: 126,
    })
    expect(rowFrames(place(VIEWPORTS.phone390, roomRows()), 'opponent-a')[0]).toMatchObject({
      x: 0,
      y: 358,
      w: 78,
      h: 109,
    })
    expect(rowFrames(place(VIEWPORTS.phone390, roomRows()), 'opponent-c')[0]).toMatchObject({
      x: 1,
      y: 576,
      w: 97,
      h: 135,
    })
    const roomScore = rowFrames(place(VIEWPORTS.phone390, roomRows()), 'score')[0]
    expect(roomScore).toMatchObject({ h: 33 })
    expect(roomScore?.h).toBeLessThan(67)

    const hostile = placeTable(VIEWPORTS.phone360, { top: 10_000, bottom: 10_000 }, longRows(8)).frames
    expect(rowFrames(hostile, 'hand')[0]).toMatchObject({ x: 0, y: 221, w: 45, h: 63 })
    expect(maxRight(rowFrames(hostile, 'hand'))).toBe(360)
    expect(rowFrames(hostile, 'hud')[0]).toMatchObject({ h: 189 })
  })

  it('has no scale, gap, scroll, or fan input', () => {
    const viewport = VIEWPORTS.phone390
    const chrome = shellChrome(viewport)
    // @ts-expect-error a per-game scale is not a placeTable input
    void placeTable(viewport, chrome, [{ id: 'hand', count: 8, role: 'hand', scale: 0.8 }])
    // @ts-expect-error scroll-into-view is not a placeTable input
    void placeTable(viewport, chrome, [{ id: 'hand', count: 8, role: 'hand', scrollTo: 'defuse' }])
    // @ts-expect-error a row gap is not a placeTable input
    void placeTable(viewport, chrome, [{ id: 'hand', count: 8, role: 'hand', gap: 12 }])
    // @ts-expect-error a fan is not a fit row
    void placeTable(viewport, chrome, [{ id: 'hand', count: 8, role: 'fan' }])
    const keys = ['id', 'count', 'role'] as const
    const sample: FitRow = { id: 'hand', count: 8, role: 'hand' }
    expect(Object.keys(sample).sort()).toEqual([...keys].sort())
  })
})

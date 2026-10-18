import { describe, expect, it } from 'vitest'
import { auditPlacement } from './audit'
import { placeTable, type FitRow, type Frame, type Viewport } from './place'
import { VIEWPORTS, longRows, roomRows, shellChrome } from './scenarios'

function rowFrames(frames: readonly Frame[], rowId: string): Frame[] {
  return frames.filter((frame) => frame.rowId === rowId)
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

  it('rejects a card-width floor that cannot hold 23 slots', () => {
    const width = VIEWPORTS.phone360.width
    const floor = 28
    expect(23 * floor).toBe(644)
    expect(23 * floor).toBeGreaterThan(width)
    const slots = rowFrames(place(VIEWPORTS.phone360, longRows(8)), 'slots')
    expect(slots[0]?.w).toBeLessThan(floor)
    const right = (slots.at(-1)?.x ?? 0) + (slots.at(-1)?.w ?? 0)
    expect(right).toBeLessThanOrEqual(width)
  })

  it('clamps chrome that is larger than the viewport and still places the hand', () => {
    const viewport = VIEWPORTS.phone360
    expect(10_000).toBeGreaterThan(viewport.height)
    const frames = placeTable(viewport, { top: 10_000, bottom: 10_000 }, longRows(8)).frames
    expect(auditPlacement(viewport, frames)).toEqual([])
    expect(rowFrames(frames, 'hand')).toHaveLength(8)
    expect(rowFrames(frames, 'slots')).toHaveLength(23)
    for (const frame of frames) {
      expect(frame.y + frame.h).toBeLessThanOrEqual(viewport.height)
      expect(frame.x + frame.w).toBeLessThanOrEqual(viewport.width)
      expect(frame.w).toBeGreaterThan(0)
      expect(frame.h).toBeGreaterThan(0)
    }
  })

  it('caps a two-button row that would otherwise be 720 by 360', () => {
    const uncappedW = Math.floor(VIEWPORTS.desktop1440.width / 2)
    const uncappedH = Math.floor(uncappedW / 2)
    expect(uncappedW).toBe(720)
    expect(uncappedH).toBe(360)
    const buttons = rowFrames(place(VIEWPORTS.desktop1440, longRows(8)), 'buttons')
    expect(buttons[0]?.h).toBe(207)
    expect(buttons[0]?.h).toBeLessThan(uncappedH)
  })

  it('locks the boxes quoted in the spec', () => {
    const hand = (viewport: Viewport, cards: number) => rowFrames(place(viewport, longRows(cards)), 'hand')
    expect(hand(VIEWPORTS.phone360, 8)[0]).toMatchObject({ x: 0, y: 245, w: 45, h: 63 })
    expect(hand(VIEWPORTS.phone390, 8)[0]).toMatchObject({ x: 3, y: 320, w: 48, h: 67 })
    expect(hand(VIEWPORTS.desktop1280, 8)[0]).toMatchObject({ x: 120, y: 253, w: 130, h: 182 })
    expect(hand(VIEWPORTS.desktop1440, 8)[0]).toMatchObject({ x: 128, y: 278, w: 148, h: 207 })

    const slotRight = (viewport: Viewport) => {
      const group = rowFrames(place(viewport, longRows(8)), 'slots')
      const last = group.at(-1)
      return { w: group[0]?.w, h: group[0]?.h, right: last ? last.x + last.w : 0 }
    }
    expect(slotRight(VIEWPORTS.phone360)).toEqual({ w: 15, h: 15, right: 352 })
    expect(slotRight(VIEWPORTS.phone390)).toEqual({ w: 16, h: 16, right: 379 })
    expect(slotRight(VIEWPORTS.desktop1280)).toEqual({ w: 55, h: 55, right: 1272 })
    expect(slotRight(VIEWPORTS.desktop1440)).toEqual({ w: 62, h: 62, right: 1433 })

    const crowd = hand(VIEWPORTS.desktop1440, 13)
    expect(crowd[0]).toMatchObject({ w: 110, h: 154 })
    expect((crowd.at(-1)?.x ?? 0) + (crowd.at(-1)?.w ?? 0)).toBe(1435)

    expect(rowFrames(place(VIEWPORTS.phone360, roomRows()), 'hand')[0]).toMatchObject({ w: 45, h: 63 })
    expect(rowFrames(place(VIEWPORTS.phone390, roomRows()), 'hand')[0]).toMatchObject({ w: 48, h: 67 })

    const hostile = rowFrames(
      placeTable(VIEWPORTS.phone360, { top: 10_000, bottom: 10_000 }, longRows(8)).frames,
      'hand',
    )
    expect(hostile).toHaveLength(8)
    expect(hostile[0]).toMatchObject({ x: 0, y: 319, w: 45, h: 1 })
    expect((hostile.at(-1)?.x ?? 0) + (hostile.at(-1)?.w ?? 0)).toBe(360)
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

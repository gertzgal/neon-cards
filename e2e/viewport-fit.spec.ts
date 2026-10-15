import { expect, test, type Page } from './fixtures'

/**
 * Production on 2026-10-15, defuse placement, eight cards in hand.
 * Phone 390×844: the fourth card ran from x=336 to x=486, five of the eight cards passed the right edge,
 * eleven of twenty-three slots sat outside the viewport, and Bottom was at x=638–702.
 * Desktop 1440×900: a thirteen-card hand put three cards past x=1440 (rights 1479, 1609, 1738
 * on the old straight row). The bury still worked. This test fails on that overflow
 * and passes once every box is inside.
 */

const table = (page: Page) => page.getByTestId('ek-table')

async function settled(page: Page) {
  await expect(table(page)).toHaveAttribute('data-busy', 'false', { timeout: 20_000 })
}

interface Outside {
  kind: string
  label: string
  left: number
  right: number
  top: number
  bottom: number
}

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }
type El = {
  tagName: string
  matches(selector: string): boolean
  getAttribute(name: string): string | null
  getBoundingClientRect(): Box
  querySelector(selector: string): El | null
  querySelectorAll(selector: string): Iterable<El>
}
type PageGlobals = {
  document: { querySelector(selector: string): El | null }
  getComputedStyle(el: El): { display: string; visibility: string; opacity: string }
  innerWidth: number
  innerHeight: number
}

async function outside(page: Page): Promise<Outside[]> {
  return page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const root = g.document.querySelector('[data-testid="ek-table"], [data-testid="flip7-table"], [data-testid="blackjack-table"]')
    if (!root) return []
    const bad: Outside[] = []
    const seen = new Set<El>()
    const take = (el: El, kind: string) => {
      if (seen.has(el)) return
      seen.add(el)
      const style = g.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      if (r.left >= -1 && r.right <= g.innerWidth + 1 && r.top >= -1 && r.bottom <= g.innerHeight + 1) return
      bad.push({
        kind,
        label: el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName,
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      })
    }
    for (const el of root.querySelectorAll('.nc-card, .bj-card, [data-testid^="insert-"], .f7-slots i, button')) {
      if (el.matches('[data-testid^="insert-"], .f7-slots i')) take(el, 'slot')
      else if (el.matches('.nc-card, .bj-card')) take(el, 'card')
      else if (el.matches('button') && !el.querySelector('.nc-card')) take(el, 'button')
    }
    return bad
  })
}

function formatOutside(rows: Outside[]): string {
  const cards = rows.filter((row) => row.kind === 'card')
  const slots = rows.filter((row) => row.kind === 'slot')
  const buttons = rows.filter((row) => row.kind === 'button')
  const lines = [
    `cards ${cards.length}, slots ${slots.length}, buttons ${buttons.length}`,
    ...rows.map((row) => `${row.kind} ${row.label}: x=${row.left}–${row.right} y=${row.top}–${row.bottom}`),
  ]
  return lines.join('\n')
}

async function widen(page: Page) {
  await page.setViewportSize({ width: 1920, height: 900 })
}

test('eight cards and every defuse slot stay inside the viewport', async ({ page }, testInfo) => {
  await page.goto('/games/exploding-kittens?rig=kitten&seed=ek-viewport-defuse')
  await page.getByTestId('pregame-opponents-3').click()
  await page.getByTestId('pregame-play').click()
  await settled(page)
  await expect(page.getByTestId('you-hand')).toHaveAttribute('data-count', '8')
  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('defuse-kitten')).toBeVisible({ timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-pending', 'defuse')
  await expect(page.getByTestId('inserts')).toHaveAttribute('data-count', '23')
  await expect(page.getByTestId('you-hand').locator('.ek-card-btn')).toHaveCount(8)

  const problems = await outside(page)
  expect(problems, formatOutside(problems)).toEqual([])

  if (testInfo.project.name === 'desktop') {
    await widen(page)
    await expect.poll(async () => outside(page), { timeout: 5_000 }).toEqual([])
    await page.setViewportSize({ width: 1440, height: 900 })
  }

  await page.getByTestId('insert-22').click()
  await expect(table(page)).not.toHaveAttribute('data-pending', 'defuse', { timeout: 20_000 })
  await settled(page)
  expect(await outside(page), 'after the bury').toEqual([])
})

test('a thirteen-card defuse hand stays inside the viewport', async ({ page }, testInfo) => {
  await page.goto('/games/exploding-kittens?rig=crowd&seed=ek-viewport-crowd')
  await page.getByTestId('pregame-play').click()
  await settled(page)
  await expect(page.getByTestId('you-hand')).toHaveAttribute('data-count', '13')
  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('defuse-kitten')).toBeVisible({ timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-pending', 'defuse')
  await expect(page.getByTestId('you-hand').locator('.ek-card-btn')).toHaveCount(13)

  const problems = await outside(page)
  expect(problems, formatOutside(problems)).toEqual([])

  if (testInfo.project.name === 'desktop') {
    await widen(page)
    await expect.poll(async () => outside(page), { timeout: 5_000 }).toEqual([])
    await page.setViewportSize({ width: 1440, height: 900 })
  }

  const slots = Number(await page.getByTestId('inserts').getAttribute('data-count'))
  await page.getByTestId(`insert-${slots - 1}`).click()
  await expect(table(page)).not.toHaveAttribute('data-pending', 'defuse', { timeout: 20_000 })
  await settled(page)
  expect(await outside(page), 'after the bury').toEqual([])
})

test('a long Flip 7 hand and its score stay inside the viewport', async ({ page }, testInfo) => {
  const rig = 'you=8,+4,3,x2,1,+10,2,4,5,6,7;cpu=12,11,10'
  await page.goto(`/games/flip7?rig=${encodeURIComponent(rig)}`)
  await page.getByTestId('pregame-play').click()
  const board = page.getByTestId('flip7-table')
  await expect(board).toHaveAttribute('data-stage', 'playing')
  await expect(board).toHaveAttribute('data-busy', 'false', { timeout: 15_000 })
  for (const value of ['12', '15', '26', '28', '38', '42', '50', '60']) {
    await page.getByTestId('action-hit').click()
    await expect(page.getByTestId('round-value')).toHaveText(value)
    await expect(board).toHaveAttribute('data-busy', 'false', { timeout: 15_000 })
    expect(await outside(page), value).toEqual([])
  }
  const badge = await page.getByTestId('round-value').boundingBox()
  const cards = await page.locator('[data-testid="you-hand"] .nc-card').all()
  const boxes = await Promise.all(cards.map((card) => card.boundingBox()))
  const tops = boxes.flatMap((box) => (box ? [box.y] : []))
  expect(badge).not.toBeNull()
  expect(tops.length).toBeGreaterThan(0)
  expect((badge?.y ?? 0) + (badge?.height ?? 0)).toBeLessThanOrEqual(Math.min(...tops) + 2)

  if (testInfo.project.name === 'desktop') {
    await widen(page)
    await expect.poll(async () => outside(page)).toEqual([])
  }
})

test('a blackjack hand and its buttons stay inside the viewport', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=2H,10C,2S,7D,AH,AS,2C,2D,3H,KS')
  const board = page.getByTestId('blackjack-table')
  await expect(board).toHaveAttribute('data-stage', 'betting')
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  for (const total of ['5/15', '6/16', '8/18', '10/20']) {
    await expect(page.getByTestId('action-hit')).toBeEnabled()
    await page.getByTestId('action-hit').click()
    await expect(page.getByTestId('hand-0-total')).toHaveText(total)
  }
  await expect(board).toHaveAttribute('data-busy', 'false')
  expect(await outside(page)).toEqual([])
  if (testInfo.project.name === 'desktop') {
    await widen(page)
    await expect.poll(async () => outside(page)).toEqual([])
  }
})

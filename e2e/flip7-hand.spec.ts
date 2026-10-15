import { expect, test, type Page } from './fixtures'

const table = (page: Page) => page.getByTestId('flip7-table')

async function settled(page: Page) {
  await expect(table(page)).toHaveAttribute('data-busy', 'false', { timeout: 15_000 })
}

/** Seven number cards plus +4, x2, and +10. Medium CPUs stay on 12. */
const RIG = 'you=8,+4,3,x2,1,+10,2,4,5,6,7;cpu=12,11,10'

interface Box {
  x: number
  y: number
  right: number
  bottom: number
  w: number
  h: number
  style: string
  still: boolean
}

async function cardsOf(page: Page, testId: string): Promise<Box[]> {
  return page.locator(`[data-testid="${testId}"] .nc-card`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect()
      const slot = node.closest('.nc-slot')
      const sway = node.closest('.nc-sway')
      return {
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
        style: slot?.getAttribute('style') ?? '',
        still: sway?.classList.contains('nc-still') ?? false,
      }
    }),
  )
}

/** Why a straight row is off the screen, overlapping, wrapped, rotated, or scrolling. */
async function rowProblems(page: Page, testId: string): Promise<string[]> {
  const viewport = page.viewportSize()
  if (!viewport) return ['no viewport']
  const boxes = (await cardsOf(page, testId)).sort((a, b) => a.x - b.x)
  const bad: string[] = []
  if (boxes.length === 0) bad.push(`${testId}: empty`)
  boxes.forEach((box, i) => {
    if (box.x < -1 || box.right > viewport.width + 1) bad.push(`${testId} card ${i}: x ${Math.round(box.x)}..${Math.round(box.right)}`)
    if (box.y < -1 || box.bottom > viewport.height + 1) bad.push(`${testId} card ${i}: y ${Math.round(box.y)}..${Math.round(box.bottom)}`)
    if (!box.still || box.style.includes('rotate')) bad.push(`${testId} card ${i}: rotated`)
    const prev = boxes[i - 1]
    if (prev && box.x < prev.right - 1) bad.push(`${testId} card ${i}: overlaps by ${Math.round(prev.right - box.x)}`)
  })
  if (boxes.length > 1) {
    const tops = boxes.map((box) => box.y)
    if (Math.max(...tops) - Math.min(...tops) > 2) bad.push(`${testId}: wrapped`)
  }
  const hand = page.getByTestId(testId)
  const scroll = await hand.evaluate((el) => ({
    overflow: el.scrollWidth - el.clientWidth,
    scroller: el.querySelector('.nc-hand-scroll') !== null,
  }))
  if (scroll.overflow > 1) bad.push(`${testId}: scrolls by ${scroll.overflow}`)
  if (scroll.scroller) bad.push(`${testId}: scroll container`)
  return bad
}

async function badgeProblems(page: Page): Promise<string[]> {
  const viewport = page.viewportSize()
  if (!viewport) return ['no viewport']
  const badge = await page.getByTestId('round-value').boundingBox()
  if (!badge) return ['badge missing']
  const bad: string[] = []
  if (badge.x < -1 || badge.x + badge.width > viewport.width + 1) bad.push(`badge x ${Math.round(badge.x)}..${Math.round(badge.x + badge.width)}`)
  if (badge.y < -1 || badge.y + badge.height > viewport.height + 1) bad.push(`badge y ${Math.round(badge.y)}..${Math.round(badge.y + badge.height)}`)
  const cards = await cardsOf(page, 'you-hand')
  const last = cards.reduce((end, card) => Math.max(end, card.right), 0)
  if (cards.length > 0 && badge.x < last - 1) bad.push(`badge covers the row by ${Math.round(last - badge.x)}`)
  return bad
}

test('the opening card is smaller and the score badge stays on screen', async ({ page }) => {
  await page.goto(`/games/flip7?rig=${encodeURIComponent(RIG)}`)
  await page.getByTestId('pregame-play').click()
  await expect(table(page)).toHaveAttribute('data-stage', 'playing')
  await settled(page)
  const hand = page.getByTestId('you-hand')
  await expect(hand).toHaveAttribute('data-layout', 'fit')
  await expect(hand).toHaveAttribute('data-count', '1')
  await expect(page.getByTestId('round-value')).toHaveText('8')
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('no viewport')
  const card = (await cardsOf(page, 'you-hand'))[0]
  if (!card) throw new Error('missing opening card')
  const phone = viewport.width < 700
  expect(card.w).toBeGreaterThan(phone ? 108 : 128)
  expect(card.w).toBeLessThan(phone ? 145 : 170)
  await expect.poll(() => rowProblems(page, 'you-hand')).toEqual([])
  await expect.poll(() => badgeProblems(page)).toEqual([])
})

test('seven numbers plus modifiers stay one straight row with the badge on screen', async ({ page }) => {
  await page.goto(`/games/flip7?rig=${encodeURIComponent(RIG)}`)
  await page.getByTestId('pregame-play').click()
  await expect(table(page)).toHaveAttribute('data-stage', 'playing')
  await settled(page)
  const opening = (await cardsOf(page, 'you-hand'))[0]?.w ?? 0

  for (const value of ['12', '15', '26', '28', '38', '42', '50', '60']) {
    await page.getByTestId('action-hit').click()
    await expect(page.getByTestId('round-value')).toHaveText(value)
    await settled(page)
    await expect.poll(() => rowProblems(page, 'you-hand')).toEqual([])
    await expect.poll(() => badgeProblems(page)).toEqual([])
  }

  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('slots')).toHaveAttribute('data-gold', 'true')
  await expect(table(page)).toHaveAttribute('data-stage', 'roundOver', { timeout: 15_000 })
  await settled(page)
  await expect(page.getByTestId('round-value')).toHaveText('87')
  await expect(page.getByTestId('you-hand')).toHaveAttribute('data-count', '7')
  await expect(page.getByTestId('you-extras').locator('.nc-card')).toHaveCount(3)
  await expect.poll(() => rowProblems(page, 'you-hand')).toEqual([])
  await expect.poll(() => rowProblems(page, 'you-extras')).toEqual([])
  await expect.poll(() => badgeProblems(page)).toEqual([])

  const viewport = page.viewportSize()
  const full = (await cardsOf(page, 'you-hand'))[0]?.w ?? 0
  if ((viewport?.width ?? 0) < 700) expect(full).toBeLessThan(opening - 1)
  else expect(full).toBeLessThanOrEqual(opening + 1)
  expect(full).toBeGreaterThan(28)
})

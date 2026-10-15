import { expect, test } from './fixtures'

test('the opening hand stays inside the screen, with the owed digit', async ({ page }) => {
  await page.goto('/games/exploding-kittens')
  await page.getByTestId('pregame-opponents-3').click()
  await page.getByTestId('pregame-play').click()
  const table = page.getByTestId('ek-table')
  await expect(table).toHaveAttribute('data-busy', 'false')
  await expect(page.getByTestId('you-hand')).toHaveAttribute('data-count', '8')
  await expect(page.getByTestId('owed')).toHaveText('1')
  await expect(page.getByTestId('hud-bankroll')).toHaveCount(0)

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('no viewport')
  const hand = page.getByTestId('you-hand')
  await expect(hand).toHaveAttribute('data-layout', 'strip')
  const cards = page.locator('.ek-card-btn')
  await expect(cards).toHaveCount(8)
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect()
      return { y: r.y, style: node.getAttribute('style') ?? '' }
    }),
  )
  const tops = boxes.map((box) => box.y)
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2)
  for (const box of boxes) expect(box.style).not.toContain('rotate')

  const handBox = await hand.boundingBox()
  const draw = await page.getByTestId('action-draw').boundingBox()
  const dock = await page.getByTestId('play-dock').boundingBox()
  expect(handBox).not.toBeNull()
  expect(draw).not.toBeNull()
  expect(dock).not.toBeNull()
  expect(handBox?.x ?? 0).toBeGreaterThanOrEqual(-1)
  expect((handBox?.x ?? 0) + (handBox?.width ?? 0)).toBeLessThanOrEqual((dock?.x ?? viewport.width) + 1)
  expect((handBox?.y ?? 0) + (handBox?.height ?? 0)).toBeLessThanOrEqual((draw?.y ?? 0) + 1)
})

test('an illegal selection keeps the reason on one line', async ({ page }) => {
  await page.goto('/games/exploding-kittens')
  await page.getByTestId('pregame-opponents-1').click()
  await page.getByTestId('pregame-play').click()
  await expect(page.getByTestId('ek-table')).toHaveAttribute('data-busy', 'false')
  const buttons = page.locator('[data-testid="you-hand"] button')
  const labels = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
  const second = labels.findIndex((label, index) => index > 0 && label !== labels[0])
  await buttons.nth(0).click()
  await buttons.nth(second).click()
  const reason = page.getByTestId('play-reason')
  await expect(reason).toHaveText('Need a matching pair.')
  await expect(page.getByTestId('play-card')).toBeDisabled()
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('no viewport')
  const box = await reason.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.x ?? 0).toBeGreaterThanOrEqual(4)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width - 4)
  if (viewport.width < 700) {
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width - 20)
  }
  const clipped = await reason.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(clipped).toBeLessThanOrEqual(1)
})

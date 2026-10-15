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
  const cards = page.locator('.ek-card-btn')
  await expect(cards).toHaveCount(8)
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect()
      return { x: r.x, right: r.right, y: r.y, bottom: r.bottom }
    }),
  )
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.right).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1)
  }

  const hand = await page.getByTestId('you-hand').boundingBox()
  const draw = await page.getByTestId('action-draw').boundingBox()
  expect(hand).not.toBeNull()
  expect(draw).not.toBeNull()
  expect((hand?.y ?? 0) + (hand?.height ?? 0)).toBeLessThanOrEqual((draw?.y ?? 0) + 1)
})

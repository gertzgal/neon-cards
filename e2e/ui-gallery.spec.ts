import { expect, test } from '@playwright/test'

test.describe('UI kit gallery', () => {
  test('blackjack table matches the mock composition', async ({ page }, testInfo) => {
    await page.goto('/ui-gallery.html?scene=table')
    await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')
    await expect(page.getByTestId('dealer-hand').locator('[data-testid^="card-"]')).toHaveCount(2)
    await expect(page.getByTestId('dealer-hand').getByLabel('face-down card')).toHaveCount(1)
    await expect(page.getByTestId('dealer-total')).toHaveText('9')
    await expect(page.getByTestId('pot-amount')).toHaveText('$50')
    await expect(page.getByTestId('player-total')).toHaveText('16')
    await expect(page.getByTestId('player-hand').getByLabel('8♥')).toBeVisible()
    for (const id of ['hit', 'stand', 'double', 'split']) await expect(page.getByTestId(`action-${id}`)).toBeEnabled()
    await expect(page.getByTestId('edge-swirl')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('gallery-table.png') })
  })

  test('the buttons stay tappable where the cards overlap the felt', async ({ page }) => {
    await page.goto('/ui-gallery.html?scene=table')
    await page.getByTestId('action-hit').click({ trial: true })
    await page.getByTestId('action-stand').click({ trial: true })
  })

  test('betting adds chips to the pot and clear empties it', async ({ page }, testInfo) => {
    await page.goto('/ui-gallery.html?scene=betting')
    await expect(page.getByTestId('pot-amount')).toHaveText('$50')
    await page.getByTestId('chip-100').click()
    await expect(page.getByTestId('pot-amount')).toHaveText('$150')
    await expect(page.getByTestId('hud-bankroll')).toHaveAttribute('data-value', '1100')
    await page.screenshot({ path: testInfo.outputPath('gallery-betting.png') })
    await page.getByTestId('action-clear').click()
    await expect(page.getByTestId('pot-amount')).toHaveText('')
    await expect(page.getByTestId('action-deal')).toBeDisabled()
  })

  for (const n of [1, 2, 3]) {
    test(`opponent rows lay out ${n} CPU seat${n > 1 ? 's' : ''}`, async ({ page }, testInfo) => {
      await page.goto(`/ui-gallery.html?scene=opponents&n=${n}`)
      await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', String(n))
      await expect(page.getByTestId('seat-cpu1')).toHaveAttribute('data-state', 'active')
      await expect(page.getByTestId('seat-cpu1-total')).toHaveText('14')
      await expect(page.getByTestId('seat-cpu1').getByLabel('easy CPU')).toBeVisible()
      await expect(page.getByTestId('seat-cpu1-hand').getByLabel('+4')).toBeVisible()
      await expect(page.getByTestId('player-hand').getByLabel('2ND CHANCE')).toBeVisible()
      await expect(page.getByTestId('hud-bankroll')).toHaveCount(0)
      const boxes = await Promise.all(
        Array.from({ length: n }, (_, i) => page.getByTestId(`seat-cpu${i + 1}`).boundingBox()),
      )
      if (n > 1) {
        const [a, b] = [boxes[0], boxes[1]]
        if (!a || !b) throw new Error('seat boxes missing')
        if (testInfo.project.name === 'phone') expect(b.y).toBeGreaterThan(a.y + a.height - 1)
        else expect(b.x).toBeGreaterThan(a.x + a.width - 1)
      }
      await page.screenshot({ path: testInfo.outputPath(`gallery-opponents-${n}.png`) })
    })
  }

  test('primitive sheet renders both decks, chips, badges and controls', async ({ page }, testInfo) => {
    await page.goto('/ui-gallery.html?scene=sheet')
    await expect(page.getByLabel('FREEZE')).toBeVisible()
    await expect(page.getByLabel('A♠')).toBeVisible()
    await expect(page.getByLabel('face-down card')).toBeVisible()
    await expect(page.getByTestId('sheet-pot-amount')).toHaveText('$785')
    await page.getByTestId('sheet-difficulty-hard').click()
    await expect(page.getByTestId('sheet-difficulty-hard')).toHaveAttribute('aria-checked', 'true')
    await page.screenshot({ path: testInfo.outputPath('gallery-sheet.png'), fullPage: true })
  })
})

test.describe('UI kit juice', () => {
  test('a round plays paced: deals, CPU turns with thinking beats, reveal, then the win', async ({ page }, testInfo) => {
    await page.goto('/ui-gallery.html?scene=juice')
    const demo = page.getByTestId('juice-demo')
    await page.getByTestId('action-deal').click()
    await expect(demo).toHaveAttribute('data-playing', 'true')
    await expect(page.getByTestId('seat-cpu1-status')).toHaveText('THINKING')
    await expect(demo).toHaveAttribute('data-acting', 'cpu2', { timeout: 10_000 })
    await expect(page.getByTestId('seat-cpu1-status')).toHaveText('BUST')
    await expect(demo).toHaveAttribute('data-playing', 'false', { timeout: 10_000 })
    await expect(page.getByTestId('dealer-hand').getByLabel('7♠')).toBeVisible()
    await expect(page.getByTestId('seat-cpu2-status')).toHaveText('STAND')
    await expect(page.getByTestId('fx-layer')).toBeEmpty({ timeout: 5_000 })
    await page.screenshot({ path: testInfo.outputPath('gallery-juice.png') })
  })

  test('a tap during playback skips to the end state', async ({ page }) => {
    await page.goto('/ui-gallery.html?scene=juice')
    await page.getByTestId('action-deal').click()
    await expect(page.getByTestId('juice-demo')).toHaveAttribute('data-playing', 'true')
    await page.getByTestId('table').click({ position: { x: 10, y: 200 } })
    await expect(page.getByTestId('juice-demo')).toHaveAttribute('data-playing', 'false', { timeout: 1_500 })
    await expect(page.getByTestId('player-hand').locator('[data-testid^="card-"]')).toHaveCount(2)
    await expect(page.getByTestId('dealer-hand').getByLabel('7♠')).toBeVisible()
    await expect(page.getByTestId('fx-layer')).toBeEmpty()
  })

  test('reduced motion still reaches the same end state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ui-gallery.html?scene=juice')
    await page.getByTestId('action-deal').click()
    await expect(page.getByTestId('juice-demo')).toHaveAttribute('data-playing', 'false', { timeout: 10_000 })
    await expect(page.getByTestId('seat-cpu1-status')).toHaveText('BUST')
    await expect(page.getByTestId('dealer-hand').getByLabel('7♠')).toBeVisible()
  })
})

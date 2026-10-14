import { expect, test } from './fixtures'

// Flip 7 table, plus the reduced-motion end state (no unit test covers that browser path).
// Juice skip/timing is playback.test.ts; paced CPU turns on the real shell are shell-multiseat.
// Lobby audio is e2e/audio.spec.ts. Betting and a real shoe are e2e/blackjack.spec.ts.

test('Flip 7 table lays out three CPU seats and both decks', async ({ page }, testInfo) => {
  await page.goto('/ui-gallery.html?scene=opponents&n=3')
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '3')
  await expect(page.getByTestId('seat-cpu1')).toHaveAttribute('data-state', 'active')
  await expect(page.getByTestId('seat-cpu1-total')).toHaveText('14')
  await expect(page.getByTestId('seat-cpu1').getByLabel('easy CPU')).toBeVisible()
  await expect(page.getByTestId('seat-cpu1-hand').getByLabel('+4')).toBeVisible()
  await expect(page.getByTestId('player-hand').getByLabel('2ND CHANCE')).toBeVisible()
  await expect(page.getByTestId('hud-bankroll')).toHaveCount(0)
  const boxes = await Promise.all([1, 2].map((i) => page.getByTestId(`seat-cpu${i}`).boundingBox()))
  const [a, b] = boxes
  if (!a || !b) throw new Error('seat boxes missing')
  if (testInfo.project.name === 'phone') expect(b.y).toBeGreaterThan(a.y + a.height - 1)
  else expect(b.x).toBeGreaterThan(a.x + a.width - 1)
  await page.screenshot({ path: testInfo.outputPath('gallery-opponents-3.png') })

  await page.goto('/ui-gallery.html?scene=sheet')
  await expect(page.getByLabel('FREEZE')).toBeVisible()
  await expect(page.getByLabel('A♠')).toBeVisible()
  await expect(page.getByLabel('face-down card')).toBeVisible()
  await expect(page.getByTestId('sheet-pot-amount')).toHaveText('$785')
  await page.screenshot({ path: testInfo.outputPath('gallery-sheet.png'), fullPage: true })
})

test('reduced motion still reaches the end of a paced round', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/ui-gallery.html?scene=juice')
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('juice-demo')).toHaveAttribute('data-playing', 'false', { timeout: 10_000 })
  await expect(page.getByTestId('seat-cpu1-status')).toHaveText('BUST')
  await expect(page.getByTestId('dealer-hand').getByLabel('7♠')).toBeVisible()
})

test('action buttons stay tappable where the cards overlap the felt', async ({ page }) => {
  await page.goto('/ui-gallery.html?scene=table')
  await page.getByTestId('action-hit').click({ trial: true })
  await page.getByTestId('action-stand').click({ trial: true })
})

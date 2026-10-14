import { expect, test, type Page } from './fixtures'

// e2e is typed without the DOM lib, so the page-side code names the few browser APIs it uses.
type El = { dataset: Record<string, string | undefined> }
type PageGlobals = {
  document: { querySelector(selector: string): El | null; querySelectorAll(selector: string): { length: number } }
  getComputedStyle(el: El): { opacity: string; visibility: string }
  requestAnimationFrame(callback: () => void): number
  __tray: { frames: number; emptyShown: number; peak: number }
}

/** Counts every frame on which the dealer row is visible while it holds no cards, until the table is betting again. */
const watchEmptyTray = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const seen = (g.__tray = { frames: 0, emptyShown: 0, peak: 0 })
    const tick = () => {
      const row = g.document.querySelector('[data-testid="dealer-row"]')
      const empty = g.document.querySelectorAll('[data-testid^="dealer-card-"]').length === 0
      seen.frames++
      if (row && empty) {
        const style = g.getComputedStyle(row)
        const shown = style.visibility === 'hidden' ? 0 : Number(style.opacity)
        if (shown > 0.01) seen.emptyShown++
        seen.peak = Math.max(seen.peak, shown)
      }
      if (seen.frames < 600) g.requestAnimationFrame(tick)
    }
    g.requestAnimationFrame(tick)
  })

test('the dealer tray leaves with the cards, with no empty tray between rounds', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=win')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(page.getByTestId('dealer-row')).toBeHidden()
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('dealer-row')).toBeVisible()
  await expect(page.getByTestId('action-stand')).toBeEnabled()

  await watchEmptyTray(page)
  await page.getByTestId('action-stand').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-outcome', 'win')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(table).toHaveAttribute('data-busy', 'false')
  await page.waitForTimeout(400)
  await page.screenshot({ path: testInfo.outputPath('after-sweep.png') })
  await expect(page.getByTestId('dealer-row')).toBeHidden()

  const seen = await page.evaluate(() => (globalThis as unknown as PageGlobals).__tray)
  expect(seen.frames).toBeGreaterThan(30)
  expect(seen, 'frames showing an empty dealer tray').toMatchObject({ emptyShown: 0, peak: 0 })

  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '25')
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('dealer-row')).toBeVisible()
  await expect(page.getByTestId('dealer-card-0')).toBeVisible()
})

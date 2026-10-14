import { expect, test, type Page } from './fixtures'

// e2e is typed without the DOM lib, so the page-side code names the few browser APIs it uses.
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }
type El = { dataset: Record<string, string | undefined>; getBoundingClientRect(): Box }
type PageGlobals = {
  document: { querySelector(selector: string): El | null; querySelectorAll(selector: string): Iterable<El> }
  requestAnimationFrame(callback: () => void): number
  innerWidth: number
  __burst: { frames: number; dealerHits: string[]; handHits: number; spread: number; corner: number }
}

/** Every frame of the blackjack moment: chips must miss both hands, and the spray must cross the table. */
const watchBurst = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const seen = (g.__burst = { frames: 0, dealerHits: [] as string[], handHits: 0, spread: 0, corner: 0 })
    const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    let dealt = false
    const tick = () => {
      const chips = [...g.document.querySelectorAll('.bj-burst .bj-flychip')].map((el) => el.getBoundingClientRect())
      for (const payout of g.document.querySelectorAll('.bj-fx .bj-flychip')) {
        const r = payout.getBoundingClientRect()
        if (r.width && r.right < 8 && r.bottom < 8) seen.corner++
      }
      const dealers = [...g.document.querySelectorAll('[data-testid^="dealer-card-"]')].map((el) => el.getBoundingClientRect())
      const hand = [...g.document.querySelectorAll('[data-testid^="hand-0-card-"]')].map((el) => el.getBoundingClientRect())
      seen.frames++
      if (chips.length) {
        const xs = chips.map((r) => (r.left + r.right) / 2)
        seen.spread = Math.max(seen.spread, Math.max(...xs) - Math.min(...xs))
        for (const chip of chips) {
          if (chip.right < 8 && chip.bottom < 8) seen.corner++
          dealers.forEach((card, i) => {
            if (overlaps(chip, card)) seen.dealerHits.push(`chip over dealer card ${i}`)
          })
          if (hand.some((card) => overlaps(chip, card))) seen.handHits++
        }
      }
      const betting = g.document.querySelector('[data-testid="blackjack-table"]')?.dataset['stage'] === 'betting'
      if (!betting) dealt = true
      if (!(dealt && betting) && seen.frames < 900) g.requestAnimationFrame(tick)
    }
    g.requestAnimationFrame(tick)
  })

test('the blackjack burst fills the table without covering either hand', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=blackjack')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await page.getByTestId('chip-25').click()
  await watchBurst(page)
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-outcome', 'blackjack')
  await page.waitForTimeout(500)
  await page.screenshot({ path: testInfo.outputPath('burst.png') })
  await expect(table).toHaveAttribute('data-stage', 'betting')

  const seen = await page.evaluate(() => (globalThis as unknown as PageGlobals).__burst)
  expect(seen.frames).toBeGreaterThan(30)
  expect([...new Set(seen.dealerHits)]).toEqual([])
  expect(seen.handHits).toBe(0)
  expect(seen.corner).toBe(0)
  const width = page.viewportSize()?.width ?? 0
  expect(seen.spread).toBeGreaterThan(width * 0.5)
})

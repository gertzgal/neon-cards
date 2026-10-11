import { expect, test, type Page } from '@playwright/test'

// e2e is typed without the DOM lib, so the page-side code names the few browser APIs it uses.
type Box = { left: number; right: number; top: number; bottom: number; width: number }
type El = { dataset: Record<string, string | undefined>; parentElement: El | null; offsetWidth: number; getBoundingClientRect(): Box }
type PageGlobals = {
  document: { querySelector(selector: string): El | null; querySelectorAll(selector: string): Iterable<El> }
  getComputedStyle(el: El): { opacity: string }
  requestAnimationFrame(callback: () => void): number
  innerWidth: number
  __dealer: { max: number; bad: string[] }
}

/** The player hand's lowest point, and where it breaks the layout: off screen or a card buried past its corner. */
const playerHand = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const cards = [...g.document.querySelectorAll('[data-testid^="hand-0-card-"]')].map((el) => ({ r: el.getBoundingClientRect(), w: el.offsetWidth }))
    const bad: string[] = []
    cards.forEach(({ r, w }, i) => {
      if (r.left < 0 || r.right > g.innerWidth) bad.push(`card ${i}: x ${Math.round(r.left)}..${Math.round(r.right)}`)
      const next = cards[i + 1]
      if (next && next.r.left - r.left < w * 0.25) bad.push(`card ${i}: only ${Math.round(next.r.left - r.left)}px of ${w} in view`)
    })
    const buttons = g.document.querySelector('[data-testid="action-hit"]')?.getBoundingClientRect().top ?? 0
    return { bad, bottom: Math.round(Math.max(...cards.map((c) => c.r.bottom))), buttons: Math.round(buttons) }
  })

/** Records, every frame, any dealer card or dealer total that leaves the screen or slides under the HUD. */
const watchDealerRow = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const seen = (g.__dealer = { max: 0, bad: [] as string[] })
    const hud = g.document.querySelector('[data-testid="hud-settings"]')?.parentElement?.getBoundingClientRect()
    const tick = () => {
      const cards = [...g.document.querySelectorAll('[data-testid^="dealer-card-"]')]
      seen.max = Math.max(seen.max, cards.length)
      for (const el of [...cards, g.document.querySelector('[data-testid="dealer-total"]')]) {
        if (!el || Number(g.getComputedStyle(el).opacity) < 1) continue
        const r = el.getBoundingClientRect()
        if (!r.width) continue
        const id = `${el.dataset['testid']} with ${cards.length} cards`
        if (r.left < 0 || r.right > g.innerWidth) seen.bad.push(`${id}: x ${Math.round(r.left)}..${Math.round(r.right)}`)
        if (hud && r.top < hud.bottom && r.bottom > hud.top && r.right > hud.left && r.left < hud.right)
          seen.bad.push(`${id}: under the HUD icons`)
      }
      if (g.document.querySelector('[data-testid="blackjack-table"]')?.dataset['stage'] !== 'betting') g.requestAnimationFrame(tick)
    }
    g.requestAnimationFrame(tick)
  })

test('a six-card player hand stays on screen, no lower than a three-card hand, with every card corner in view', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=2H,10C,2S,7D,AH,AS,2C,2D,3H,KS')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  let three = { bad: [] as string[], bottom: 0, buttons: 0 }
  for (const total of ['5/15', '6/16', '8/18', '10/20']) {
    await expect(page.getByTestId('action-hit')).toBeEnabled()
    await page.getByTestId('action-hit').click()
    await expect(page.getByTestId('hand-0-total')).toHaveText(total)
    if (total === '5/15') {
      await expect(table).toHaveAttribute('data-busy', 'false')
      await page.waitForTimeout(300)
      three = await playerHand(page)
    }
  }
  await expect(page.getByTestId('hand-0-card-5')).toBeVisible()
  await expect(table).toHaveAttribute('data-busy', 'false')
  await expect.poll(async () => (await playerHand(page)).bad).toEqual([])
  const six = await playerHand(page)
  expect(six.bottom).toBeLessThanOrEqual(three.bottom + 1)
  if (testInfo.project.name === 'phone') expect(six.bottom).toBeLessThanOrEqual(six.buttons)
  await page.screenshot({ path: testInfo.outputPath('player-6-cards.png') })
})

test('a seven-card dealer hand keeps the dealer row and its total on screen', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=10H,2C,8S,2D,2S,2H,3C,3D,3H')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('action-stand')).toBeEnabled()

  await watchDealerRow(page)
  await page.getByTestId('action-stand').click()
  await expect(page.getByTestId('dealer-card-6')).toBeVisible()
  await expect(page.getByTestId('dealer-total')).toHaveText('17')
  await page.screenshot({ path: testInfo.outputPath('dealer-7-cards.png') })
  await expect(table).toHaveAttribute('data-stage', 'betting')

  const seen = await page.evaluate(() => (globalThis as unknown as PageGlobals).__dealer)
  expect(seen.max).toBe(7)
  expect([...new Set(seen.bad)]).toEqual([])
})

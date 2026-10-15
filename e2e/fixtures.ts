import { expect, test as base } from '@playwright/test'

// Each test already gets a fresh browser context, so a fresh `nc_player` cookie,
// wallet, and session. `parallelIndex` selects the worker's own wrangler and D1,
// so two tests never write the same SQLite file.
const external = process.env['BASE_URL']
const port = Number(process.env['E2E_PORT'] ?? 8800)
const guideIds = ['blackjack', 'flip7', 'exploding-kittens', 'high-card']

export const test = base.extend<{ guideSeen: boolean; passPregame: boolean }>({
  guideSeen: [true, { option: true }],
  passPregame: [true, { option: true }],
  // Replaces the built-in baseURL. The empty pattern is Playwright's fixture bag.
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use, info) => {
    if (external) {
      await use(external)
      return
    }
    const workers = Number(process.env['E2E_WORKERS'] ?? 1)
    if (info.parallelIndex >= workers) {
      throw new Error(`parallelIndex ${info.parallelIndex} has no D1 (only ${workers} stacks)`)
    }
    await use(`http://127.0.0.1:${port + info.parallelIndex}`)
  },
  page: async ({ page, guideSeen, passPregame }, use) => {
    if (guideSeen) {
      await page.addInitScript((ids) => {
        for (const id of ids) localStorage.setItem(`neon-cards:guide-seen:${id}`, '1')
      }, guideIds)
    }
    if (passPregame) {
      const goto = page.goto.bind(page)
      page.goto = (async (url: Parameters<typeof goto>[0], options?: Parameters<typeof goto>[1]) => {
        const response = await goto(url, options)
        if (typeof url === 'string' && url.includes('/games/blackjack')) {
          const screen = page.getByTestId('game-screen')
          await expect(screen).toBeVisible()
          await expect(screen).not.toHaveAttribute('data-state', 'loading')
          if ((await screen.getAttribute('data-state')) === 'setup') await page.getByTestId('pregame-play').click()
        }
        return response
      }) as typeof page.goto
    }
    await use(page)
  },
})

export { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

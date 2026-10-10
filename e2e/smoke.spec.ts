import { expect, test } from '@playwright/test'

test('the Worker serves the web app and the app reads local D1', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByTestId('app-title')).toHaveText('Neon Cards')
  await expect(page.getByTestId('db-status')).toHaveAttribute('data-state', 'ok')
  await expect(page.getByTestId('db-status')).toHaveText('D1 ok · schema foundation')
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
})

test('GET /api/health answers from the migrated database', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ ok: true, db: { schema: 'foundation' } })
})

test('deep links fall back to the app shell', async ({ page }) => {
  await page.goto('/games/blackjack')
  await expect(page.getByTestId('app-title')).toBeVisible()
})

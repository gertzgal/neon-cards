import { expect, test } from '@playwright/test'

test('the Worker serves the web app', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-title')).toHaveText('Neon Cards')
})

test('GET /api/health answers from the migrated database', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ ok: true, db: { schema: 'foundation' } })
})

test('deep links fall back to the app shell', async ({ page }) => {
  const res = await page.goto('/history')
  expect(res?.status()).toBe(200)
  await expect(page.getByTestId('nav-back')).toBeVisible()
})

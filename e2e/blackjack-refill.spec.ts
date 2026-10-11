import { expect, test } from '@playwright/test'

test('going broke on an all-in refills to $1,250 with an empty felt, not an auto-rebet', async ({ page }, testInfo) => {
  await page.goto('/games/blackjack?rig=lose')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')

  for (const chip of [500, 500, 100, 100, 25, 25]) await page.getByTestId(`chip-${chip}`).click()
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '1250')
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('action-stand')).toBeEnabled()
  await page.getByTestId('action-stand').click()

  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(table).toHaveAttribute('data-busy', 'false')
  await expect(page.getByTestId('hud-bankroll')).toHaveAttribute('data-value', '1250')
  await page.waitForTimeout(600)
  await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '0')
  await expect(page.getByTestId('action-deal')).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('after-refill.png') })
  expect(await (await page.request.get('/api/wallet')).json()).toMatchObject({ balance: 1250 })

  await page.goto('/games/blackjack')
  await expect(table).toHaveAttribute('data-busy', 'false')
  await page.waitForTimeout(300)
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '0')
  await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')
})

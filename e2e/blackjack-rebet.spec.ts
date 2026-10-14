import { expect, test, type Page } from '@playwright/test'

async function winA50Round(page: Page) {
  await page.goto('/games/blackjack?rig=win')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await page.getByTestId('chip-25').click()
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('action-stand')).toBeEnabled()
  await page.getByTestId('action-stand').click()
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '50')
}

async function expectRebet(page: Page) {
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-stage', 'betting')
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '50')
  await expect(page.getByTestId('action-deal')).toBeEnabled()
  await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')
}

test('the last bet is back on the felt after reopening the table', async ({ page }, testInfo) => {
  await winA50Round(page)
  await page.goto('/games/blackjack')
  await expectRebet(page)
  await page.screenshot({ path: testInfo.outputPath('after-reload.png') })

  await page.getByTestId('action-deal').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-bet', '50')
})

test('the last bet is back on the felt after a trip to History', async ({ page }, testInfo) => {
  await winA50Round(page)
  await page.getByTestId('hud-settings').click()
  await page.getByTestId('table-history').click()
  await expect(page).toHaveURL(/\/history/)
  await page.getByTestId('nav-back').click()
  await expect(page).toHaveURL(/\/games\/blackjack$/)
  await expectRebet(page)
  await page.screenshot({ path: testInfo.outputPath('after-history.png') })
})

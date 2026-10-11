import { expect, test, type Page } from '@playwright/test'

async function openRigged(page: Page, rig: string) {
  await page.goto(`/games/blackjack?rig=${rig}`)
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-stage', 'betting')
  await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,250')
}

async function bet25AndDeal(page: Page) {
  await page.getByTestId('chip-25').click()
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '25')
  await page.getByTestId('action-deal').click()
}

async function expectWalletAndHistory(page: Page, balance: string, net: string, outcome: string, hand: string) {
  expect(await (await page.request.get('/api/wallet')).json()).toMatchObject({ balance: Number(balance.replace(/\D/g, '')) })
  await page.getByTestId('hud-settings').click()
  await page.getByTestId('table-history').click()
  await expect(page).toHaveURL(/\/history\?game=blackjack$/)
  await expect(page.getByTestId('history-round')).toHaveCount(1)
  await expect(page.getByTestId('history-net')).toHaveText(net)
  await expect(page.getByTestId('history-outcome')).toHaveText(outcome)
  await expect(page.getByTestId('history-hands')).toHaveText(hand)
  await expect(page.getByTestId('hud-bankroll')).toHaveText(balance)
}

test('a full won round: bet, deal, stand, settle, wallet and history update', async ({ page }, testInfo) => {
  await openRigged(page, 'win')
  await bet25AndDeal(page)
  await expect(page.getByTestId('hand-0-total')).toHaveText('19')
  await expect(page.getByTestId('action-stand')).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('1-dealt.png') })

  await page.getByTestId('action-stand').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-outcome', 'win')
  await expect(page.getByTestId('dealer-total')).toHaveText('17')
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-busy', 'false')
  await page.screenshot({ path: testInfo.outputPath('2-won.png') })

  await expectWalletAndHistory(page, '$1,275', '+$25', 'WIN', '10♥9♠')
  await page.screenshot({ path: testInfo.outputPath('3-history.png') })
})

test('a lost round after a hit busts, and the session resumes when reopened', async ({ page }, testInfo) => {
  await openRigged(page, 'bust')
  await bet25AndDeal(page)
  await expect(page.getByTestId('hand-0-total')).toHaveText('16')

  await page.goto('/games/blackjack')
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-stage', 'playing')
  await expect(page.getByTestId('hand-0-total')).toHaveText('16')

  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-status', 'bust')
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-busy', 'false')
  await page.screenshot({ path: testInfo.outputPath('busted.png') })

  await expectWalletAndHistory(page, '$1,225', '-$25', 'BUST', '10♥6♠K♣')
})

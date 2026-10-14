import { expect, test, type Page } from '@playwright/test'

const table = (page: Page) => page.getByTestId('blackjack-table')

async function openAndBet25(page: Page, rig: string) {
  await page.goto(`/games/blackjack?rig=${rig}`)
  await expect(table(page)).toHaveAttribute('data-stage', 'betting')
  await expect(table(page)).toHaveAttribute('data-busy', 'false')
  await page.getByTestId('chip-25').click()
  await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '25')
}

/** Ms from the action until the table is idle again. */
async function timeUntilIdle(page: Page, act: () => Promise<void>, during?: () => Promise<void>) {
  const t0 = Date.now()
  await act()
  await expect(table(page)).toHaveAttribute('data-busy', 'true')
  await during?.()
  await expect(table(page)).toHaveAttribute('data-busy', 'false', { timeout: 10_000 })
  return Date.now() - t0
}

const tapFelt = async (page: Page) => {
  const box = await page.getByTestId('blackjack-table').boundingBox()
  if (!box) throw new Error('no table')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45)
}

test.describe('Blackjack: tap or key to skip the round animation', () => {
  test('a tap jumps a blackjack round to its settled state, with the right money', async ({ page }, testInfo) => {
    await openAndBet25(page, 'blackjack')
    const ms = await timeUntilIdle(
      page,
      () => page.getByTestId('action-deal').click(),
      async () => {
        await expect(page.getByTestId('hand-0-card-0')).toBeVisible()
        await tapFelt(page)
        await page.screenshot({ path: testInfo.outputPath('skip-1-after-tap.png') })
      },
    )
    expect(ms).toBeLessThan(1_800)

    await expect(table(page)).toHaveAttribute('data-stage', 'betting')
    await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '25')
    await expect(page.getByTestId('hud-bankroll')).toHaveAttribute('data-value', '1287')
    await expect(page.getByTestId('hud-bankroll')).toHaveText('$1,287')
    await expect(table(page)).toHaveAttribute('data-rounds', '1')
    await expect(table(page)).toHaveAttribute('data-last-outcomes', 'blackjack')
    await expect(table(page)).toHaveAttribute('data-last-net', '37')
    expect(await (await page.request.get('/api/wallet')).json()).toMatchObject({ balance: 1287 })
    const history = await (await page.request.get('/api/history?gameId=blackjack')).json()
    expect(history.rounds).toHaveLength(1)
    expect(history.rounds[0]).toMatchObject({ net: 37 })
    await page.screenshot({ path: testInfo.outputPath('skip-2-settled.png') })
  })

  test('without a tap the full blackjack moment still plays', async ({ page }) => {
    await openAndBet25(page, 'blackjack')
    const ms = await timeUntilIdle(
      page,
      () => page.getByTestId('action-deal').click(),
      async () => {
        await expect(page.getByTestId('result-pop')).toBeVisible()
      },
    )
    expect(ms).toBeGreaterThan(2_500)
    expect(await (await page.request.get('/api/wallet')).json()).toMatchObject({ balance: 1287 })
  })

  test('a tap mid-deal lands on the live hand, ready to act', async ({ page }) => {
    await openAndBet25(page, 'win')
    await timeUntilIdle(
      page,
      () => page.getByTestId('action-deal').click(),
      async () => {
        await expect(page.getByTestId('hand-0-card-0')).toBeVisible()
        await tapFelt(page)
      },
    )
    await expect(table(page)).toHaveAttribute('data-stage', 'playing')
    await expect(page.getByTestId('hand-0').locator('.bj-slot')).toHaveCount(2)
    await expect(page.getByTestId('dealer-hand').locator('.bj-slot')).toHaveCount(2)
    await expect(page.getByTestId('hand-0-total')).toHaveText('19')
    await expect(page.getByTestId('action-stand')).toBeEnabled()
  })

  test('a key press skips the dealer play and does not deal the next round', async ({ page }) => {
    await openAndBet25(page, 'win')
    await page.getByTestId('action-deal').click()
    await expect(page.getByTestId('action-stand')).toBeEnabled()
    const ms = await timeUntilIdle(
      page,
      () => page.getByTestId('action-stand').click(),
      async () => {
        await expect(page.getByTestId('dealer-card-1')).not.toHaveAttribute('data-face', 'hidden')
        await page.keyboard.press('Space')
      },
    )
    expect(ms).toBeLessThan(1_500)
    await expect(table(page)).toHaveAttribute('data-stage', 'betting')
    await expect(page.getByTestId('bet-amount')).toHaveAttribute('data-value', '25')
    const history = await (await page.request.get('/api/history?gameId=blackjack')).json()
    expect(history.rounds).toHaveLength(1)
    expect(history.rounds[0]).toMatchObject({ net: 25 })
    await expect(table(page)).toHaveAttribute('data-last-net', '25')
    expect(await (await page.request.get('/api/wallet')).json()).toMatchObject({ balance: 1275 })
  })
})

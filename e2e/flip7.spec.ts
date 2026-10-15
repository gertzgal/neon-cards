import { expect, test, type Page } from '@playwright/test'

const table = (page: Page) => page.getByTestId('flip7-table')

async function settled(page: Page) {
  await expect(table(page)).toHaveAttribute('data-busy', 'false', { timeout: 15_000 })
}

/** Opens Flip 7 through the pre-game sheet, optionally rigged, and waits for the opening deal to finish. */
async function open(page: Page, rig?: string, picks: string[] = []) {
  await page.goto(rig ? `/games/flip7?rig=${rig}` : '/games/flip7')
  for (const pick of picks) await page.getByTestId(pick).click()
  await page.getByTestId('pregame-play').click()
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
  await expect(table(page)).toHaveAttribute('data-stage', 'playing')
  await settled(page)
}

async function hit(page: Page, value: string) {
  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('round-value')).toHaveText(value)
  await settled(page)
}

async function stay(page: Page) {
  await page.getByTestId('action-stay').click()
  await expect(table(page)).toHaveAttribute('data-stage', 'roundOver', { timeout: 15_000 })
  await settled(page)
}

const opponentCards = (page: Page, seat: string) => page.locator(`[data-testid="seat-${seat}"] [data-testid^="card-"]`)

test('the setup sheet seats the chosen number of CPUs; only numbers on the table', async ({ page }, testInfo) => {
  await page.goto('/games/flip7')
  await expect(page.getByTestId('pregame-opponents')).toHaveAttribute('data-value', '2')
  await expect(page.getByTestId('pregame-difficulty')).toHaveAttribute('data-value', 'medium')
  await open(page, undefined, ['pregame-opponents-3', 'pregame-difficulty-hard'])
  for (const seat of ['cpu-1', 'cpu-2', 'cpu-3']) await expect(page.getByTestId(`seat-${seat}`)).toBeVisible()
  await expect(page.getByTestId('seat-cpu-4')).toHaveCount(0)
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '0')
  const words = (await table(page).innerText()).match(/[A-Za-z]{2,}/g) ?? []
  expect(words.filter((w) => !['FLIP', 'BUST'].includes(w))).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('setup-3-cpus.png') })
})

test('a repeat busts you: BUST, a zero round, and the round scores', async ({ page }, testInfo) => {
  await open(page, 'bust')
  await expect(page.getByTestId('round-value')).toHaveText('5')
  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-status', 'busted')
  await expect(table(page)).toHaveAttribute('data-stage', 'roundOver', { timeout: 15_000 })
  await settled(page)
  await expect(page.getByTestId('tally')).toContainText('BUST')
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '0')
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-total', '33')
  await page.screenshot({ path: testInfo.outputPath('bust.png') })

  await page.getByTestId('action-next').click()
  await expect(table(page)).toHaveAttribute('data-round', '2')
  await expect(table(page)).toHaveAttribute('data-stage', 'playing')
})

test('seven unique numbers: FLIP 7!, the +15 bonus, and the round ends at once', async ({ page }, testInfo) => {
  await open(page, 'flip7')
  for (const value of ['3', '6', '10', '15', '21']) await hit(page, value)
  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('slots')).toHaveAttribute('data-gold', 'true')
  await page.screenshot({ path: testInfo.outputPath('flip7-moment.png') })
  await expect(table(page)).toHaveAttribute('data-stage', 'roundOver', { timeout: 15_000 })
  await settled(page)
  await expect(page.getByTestId('round-value')).toHaveText('43')
  await expect(page.getByTestId('tally')).toHaveAttribute('data-round', '43')
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '43')
  await page.screenshot({ path: testInfo.outputPath('flip7-scored.png') })
})

test('modifiers: x2 doubles the numbers, then +4 adds, and staying banks it', async ({ page }) => {
  await open(page, 'mods')
  await hit(page, '16')
  await hit(page, '22')
  await hit(page, '26')
  await stay(page)
  await expect(page.getByTestId('tally')).toHaveAttribute('data-round', '26')
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '26')
})

test('a Second Chance absorbs a repeat and both cards go', async ({ page }) => {
  await open(page, 'second')
  await expect(page.getByTestId('you-extras').locator('[data-testid^="card-"]')).toHaveCount(1)
  await hit(page, '4')
  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('you-extras').locator('[data-testid^="card-"]')).toHaveCount(0)
  await settled(page)
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-status', 'active')
  await expect(page.getByTestId('round-value')).toHaveText('4')
})

test('a Freeze: you pick the seat, and it banks and leaves the round', async ({ page }, testInfo) => {
  await page.goto('/games/flip7?rig=freeze')
  await page.getByTestId('pregame-play').click()
  await expect(table(page)).toHaveAttribute('data-pending', 'target', { timeout: 15_000 })
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-pick', 'true')
  await settled(page)
  await expect(page.getByTestId('card-rule')).toHaveCount(0)
  await page.locator('[data-testid="held"] [aria-label="FREEZE"]').click()
  await expect(page.getByTestId('card-rule')).toHaveText('That player banks their score and sits this round out.')
  await expect(table(page)).toHaveAttribute('data-pending', 'target')
  await page.screenshot({ path: testInfo.outputPath('freeze-pick.png') })
  await page.getByTestId('seat-cpu-1').click()
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-status', 'frozen')
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-pending', 'hitOrStay')
})

test('a Flip Three: the chosen seat flips three cards', async ({ page }) => {
  await page.goto('/games/flip7?rig=flip3')
  await page.getByTestId('pregame-play').click()
  await expect(table(page)).toHaveAttribute('data-pending', 'target', { timeout: 15_000 })
  await page.getByTestId('seat-cpu-2').click()
  await settled(page)
  await expect(opponentCards(page, 'cpu-2')).toHaveCount(3)
  await expect(page.getByTestId('seat-cpu-2')).not.toHaveAttribute('data-status', 'busted')
})

test('crossing 200 wins the game, and an open game resumes on reload', async ({ page }, testInfo) => {
  await open(page, 'win')
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '190')
  await hit(page, '21')

  await page.goto('/games/flip7')
  await expect(table(page)).toHaveAttribute('data-stage', 'playing')
  await expect(page.getByTestId('round-value')).toHaveText('21')

  await page.getByTestId('action-stay').click()
  await expect(page.getByTestId('game-over')).toHaveAttribute('data-winner', 'you', { timeout: 15_000 })
  await expect(table(page)).toHaveAttribute('data-stage', 'gameOver')
  await expect(page.getByTestId('hud-total')).toHaveAttribute('data-value', '211')
  await page.screenshot({ path: testInfo.outputPath('won.png') })
})

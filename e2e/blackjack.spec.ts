import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Every test runs in a fresh browser context, so it's a new anonymous player with a 1,250 wallet.
// `?rig=` stacks the shoe through the sanctioned dev path (the shell forwards it as `config.rig`, DEV_RIG=1);
// everything else goes through the real UI and API.

const SCREENS = process.env['SCREENS_DIR']

async function shot(page: Page, testInfo: TestInfo, name: string) {
  const file = `blackjack-${testInfo.project.name}-${name}.jpg`
  const image = await page.screenshot({ scale: 'css', type: 'jpeg', quality: 85 })
  writeFileSync(testInfo.outputPath(file), image)
  if (SCREENS) {
    mkdirSync(SCREENS, { recursive: true })
    writeFileSync(join(SCREENS, file), image)
  }
}

async function openTable(page: Page, rig?: string): Promise<Locator> {
  await page.goto(rig ? `/games/blackjack?rig=${rig}` : '/games/blackjack')
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toBeVisible()
  await idle(table)
  return table
}

async function idle(table: Locator) {
  await expect(table).toHaveAttribute('data-busy', 'false', { timeout: 10_000 })
}

async function placeBet(page: Page, ...chips: number[]) {
  for (const chip of chips) await page.getByTestId(`chip-${chip}`).click()
}

async function deal(page: Page, table: Locator) {
  await page.getByTestId('action-deal').click()
  await expect(table).toHaveAttribute('data-busy', 'true')
  await idle(table)
}

async function act(page: Page, table: Locator, action: 'hit' | 'stand' | 'double' | 'split') {
  await page.getByTestId(`action-${action}`).click()
  await idle(table)
}

async function expectRound(table: Locator, round: { n?: number; outcomes: string; statuses?: string; net: number; dealer?: string }) {
  await expect(table).toHaveAttribute('data-rounds', String(round.n ?? 1))
  await expect(table).toHaveAttribute('data-last-outcomes', round.outcomes)
  await expect(table).toHaveAttribute('data-last-net', String(round.net))
  if (round.statuses) await expect(table).toHaveAttribute('data-last-statuses', round.statuses)
  if (round.dealer !== undefined) await expect(table).toHaveAttribute('data-last-dealer', round.dealer)
}

const bankroll = (page: Page) => page.getByTestId('hud-bankroll')
const SUIT: Record<string, string> = { '♥': 'H', '♦': 'D', '♠': 'S', '♣': 'C' }
/** Card codes like "10H" from the kit's aria labels ("10♥"); a face-down card reads "hidden". */
const cardFaces = async (hand: Locator) =>
  (await hand.locator('[data-testid^="card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).map((label) =>
    label === 'face-down card' ? 'hidden' : label.slice(0, -1) + (SUIT[label.slice(-1)] ?? '?'),
  )
const potAmount = (page: Page) => page.getByTestId('pot-amount')
const pop = (page: Page, text: string) => page.getByTestId('number-pop').filter({ hasText: text })

test('betting: chips build the bet, clear empties it, and the bankroll follows', async ({ page }, testInfo) => {
  const table = await openTable(page)
  await expect(table).toHaveAttribute('data-stage', 'betting')
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')
  await expect(page.getByTestId('dealer-hand')).toBeHidden()
  await expect(page.getByTestId('action-deal')).toBeDisabled()

  await placeBet(page, 5, 25, 100)
  await expect(potAmount(page)).toHaveText('$130')
  await expect(bankroll(page)).toHaveAttribute('data-value', '1120')
  await page.getByTestId('action-clear').click()
  await expect(potAmount(page)).toHaveText('')
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')

  await placeBet(page, 25, 25)
  await expect(potAmount(page)).toHaveText('$50')
  await expect(page.getByTestId('action-deal')).toBeEnabled()
  await page.waitForTimeout(500)
  await shot(page, testInfo, '01-betting')
})

test('deal and stand: a 19 beats the dealer 17 and pays 1:1', async ({ page }, testInfo) => {
  const table = await openTable(page, 'win')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await expect(table).toHaveAttribute('data-stage', 'playing')
  expect(await cardFaces(page.getByTestId('hand-0'))).toEqual(['10H', '9S'])
  expect(await cardFaces(page.getByTestId('dealer-hand'))).toEqual(['9C', 'hidden'])
  await expect(page.getByTestId('hand-0-total')).toHaveText('19')
  await expect(page.getByTestId('action-hit')).toBeEnabled()
  await expect(page.getByTestId('action-split')).toBeDisabled()
  await shot(page, testInfo, '02-deal')

  await page.getByTestId('action-stand').click()
  await expect(pop(page, '+$50')).toBeVisible()
  await shot(page, testInfo, '03-stand-win')
  await idle(table)
  await expectRound(table, { outcomes: 'win', net: 50 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')
  await expect(potAmount(page)).toHaveText('$50')
})

test('hit: 11 draws a ten to 21, stands itself, and wins', async ({ page }, testInfo) => {
  const table = await openTable(page, 'double')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await expect(page.getByTestId('hand-0-total')).toHaveText('11')
  await page.getByTestId('action-hit').click()
  await expect.poll(() => cardFaces(page.getByTestId('hand-0'))).toEqual(['6H', '5S', '10C'])
  await expect(page.getByTestId('hand-0-total')).toHaveText('21')
  await shot(page, testInfo, '04-hit')
  await idle(table)
  await expectRound(table, { outcomes: 'win', net: 50 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')
})

test('double: the bet doubles, one card comes, and it pays on the doubled bet', async ({ page }, testInfo) => {
  const table = await openTable(page, 'double')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await expect(page.getByTestId('action-double')).toBeEnabled()
  await page.getByTestId('action-double').click()
  await expect(potAmount(page)).toHaveText('$100')
  await expect(page.getByTestId('hand-0-total')).toHaveText('21')
  await shot(page, testInfo, '05-double')
  await idle(table)
  await expectRound(table, { outcomes: 'win', net: 100 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1300')
})

test('split: two eights become two hands, double after split, both win', async ({ page }, testInfo) => {
  const table = await openTable(page, 'split')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await expect(page.getByTestId('action-split')).toBeEnabled()
  await act(page, table, 'split')
  expect(await cardFaces(page.getByTestId('hand-0'))).toEqual(['8H', '3C'])
  expect(await cardFaces(page.getByTestId('hand-1'))).toEqual(['8S', '10D'])
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-state', 'active')
  await expect(page.getByTestId('hand-1')).toHaveAttribute('data-state', 'waiting')
  await expect(page.getByTestId('action-split')).toBeDisabled()
  await shot(page, testInfo, '06-split')

  await act(page, table, 'double')
  await expect(page.getByTestId('hand-0-total')).toHaveText('13')
  await expect(page.getByTestId('hand-1')).toHaveAttribute('data-state', 'active')
  await page.getByTestId('action-stand').click()
  await idle(table)
  await expectRound(table, { outcomes: 'win,win', net: 150 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1350')
})

test('bust: hitting 16 into a king busts and loses the bet', async ({ page }, testInfo) => {
  const table = await openTable(page, 'bust')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await expect(page.getByTestId('hand-0-total')).toHaveText('16')
  await page.getByTestId('action-hit').click()
  await expect(page.getByTestId('hand-0')).toHaveAttribute('data-state', 'bust')
  await expect(page.getByTestId('hand-0-total')).toHaveText('26')
  await shot(page, testInfo, '07-bust')
  await idle(table)
  await expectRound(table, { outcomes: 'lose', statuses: 'bust', net: -50 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1150')
})

test('blackjack: a natural pays 3:2 with the big moment, and the burst stays off the dealer', async ({ page }, testInfo) => {
  const table = await openTable(page, 'blackjack')
  await placeBet(page, 25, 25)
  await page.getByTestId('action-deal').click()
  await expect(pop(page, '+$75')).toHaveAttribute('data-tier', 'big')
  await page.waitForTimeout(150)
  const dealer = await page.getByTestId('dealer-hand').boundingBox()
  const dealerBottom = (dealer?.y ?? 0) + (dealer?.height ?? 0)
  const chips = await page
    .getByTestId('fx-layer')
    .locator('.nc-flychip:has(.nc-chip-lg)')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))
  expect(dealer).not.toBeNull()
  expect(chips.length).toBeGreaterThan(0)
  for (const top of chips) expect(top).toBeGreaterThanOrEqual(dealerBottom - 1)
  const popBox = await pop(page, '+$75').boundingBox()
  expect(popBox?.y ?? 0).toBeGreaterThanOrEqual(dealerBottom - 1)
  await shot(page, testInfo, '08-blackjack')
  await idle(table)
  await expectRound(table, { outcomes: 'blackjack', statuses: 'blackjack', net: 75 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1275')
})

test('push: 18 against 18 returns the bet', async ({ page }, testInfo) => {
  const table = await openTable(page, 'push')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await page.getByTestId('action-stand').click()
  await expect(pop(page, '±$0')).toBeVisible()
  await shot(page, testInfo, '09-push')
  await idle(table)
  await expectRound(table, { outcomes: 'push', net: 0 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1200')
})

test('dealer blackjack: the peek ends the round at once and takes only the bet', async ({ page }, testInfo) => {
  const table = await openTable(page, 'dealerbj')
  await placeBet(page, 25, 25)
  await page.getByTestId('action-deal').click()
  await expect.poll(() => cardFaces(page.getByTestId('dealer-hand'))).toEqual(['AS', 'KD'])
  await expect(page.getByTestId('dealer-total')).toHaveText('21')
  await shot(page, testInfo, '10-dealer-blackjack')
  await idle(table)
  await expectRound(table, { outcomes: 'lose', net: -50, dealer: 'blackjack' })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1150')
})

test('refill: losing the whole bankroll refills it to 1,250 and the wallet agrees', async ({ page }, testInfo) => {
  const table = await openTable(page, 'lose')
  await placeBet(page, 500, 500, 100, 100, 25, 25)
  await expect(bankroll(page)).toHaveAttribute('data-value', '0')
  await deal(page, table)
  await page.getByTestId('action-stand').click()
  await expect(pop(page, '+$1,250')).toBeVisible({ timeout: 10_000 })
  await shot(page, testInfo, '11-refill')
  await idle(table)
  await expectRound(table, { outcomes: 'lose', net: -1250 })
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')
  const wallet = (await (await page.request.get('/api/wallet')).json()) as { balance: number }
  expect(wallet.balance).toBe(1250)
})

test('resume: a reload mid-hand restores the same hand from the server and plays on', async ({ page }) => {
  const table = await openTable(page, 'win')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await page.goto('/games/blackjack')
  await expect(table).toHaveAttribute('data-stage', 'playing')
  await page.reload()
  await expect(table).toHaveAttribute('data-stage', 'playing')
  expect(await cardFaces(page.getByTestId('hand-0'))).toEqual(['10H', '9S'])
  expect(await cardFaces(page.getByTestId('dealer-hand'))).toEqual(['9C', 'hidden'])
  await expect(bankroll(page)).toHaveAttribute('data-value', '1200')
  await act(page, table, 'stand')
  await expect(bankroll(page)).toHaveAttribute('data-value', '1250')
  const wallet = (await (await page.request.get('/api/wallet')).json()) as { balance: number }
  expect(wallet.balance).toBe(1300)
})

test('history: finished rounds show up with their net', async ({ page }) => {
  const table = await openTable(page, 'win')
  await placeBet(page, 25, 25)
  await deal(page, table)
  await act(page, table, 'stand')
  await deal(page, table)
  await act(page, table, 'stand')
  await expectRound(table, { n: 2, outcomes: 'win', net: 50 })
  await page.goto('/history?game=blackjack')
  await expect(page.getByTestId('history-round')).toHaveCount(2)
  await expect(page.getByTestId('history-net').first()).toHaveText('+$50')
})

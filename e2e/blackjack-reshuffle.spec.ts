import { expect, test } from '@playwright/test'

type Step = { seq: number; view: { phase: string; shoe: { remaining: number; size: number } }; events: { type: string }[] }

test('a reshuffle plays a riffle of card backs before the next deal', async ({ page }, testInfo) => {
  test.slow()
  await page.goto('/games/blackjack?seed=reshuffle-cue')
  await expect(page.getByTestId('blackjack-table')).toHaveAttribute('data-stage', 'betting')
  const sessionId = await page.evaluate(() => localStorage.getItem('neon-cards:session:blackjack'))
  expect(sessionId).toBeTruthy()

  // Fast-forward through the public API until the shoe is under the 25% reshuffle line.
  const post = async (seq: number, action: object): Promise<Step> => {
    const res = await page.request.post(`/api/sessions/${sessionId}/actions`, { data: { action, seq } })
    expect(res.status()).toBe(200)
    return (await res.json()) as Step
  }
  let step = (await (await page.request.get(`/api/sessions/${sessionId}`)).json()) as Step
  while (step.view.phase !== 'settling' || step.view.shoe.remaining >= step.view.shoe.size * 0.25) {
    step = await post(step.seq, step.view.phase === 'playing' ? { type: 'stand' } : { type: 'bet', amount: 5 })
    expect(step.events.map((e) => e.type)).not.toContain('shuffle')
  }

  await page.goto('/games/blackjack')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-busy', 'false')
  if (await page.getByTestId('action-deal').isDisabled()) await page.getByTestId('chip-5').click()
  await page.getByTestId('action-deal').click()
  const cue = page.getByTestId('shuffle-cue')
  await expect(cue.first()).toBeVisible()
  await expect(cue).toHaveCount(6)
  await page.screenshot({ path: testInfo.outputPath('reshuffle-cue.png') })
  await expect(cue).toHaveCount(0)
  await expect(page.getByTestId('dealer-hand').locator('[data-face]')).toHaveCount(2)
  const after = (await (await page.request.get(`/api/sessions/${sessionId}`)).json()) as Step
  expect(after.view.shoe.remaining).toBeGreaterThan(after.view.shoe.size * 0.9)
})

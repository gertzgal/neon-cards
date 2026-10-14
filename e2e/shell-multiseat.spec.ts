import { expect, test, type Page } from './fixtures'

// The engine's test-only High Card game, served with DEV_RIG=1, proves the Flip 7 readiness path in the
// real shell: pre-game settings -> config -> seatsFor, server-side CPU seats, paced playback, opponent rows.

// e2e is typed without the DOM lib, so the page-side code names the few browser APIs it uses.
type PageGlobals = {
  document: { body: unknown; querySelector(selector: string): { getAttribute(name: string): string | null } | null }
  MutationObserver: new (callback: () => void) => { observe(target: unknown, options: object): void }
  __acting: string[]
}

/** Starts recording each seat the table marks as acting, in order. */
const recordActing = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const seen: string[] = []
    const record = () => {
      const seat = g.document.querySelector('[data-testid="high-card-table"]')?.getAttribute('data-acting')
      if (seat && seen.at(-1) !== seat) seen.push(seat)
    }
    record()
    new g.MutationObserver(record).observe(g.document.body, { subtree: true, attributes: true, attributeFilter: ['data-acting'] })
    g.__acting = seen
  })

const acted = (page: Page) => page.evaluate(() => (globalThis as unknown as PageGlobals).__acting)

test('settings flow from the pre-game sheet to the seats, and CPU turns play paced', async ({ page }, testInfo) => {
  await page.goto('/games/high-card')
  await expect(page.getByTestId('pregame')).toBeVisible()
  await page.getByTestId('pregame-opponents-3').click()
  await page.getByTestId('pregame-difficulty-hard').click()
  await page.getByTestId('pregame-position-last').click()
  await expect(page.getByTestId('pregame-opponents')).toHaveAttribute('data-value', '3')
  await page.screenshot({ path: testInfo.outputPath('1-pregame.png') })

  const created = page.waitForResponse((r) => r.url().endsWith('/api/sessions') && r.request().method() === 'POST')
  await page.getByTestId('pregame-play').click()
  const req = (await created).request()
  expect(req.postDataJSON()).toMatchObject({ gameId: 'high-card', config: { opponents: 3, difficulty: 'hard', position: 'last' } })

  // Three CPUs sit before the human, so the create response already holds their turns; the table paces them.
  const table = page.getByTestId('high-card-table')
  await expect(table).toBeVisible()
  const t0 = Date.now()
  await recordActing(page)
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '3')
  for (const id of ['cpu-1', 'cpu-2', 'cpu-3']) {
    await expect(page.getByTestId(`seat-${id}`)).toBeVisible()
    await expect(page.getByTestId(`seat-${id}`).locator('[data-difficulty]')).toHaveAttribute('data-difficulty', 'hard')
  }
  await expect(page.getByTestId('seat-cpu-2-status')).toHaveText('THINKING')
  await page.screenshot({ path: testInfo.outputPath('2-cpu-thinking.png') })
  await expect(page.getByTestId('round-status')).toHaveText('YOUR TURN')
  expect(Date.now() - t0).toBeGreaterThan(1000)
  expect(await acted(page)).toEqual(['cpu-1', 'cpu-2', 'cpu-3'])
  for (const id of ['cpu-1', 'cpu-2', 'cpu-3']) await expect(page.getByTestId(`seat-${id}-status`)).toHaveText(/KEEP|SWAP/)
  await page.screenshot({ path: testInfo.outputPath('3-your-turn.png') })

  // The human is last, so keeping ends the round: every card flips and the winners score.
  await page.getByTestId('action-keep').click()
  await expect(table).toHaveAttribute('data-phase', 'settling')
  await expect(page.getByTestId('round-status')).toHaveText(/ROUND (WON|LOST)/)
  await expect(page.getByTestId('action-next')).toBeEnabled()
  await expect(page.getByTestId('player-hand').locator('[data-testid^="card-"]')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('4-round-end.png') })

  const { rounds } = (await (await page.request.get('/api/history?gameId=high-card')).json()) as { rounds: unknown[] }
  expect(rounds).toHaveLength(1)

  // The next round starts with the CPUs again, then it's the human's turn.
  await page.getByTestId('action-next').click()
  await expect(page.getByTestId('round-status')).toHaveText('YOUR TURN')

  // A reload resumes the session (no pre-game sheet), and the settings are remembered for the next game.
  await page.reload()
  await expect(table).toBeVisible()
  await expect(page.getByTestId('pregame')).toHaveCount(0)
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '3')
  await page.getByTestId('hud-settings').click()
  await page.getByTestId('new-game').click()
  await expect(page.getByTestId('pregame-opponents')).toHaveAttribute('data-value', '3')
  await expect(page.getByTestId('pregame-difficulty')).toHaveAttribute('data-value', 'hard')
})

test('a single easy opponent sits after the human', async ({ page }, testInfo) => {
  await page.goto('/games/high-card')
  await page.getByTestId('pregame-opponents-1').click()
  await page.getByTestId('pregame-difficulty-easy').click()
  await page.getByTestId('pregame-position-first').click()
  await page.getByTestId('pregame-play').click()
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '1')
  await expect(page.getByTestId('seat-cpu-1').locator('[data-difficulty]')).toHaveAttribute('data-difficulty', 'easy')
  await expect(page.getByTestId('round-status')).toHaveText('YOUR TURN')

  // The CPU acts after the human inside the same response. The 500ms THINKING label is
  // asserted on the three-seat test; here the observer only has to see cpu-1 act, because
  // a single beat can finish before the next poll when four browsers share the machine.
  await recordActing(page)
  await page.getByTestId('action-swap').click()
  await expect(page.getByTestId('high-card-table')).toHaveAttribute('data-phase', 'settling')
  expect(await acted(page)).toContain('cpu-1')
  await page.screenshot({ path: testInfo.outputPath('heads-up.png') })
})

import type { Response } from '@playwright/test'
import { expect, test, type Page } from './fixtures'

const table = (page: Page) => page.getByTestId('ek-table')

async function settled(page: Page) {
  await expect(table(page)).toHaveAttribute('data-busy', 'false', { timeout: 20_000 })
}

/** Opens Exploding Kittens through the pre-game sheet. `?rig=` and `?seed=` are the shell's DEV_RIG channel. */
async function open(page: Page, opts: { rig?: string; seed?: string; picks?: string[] } = {}) {
  const params = new URLSearchParams()
  if (opts.rig) params.set('rig', opts.rig)
  if (opts.seed) params.set('seed', opts.seed)
  const query = params.toString()
  await page.goto(query ? `/games/exploding-kittens?${query}` : '/games/exploding-kittens')
  for (const pick of opts.picks ?? []) await page.getByTestId(pick).click()
  await page.getByTestId('pregame-play').click()
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
  await expect(table(page)).toHaveAttribute('data-state', 'playing')
  await settled(page)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Keys named `index` anywhere in the client payload. A defuse menu has them; a resolved step must not. */
function indexKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => indexKeys(item))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, child]) => (key === 'index' ? [key] : indexKeys(child)))
}

function watchAction(page: Page) {
  return page.waitForResponse((res) => res.url().includes('/actions') && res.request().method() === 'POST')
}

async function readAction(response: Response) {
  if (!response.ok()) throw new Error(`action ${response.status()} ${await response.text()}`)
  const body: unknown = await response.json()
  if (!isRecord(body)) throw new Error('action response was not an object')
  const posted: unknown = response.request().postDataJSON()
  return { body, posted }
}

function postedAction(posted: unknown): Record<string, unknown> {
  if (!isRecord(posted) || !isRecord(posted['action'])) throw new Error('action request had no action')
  return posted['action']
}

function viewOf(body: unknown): Record<string, unknown> {
  if (!isRecord(body) || !isRecord(body['view'])) throw new Error('action response had no view')
  return body['view']
}

function eventsOf(body: unknown): Record<string, unknown>[] {
  if (!isRecord(body) || !Array.isArray(body['events'])) throw new Error('action response had no events')
  return body['events'].filter(isRecord)
}

const backs = (page: Page, seat: string) => page.locator(`[data-testid="seat-${seat}-hand"] [data-testid^="card-"]`)

async function expectBacks(page: Page, seat: string, count: number) {
  const cards = backs(page, seat)
  await expect(cards).toHaveCount(count)
  const faces = await cards.evaluateAll((nodes) =>
    nodes.map((node) => ({ face: node.getAttribute('data-face'), label: node.getAttribute('aria-label') })),
  )
  expect(faces).toEqual(Array.from({ length: count }, () => ({ face: 'down', label: 'face-down card' })))
}

test('the setup sheet seats 1 to 3 CPUs at Easy, Medium, or Hard', async ({ page }, testInfo) => {
  await page.goto('/games/exploding-kittens')
  await expect(page.getByTestId('pregame-opponents')).toHaveAttribute('data-value', '2')
  await expect(page.getByTestId('pregame-difficulty')).toHaveAttribute('data-value', 'medium')
  for (const n of [1, 2, 3]) await expect(page.getByTestId(`pregame-opponents-${n}`)).toBeVisible()
  for (const difficulty of ['easy', 'medium', 'hard']) await expect(page.getByTestId(`pregame-difficulty-${difficulty}`)).toBeVisible()

  await open(page, { seed: 'ek-e2e-setup-1', picks: ['pregame-opponents-1', 'pregame-difficulty-easy'] })
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '1')
  await expect(page.getByTestId('seat-cpu-1').locator('[data-difficulty="easy"]')).toHaveCount(1)
  await expect(page.getByTestId('seat-cpu-2')).toHaveCount(0)
  await expect(page.getByTestId('draw')).toHaveAttribute('data-count', '35')
  await expect(page.getByTestId('you-hand')).toHaveAttribute('data-count', '8')

  await open(page, { seed: 'ek-e2e-setup-2', picks: ['pregame-opponents-2', 'pregame-difficulty-medium'] })
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '2')
  await expect(page.getByTestId('seat-cpu-2').locator('[data-difficulty="medium"]')).toHaveCount(1)
  await expect(page.getByTestId('seat-cpu-3')).toHaveCount(0)
  await expect(page.getByTestId('draw')).toHaveAttribute('data-count', '29')

  await open(page, { seed: 'ek-e2e-setup-3', picks: ['pregame-opponents-3', 'pregame-difficulty-hard'] })
  await expect(page.getByTestId('opponent-rows')).toHaveAttribute('data-count', '3')
  for (const seat of ['cpu-1', 'cpu-2', 'cpu-3']) {
    await expect(page.getByTestId(`seat-${seat}`)).toBeVisible()
    await expect(page.getByTestId(`seat-${seat}`).locator('[data-difficulty="hard"]')).toHaveCount(1)
  }
  await expect(page.getByTestId('seat-cpu-4')).toHaveCount(0)
  await expect(page.getByTestId('draw')).toHaveAttribute('data-count', '23')
  await page.screenshot({ path: testInfo.outputPath('setup-3-hard.png') })
})

test('opponents render as counts, not faces', async ({ page }, testInfo) => {
  await open(page, { seed: 'ek-e2e-counts', picks: ['pregame-opponents-2', 'pregame-difficulty-medium'] })
  for (const seat of ['cpu-1', 'cpu-2']) {
    await expect(page.getByTestId(`seat-${seat}`)).toHaveAttribute('data-alive', 'true')
    await expect(page.getByTestId(`seat-${seat}`)).toHaveAttribute('data-count', '8')
    await expect(page.getByTestId(`seat-${seat}-hand`)).toHaveAttribute('data-count', '8')
    await expectBacks(page, seat, 8)
  }
  const yours = page.locator('[data-testid="you-hand"] [data-testid^="card-"]')
  await expect(yours).toHaveCount(8)
  const labels = await yours.evaluateAll((nodes) =>
    nodes.map((node) => ({ face: node.getAttribute('data-face'), label: node.getAttribute('aria-label') })),
  )
  expect(labels.every((card) => card.face === 'up' && card.label !== null && card.label !== 'face-down card')).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('counts.png') })
})

test('a Nope chain, including Nope a Nope', async ({ page }, testInfo) => {
  // One Attack, one Nope. Medium nopes the Attack. Noping that Nope makes two, so the Attack resolves.
  await open(page, { rig: 'nope', seed: 'ek-e2e-nope-6', picks: ['pregame-opponents-1', 'pregame-difficulty-medium'] })
  const opened = watchAction(page)
  await page.getByTestId('action-card-attack').click({ force: true })
  const first = await readAction(await opened)
  const firstNoped = eventsOf(first.body).find((event) => event['type'] === 'Noped')
  expect(firstNoped?.['seat']).toBe('cpu-1')
  expect(firstNoped?.['nopes']).toBe(1)
  await expect(table(page)).toHaveAttribute('data-pending', 'nope', { timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-nopes', '1')
  await expect(table(page)).toHaveAttribute('data-effect', 'attack')
  await expect(page.getByTestId('action-nope')).toBeVisible()
  await expect(page.getByTestId('action-pass')).toBeVisible()
  await expect(page.getByTestId('discard').locator('[aria-label="NOPE"]')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('nope-window.png') })

  const answered = watchAction(page)
  await page.getByTestId('action-nope').click()
  const second = await readAction(await answered)
  const noped = eventsOf(second.body).find((event) => event['type'] === 'Noped' && event['seat'] === 'you')
  expect(noped?.['nopes']).toBe(2)
  expect(eventsOf(second.body).some((event) => event['type'] === 'Attacked')).toBe(true)
  expect(eventsOf(second.body).some((event) => event['type'] === 'Cancelled')).toBe(false)
  await expect(table(page)).toHaveAttribute('data-pending', 'turn', { timeout: 20_000 })
  await settled(page)
  await expect(table(page)).not.toHaveAttribute('data-effect')
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-count', '4')
})

test('you choose where a defuse puts the kitten', async ({ page }, testInfo) => {
  await open(page, { rig: 'kitten', seed: 'ek-e2e-plant-0', picks: ['pregame-opponents-1', 'pregame-difficulty-medium'] })
  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('defuse-kitten')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('insert-0')).toHaveAttribute('data-end', 'top')
  await expect(page.getByTestId('inserts')).toHaveAttribute('data-count', '35')
  await page.screenshot({ path: testInfo.outputPath('defuse-slots.png') })

  const planted = watchAction(page)
  await page.getByTestId('insert-4').click()
  const result = await readAction(await planted)
  expect(postedAction(result.posted)).toMatchObject({ type: 'defuse', index: 4 })
  expect(indexKeys(result.body)).toEqual([])
  expect(viewOf(result.body)['plantedIndex']).toBe(4)
  await expect(page.getByTestId('planted')).toHaveAttribute('data-index', '4', { timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-pending', 'nope')
})

test("a CPU's defuse index never reaches the client", async ({ page }) => {
  await open(page, { rig: 'kitten', seed: 'ek-e2e-defuse-13', picks: ['pregame-opponents-1', 'pregame-difficulty-medium'] })
  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('insert-0')).toBeVisible({ timeout: 20_000 })

  const buried = watchAction(page)
  await page.getByTestId('insert-0').click()
  const result = await readAction(await buried)
  expect(postedAction(result.posted)).toMatchObject({ type: 'defuse', index: 0 })
  expect(indexKeys(result.body)).toEqual([])
  const defused = eventsOf(result.body).filter((event) => event['type'] === 'Defused')
  expect(defused.map((event) => event['seat'])).toEqual(['you', 'cpu-1'])
  for (const event of defused) expect(Object.keys(event)).not.toContain('index')
  const view = viewOf(result.body)
  expect(view['plantedIndex']).toBeNull()
  expect(view['knownTop']).toEqual([])
  expect(view['seats']).toMatchObject({ 'cpu-1': { alive: true, count: 6 } })
  const cpu = isRecord(view['seats']) ? view['seats']['cpu-1'] : null
  expect(isRecord(cpu) ? Object.keys(cpu).sort() : []).toEqual(['alive', 'count'])

  await settled(page)
  await expect(page.getByTestId('planted')).toHaveCount(0)
  await expect(page.getByTestId('known-top')).toHaveCount(0)
  await expect(page.getByTestId('insert-0')).toHaveCount(0)
  await expectBacks(page, 'cpu-1', 6)
})

test('an explosion with no defuse loses', async ({ page }, testInfo) => {
  await open(page, { rig: 'explode', seed: 'ek-e2e-explode-0', picks: ['pregame-opponents-1', 'pregame-difficulty-medium'] })
  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('game-over')).toHaveAttribute('data-winner', 'cpu-1', { timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-state', 'over')
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-alive', 'false')
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-count', '0')
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-alive', 'true')
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-count', '8')
  await expectBacks(page, 'cpu-1', 8)
  await expect(page.getByTestId('discard').locator('[aria-label="EXPLODING KITTEN"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('exploded.png') })
})

test('the last living player wins', async ({ page }, testInfo) => {
  // Five distinct titles, shuffle doubled so the first tap selects. The discard defuse leaves the CPU with none.
  await open(page, { rig: 'five', seed: 'ek-e2e-win-38', picks: ['pregame-opponents-1', 'pregame-difficulty-medium'] })
  for (const [i, title] of ['shuffle', 'hairyPotato', 'beard', 'tacocat', 'defuse'].entries()) {
    await page.getByTestId(`action-card-${title}`).click({ force: true })
    await expect(page.locator('[data-testid="you-hand"] [data-selected="true"]')).toHaveCount(i + 1)
  }
  await page.getByTestId('discard').locator('[aria-label="DEFUSE"]').click({ force: true })
  await expect(page.getByTestId('seat-you')).toHaveAttribute('data-count', '4', { timeout: 20_000 })
  await settled(page)

  await page.getByTestId('action-draw').click()
  await expect(page.getByTestId('insert-0')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('insert-0').click()
  await expect(page.getByTestId('game-over')).toHaveAttribute('data-winner', 'you', { timeout: 20_000 })
  await settled(page)
  await expect(table(page)).toHaveAttribute('data-state', 'over')
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-alive', 'false')
  await expect(page.getByTestId('seat-cpu-1')).toHaveAttribute('data-count', '0')
  await expect(backs(page, 'cpu-1')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('won.png') })
})

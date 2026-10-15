import { expect, test, type Page } from './fixtures'

const games = [
  { id: 'blackjack', path: '/games/blackjack', title: 'Blackjack' },
  { id: 'flip7', path: '/games/flip7', title: 'Flip 7' },
  { id: 'exploding-kittens', path: '/games/exploding-kittens', title: 'Exploding Kittens' },
] as const

test.use({ passPregame: false })

async function chromeHit(page: Page) {
  return page.evaluate(() => {
    const back = document.querySelector('[data-testid="nav-back"]')
    const hud = document.querySelector('[data-testid="hud"]')
    const backdrop = document.querySelector('.sheet-backdrop')
    if (!back || !hud || !backdrop) return { ok: false, reason: 'missing' }
    const backBox = back.getBoundingClientRect()
    const hudBox = hud.getBoundingClientRect()
    const backdropBox = backdrop.getBoundingClientRect()
    const hit = document.elementFromPoint(backBox.x + backBox.width / 2, backBox.y + backBox.height / 2)
    const book = document.querySelector('[data-testid="hud-guide"]')
    const bookBox = book?.getBoundingClientRect()
    const bookHit = bookBox ? document.elementFromPoint(bookBox.x + bookBox.width / 2, bookBox.y + bookBox.height / 2) : null
    return {
      ok: backdropBox.top >= hudBox.bottom - 1 && !!hit && back.contains(hit) && !!book && !!bookHit && book.contains(bookHit),
      backdropTop: backdropBox.top,
      hudBottom: hudBox.bottom,
      backHit: hit?.getAttribute('data-testid') ?? hit?.className ?? null,
      bookHit: bookHit?.getAttribute('data-testid') ?? null,
    }
  })
}

async function clickDim(page: Page) {
  const point = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="pregame"]')?.getBoundingClientRect()
    const backdrop = document.querySelector('.sheet-backdrop')?.getBoundingClientRect()
    if (!card || !backdrop) return null
    const x = backdrop.left + backdrop.width / 2
    const above = card.top - 28
    if (above > backdrop.top + 8) return { x, y: above }
    const below = card.bottom + 28
    if (below < backdrop.bottom - 8) return { x, y: below }
    return { x: backdrop.left + 12, y: backdrop.top + 12 }
  })
  if (!point) throw new Error('no dim point')
  await page.mouse.click(point.x, point.y)
}

for (const game of games) {
  test(`${game.id} setup keeps the top bar live and Back returns to the lobby`, async ({ page }) => {
    await page.goto(game.path)
    const card = page.getByTestId('pregame')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('aria-label', game.title)
    await expect(page.getByTestId('pregame-play')).toBeVisible()
    await expect(page.getByTestId('pregame-back')).toHaveText(/back/i)

    const hit = await chromeHit(page)
    expect(hit.ok).toBe(true)

    await page.getByTestId('hud-sound').click()
    await expect(page.getByTestId('hud-sound')).toHaveAttribute('aria-pressed', 'true')
    await expect(card).toBeVisible()

    await page.getByTestId('hud-guide').click()
    await expect(page.getByTestId('guide')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('guide')).toHaveCount(0)
    await expect(card).toBeVisible()

    await page.getByTestId('hud-settings').click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings')).toHaveCount(0)
    await expect(card).toBeVisible()

    await clickDim(page)
    await expect(card).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${game.path}$`))

    await page.getByTestId('pregame-back').click()
    await expect(page.getByTestId('game-list')).toBeVisible()
    await expect(page.getByTestId(`game-${game.id}`)).toBeVisible()
  })

  test(`${game.id} setup: the arrow, Escape, and browser back return to the lobby`, async ({ page }) => {
    await page.goto(game.path)
    await expect(page.getByTestId('pregame')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('game-list')).toBeVisible()

    await page.getByTestId(`game-${game.id}`).click()
    await expect(page.getByTestId('pregame')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-list')).toBeVisible()

    await page.getByTestId(`game-${game.id}`).click()
    await expect(page.getByTestId('pregame')).toBeVisible()
    await page.getByTestId('nav-back').click()
    await expect(page.getByTestId('game-list')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
}

import { expect, test } from './fixtures'

const games = [
  { id: 'blackjack', path: '/games/blackjack', title: 'BLACKJACK', pregame: false, row: 'ace' },
  { id: 'flip7', path: '/games/flip7', title: 'FLIP 7', pregame: true, row: 'freeze' },
  { id: 'exploding-kittens', path: '/games/exploding-kittens', title: 'EXPLODING KITTENS', pregame: true, row: 'kitten' },
] as const

test.describe('how to play', () => {
  test.use({ guideSeen: false })

  test('the lobby has no book', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('hud-guide')).toHaveCount(0)
    await expect(page.getByTestId('guide')).toHaveCount(0)
  })

  for (const game of games) {
    test(`${game.id} opens once, closes, and the book opens it again`, async ({ page }) => {
      await page.goto(game.path)
      if (game.pregame) await page.getByTestId('pregame-play').click()
      const guide = page.getByTestId('guide')
      await expect(guide).toBeVisible()
      await expect(guide.getByRole('heading', { level: 1 })).toHaveText(game.title)
      await expect(page.getByTestId('guide-section-goal')).toBeVisible()
      await expect(page.getByTestId(`guide-row-${game.row}`)).toBeVisible()
      await expect(page.getByTestId('neon-root')).toHaveAttribute('inert', '')

      await page.getByTestId('guide-close').click()
      await expect(guide).toHaveCount(0)
      await expect(page.getByTestId('neon-root')).not.toHaveAttribute('inert', '')

      const book = page.getByTestId('hud-guide')
      const sound = page.getByTestId('hud-sound')
      await expect(book).toBeVisible()
      const bookBox = await book.boundingBox()
      const soundBox = await sound.boundingBox()
      if (!bookBox || !soundBox) throw new Error('missing hud icons')
      expect(bookBox.x + bookBox.width).toBeLessThanOrEqual(soundBox.x)

      await book.click()
      await expect(guide).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(guide).toHaveCount(0)

      await book.click()
      await page.getByTestId('guide-done').click()
      await expect(guide).toHaveCount(0)

      await page.reload()
      await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
      await expect(guide).toHaveCount(0)
      await expect(book).toBeVisible()
    })
  }
})

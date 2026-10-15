import { expect, test, type Page } from './fixtures'

// e2e is typed without the DOM lib, so the page-side code names the few browser APIs it uses.
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }
type El = { getBoundingClientRect(): Box; getAttribute(name: string): string | null }
type PageGlobals = {
  document: { querySelector(selector: string): El | null; querySelectorAll(selector: string): Iterable<El> }
  getComputedStyle(el: El): { backgroundImage: string; backgroundColor: string; filter: string }
}

type Layout = {
  chip: Box | null
  cards: Box[]
  holeFace: string | null
  holeImage: string
  holeColor: string
  holeFilter: string
}

const layoutOf = (page: Page) =>
  page.evaluate(() => {
    const g = globalThis as unknown as PageGlobals
    const box = (el: El | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return null
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
    }
    const hole = g.document.querySelector('[data-testid="dealer-card-1"]')
    const inner = g.document.querySelector('[data-testid="dealer-card-1"] .bj-card')
    const style = inner ? g.getComputedStyle(inner) : { backgroundImage: '', backgroundColor: '', filter: 'none' }
    const face = g.document.querySelector('[data-testid="dealer-card-1"] .bj-card-in')
    const faceStyle = face ? g.getComputedStyle(face) : { backgroundImage: 'none', backgroundColor: '', filter: 'none' }
    return {
      chip: box(g.document.querySelector('.bj-pot .bj-chip')),
      cards: [...g.document.querySelectorAll('[data-testid^="hand-0-card-"]')].map((el) => box(el)).filter((r) => r !== null),
      holeFace: hole?.getAttribute('data-face') ?? null,
      holeImage: faceStyle.backgroundImage,
      holeColor: faceStyle.backgroundColor,
      holeFilter: style.filter,
    } as Layout
  })

test('mid-hand: the stake sits above the player cards and the hole card is a card back', async ({ page }) => {
  await page.goto('/games/blackjack?rig=win')
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-state', 'playing')
  const table = page.getByTestId('blackjack-table')
  await expect(table).toHaveAttribute('data-busy', 'false')
  await page.getByTestId('chip-25').click()
  await page.getByTestId('action-deal').click()
  await expect(table).toHaveAttribute('data-stage', 'playing')
  await expect(table).toHaveAttribute('data-busy', 'false')

  const layout = await layoutOf(page)
  expect(layout.holeFace).toBe('hidden')
  expect(layout.holeImage).toContain('svg')
  expect(layout.holeColor).not.toBe('rgba(0, 0, 0, 0)')
  // A brightness filter on the card, under the tray's own filter, dropped the back on desktop.
  expect(layout.holeFilter).toBe('none')
  expect(layout.chip).not.toBeNull()
  expect(layout.cards.length).toBeGreaterThan(0)
  const chip = layout.chip as Box
  for (const card of layout.cards) {
    const overlaps = chip.left < card.right && chip.right > card.left && chip.top < card.bottom && chip.bottom > card.top
    expect(overlaps).toBe(false)
    expect(card.top - chip.bottom).toBeGreaterThan(24)
  }
})

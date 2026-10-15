import type { Browser } from '@playwright/test'
import { expect, test, type Page } from './fixtures'

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

async function secondPage(browser: Browser, host: Page): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: host.viewportSize() ?? { width: 1280, height: 720 } })
  await context.addInitScript(() => {
    for (const id of ['blackjack', 'flip7', 'exploding-kittens', 'high-card']) {
      localStorage.setItem(`neon-cards:guide-seen:${id}`, '1')
    }
  })
  const page = await context.newPage()
  return { page, close: () => context.close() }
}

async function openRoom(page: Page, rig?: string): Promise<string> {
  await page.goto(rig ? `/?rig=${encodeURIComponent(rig)}` : '/')
  await page.getByTestId('play-with-friends').click()
  await expect(page.getByTestId('room-screen')).toBeVisible()
  const code = (await page.getByTestId('room-code').innerText()).trim()
  expect(code).toMatch(CODE)
  await expect(page.getByTestId('nickname')).not.toHaveText('')
  return code
}

async function settled(page: Page) {
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-busy', 'false', { timeout: 45_000 })
}

test('a room plays Flip 7, a watcher takes a seat, and rematch rotates', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const code = await openRoom(page, 'win')
  await expect(page.getByTestId('room-deal')).toBeEnabled()
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-stage', 'playing')
  await settled(page)

  const guest = await secondPage(browser, page)
  await guest.page.goto(`/r/${code}`)
  await expect(guest.page.getByTestId('spectator-count')).toHaveText('1')
  await expect(page.getByTestId('spectator-count')).toHaveText('1')
  await guest.page.getByTestId('sit-s1').click()

  await page.getByTestId('action-hit').click()
  await settled(page)
  await page.getByTestId('action-stay').click()
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 45_000 })
  await expect(guest.page.getByTestId('room-screen')).toHaveAttribute('data-you', 's1')
  await expect(guest.page.getByTestId('spectator-count')).toHaveText('0')

  await page.getByTestId('room-rematch').click()
  await expect(page.getByTestId('room-screen')).toHaveAttribute('data-you', 's3')
  await expect(guest.page.getByTestId('room-screen')).toHaveAttribute('data-you', 's0')
  await expect(page.getByTestId('room-deal')).toBeEnabled()
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-stage', 'playing', { timeout: 20_000 })
  await guest.close()
})

test('the host leaving closes the room for someone who joined with the code', async ({ page, browser }) => {
  const code = await openRoom(page)
  const guest = await secondPage(browser, page)
  await guest.page.goto('/')
  await guest.page.getByTestId('room-code-input').fill(code)
  await guest.page.getByTestId('room-join').click()
  await expect(guest.page.getByTestId('nickname')).toBeVisible()
  await page.getByTestId('room-leave').click()
  await expect(guest.page.getByTestId('room-closed')).toBeVisible()
  await guest.close()
})

test('exploding kittens deals in the same room', async ({ page }) => {
  await page.goto('/games/exploding-kittens')
  await page.getByTestId('pregame-friends').click()
  const code = (await page.getByTestId('room-code').innerText()).trim()
  expect(code).toMatch(CODE)
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('ek-table')).toBeVisible()
})

type BarBox = { id: string; x: number; y: number; right: number; bottom: number; bar: boolean }
type BarEl = {
  getBoundingClientRect(): { x: number; y: number; right: number; bottom: number; width: number; height: number }
  getAttribute(name: string): string | null
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
  parentElement: BarEl | null
  textContent: string | null
}
type BarPage = {
  document: { querySelector(selector: string): BarEl | null; querySelectorAll(selector: string): Iterable<BarEl> }
  getComputedStyle(el: BarEl): { overflow: string; overflowX: string; overflowY: string }
  innerWidth: number
  innerHeight: number
}

test('the room top bar does not overlap or clip', async ({ page }) => {
  await openRoom(page, 'win')
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-stage', 'playing')
  await settled(page)
  const you = await page.getByTestId('room-screen').getAttribute('data-you')
  expect(you).toBeTruthy()
  await expect(page.getByTestId(`seat-${you}-name`)).toHaveText(/\S/)
  const cpu = page.locator('[data-testid="opponent-rows"] [data-kind="cpu"]').first()
  await expect(cpu.locator('.nc-seat-name')).toHaveText(/\S/)
  await expect(cpu.locator('.nc-bot')).toBeVisible()
  const problems = await page.evaluate(() => {
    const g = globalThis as unknown as BarPage
    const ids = ['hud-total', 'room-code', 'nickname', 'spectator-count', 'room-leave', 'hud-guide', 'hud-sound', 'hud-settings']
    const bar = ids.map((id) => g.document.querySelector(`[data-testid="${id}"]`))
    const missing = ids.filter((_, i) => !bar[i])
    const names = [...g.document.querySelectorAll('[data-testid="opponent-rows"] .nc-seat-name')]
    const entries: { id: string; el: BarEl; bar: boolean }[] = [
      ...bar.flatMap((el, i) => (el ? [{ id: ids[i] ?? 'bar', el, bar: true }] : [])),
      ...names.map((el) => ({ id: el.getAttribute('data-testid') || el.textContent?.trim() || 'seat', el, bar: false })),
    ]
    const boxes: BarBox[] = entries.map(({ id, el, bar: isBar }) => {
      const r = el.getBoundingClientRect()
      return { id, x: r.x, y: r.y, right: r.right, bottom: r.bottom, bar: isBar }
    })
    const hit = (a: BarBox, b: BarBox) => {
      const w = Math.min(a.right, b.right) - Math.max(a.x, b.x)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
      return w > 1 && h > 1
    }
    const found: string[] = missing.map((id) => `missing ${id}`)
    entries.forEach((entry, i) => {
      const a = boxes[i]
      if (!a) return
      if (a.x < -1 || a.y < -1 || a.right > g.innerWidth + 1 || a.bottom > g.innerHeight + 1) found.push(`offscreen ${a.id}`)
      const node = entry.el
      if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) found.push(`clipped ${a.id}`)
      let parent = node.parentElement
      while (parent) {
        const style = g.getComputedStyle(parent)
        if (/hidden|clip|scroll|auto/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) {
          const p = parent.getBoundingClientRect()
          if (a.x < p.x - 1 || a.y < p.y - 1 || a.right > p.right + 1 || a.bottom > p.bottom + 1) {
            found.push(`clipped by parent ${a.id}`)
            break
          }
        }
        parent = parent.parentElement
      }
      if (!a.bar) return
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]
        if (b && hit(a, b)) found.push(`overlap ${a.id} ${b.id}`)
      }
    })
    return found
  })
  expect(problems, problems.join('\n')).toEqual([])
})

test('two missed turns cover the chair, a reload keeps I am back, and the player returns', async ({ page, browser }) => {
  test.setTimeout(150_000)
  const code = await openRoom(page, 'you=2,3,4;cpu=12,11,10')
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-pending', 'hitOrStay', { timeout: 20_000 })
  const guest = await secondPage(browser, page)
  await guest.page.goto(`/r/${code}`)
  await expect(guest.page.getByTestId('spectator-count')).toHaveText('1')
  await expect(page.getByTestId('room-back')).toBeVisible({ timeout: 90_000 })
  await page.reload()
  await expect(page.getByTestId('room-back')).toBeVisible()
  await page.getByTestId('room-back').click()
  await expect(page.getByTestId('room-back')).toHaveCount(0)
  await expect(page.getByTestId('room-screen')).not.toHaveAttribute('data-you', '')
  await guest.close()
})

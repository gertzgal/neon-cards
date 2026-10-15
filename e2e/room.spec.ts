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

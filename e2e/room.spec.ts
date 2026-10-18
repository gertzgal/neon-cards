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

async function openSizedRoom(page: Page, seats: number, rig = 'you=1,2,3,4,5,6;cpu=12,11,10') {
  await page.goto('/')
  const code = await page.evaluate(async (count) => {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: 'flip7', seats: count }),
    })
    if (!res.ok) throw new Error(await res.text())
    const body = (await res.json()) as { code: string }
    return body.code
  }, seats)
  await page.goto(`/r/${code}?rig=${encodeURIComponent(rig)}`)
  await expect(page.getByTestId('room-deal')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('room-deal').click()
  await expect(page.getByTestId('flip7-table')).toHaveAttribute('data-stage', 'playing')
  await settled(page)
  await expect(page.locator('[data-testid="opponent-rows"] .nc-seat')).toHaveCount(seats - 1)
}

type FitEl = {
  getBoundingClientRect(): { x: number; y: number; right: number; bottom: number; width: number; height: number }
  getAttribute(name: string): string | null
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}
type FitPage = {
  document: { querySelector(selector: string): FitEl | null; querySelectorAll(selector: string): Iterable<FitEl> }
  innerWidth: number
  innerHeight: number
}

function fitProblems(): string[] {
  const g = globalThis as unknown as FitPage
  const layout = [
    ...g.document.querySelectorAll('[data-testid="hud"]'),
    ...g.document.querySelectorAll('[data-testid="opponent-rows"] .nc-seat'),
    ...g.document.querySelectorAll('[data-testid="draw-pile"]'),
    ...g.document.querySelectorAll('[data-testid="you-hand"]'),
    ...g.document.querySelectorAll('[data-testid="round-value"]'),
  ]
  const names = [...g.document.querySelectorAll('[data-testid="opponent-rows"] .nc-seat-name')]
  const boxOf = (el: FitEl) => {
    const r = el.getBoundingClientRect()
    return { id: el.getAttribute('data-testid') || 'name', x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, el }
  }
  const boxes = layout.map(boxOf)
  const found: string[] = []
  const faces = [...g.document.querySelectorAll('[data-testid="you-hand"] [data-face]')]
  if (faces.length === 0 || faces.some((face) => face.getAttribute('data-face') !== 'up')) found.push('face down')
  const scroller = g.document.querySelector('[data-testid="you-hand"] .nc-hand-scroll')
  if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) found.push('hand scrolls')
  const slots = [...g.document.querySelectorAll('[data-testid="you-hand"] .nc-slot')].map(boxOf)
  for (let i = 0; i < slots.length - 1; i++) {
    const a = slots[i]
    const b = slots[i + 1]
    if (!a || !b) continue
    if (b.x < a.right - 1) found.push('hand cards overlap')
  }
  if (g.innerWidth === 360) {
    const pile = g.document.querySelector('[data-testid="draw-pile"] .nc-card')
    const turn = g.document.querySelector('[data-testid="opponent-rows"] .nc-card')
    if (pile && pile.getBoundingClientRect().width < 32) found.push('pile sliver')
    if (turn && turn.getBoundingClientRect().width < 32) found.push('turn card sliver')
  }
  if (g.innerWidth >= 1280) {
    const hand = slots[0]
    if (hand && hand.height > 190) found.push('hand oversized')
  }
  if (g.innerWidth === 1280 && g.innerHeight === 800) {
    const buttons = [...g.document.querySelectorAll('[data-testid="table-controls"] button')]
    if (buttons.length === 0) found.push('missing buttons')
    for (const button of buttons) {
      const rect = button.getBoundingClientRect()
      if (rect.top < -1 || rect.bottom > g.innerHeight - 1 || rect.height < 40) found.push('button clipped')
    }
  }
  const mark = (a: { id: string; x: number; y: number; right: number; bottom: number; el: FitEl }, text: boolean) => {
    if (a.x < -1 || a.y < -1 || a.right > g.innerWidth + 1 || a.bottom > g.innerHeight + 1) found.push(`offscreen ${a.id}`)
    if (text && (a.el.scrollWidth > a.el.clientWidth + 1 || a.el.scrollHeight > a.el.clientHeight + 1)) found.push(`clipped ${a.id}`)
  }
  boxes.forEach((a, i) => {
    mark(a, false)
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (!b) continue
      const w = Math.min(a.right, b.right) - Math.max(a.x, b.x)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
      if (w > 1 && h > 1) found.push(`overlap ${a.id} ${b.id}`)
    }
  })
  names.map(boxOf).forEach((name) => mark(name, true))
  return found
}

test('a room table fits 2, 3, and 4 players without overlap', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const viewports =
    testInfo.project.name === 'phone'
      ? [
          { width: 390, height: 844 },
          { width: 360, height: 640 },
        ]
      : [
          { width: 1440, height: 900 },
          { width: 1280, height: 800 },
        ]
  for (const seats of [2, 3, 4]) {
    await openSizedRoom(page, seats)
    for (let n = 0; n < 4; n++) {
      const hit = page.getByTestId('action-hit')
      if ((await hit.count()) === 0 || !(await hit.isEnabled())) break
      await hit.click()
      await settled(page)
    }
    expect(Number(await page.getByTestId('you-hand').getAttribute('data-count'))).toBeGreaterThanOrEqual(4)
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.evaluate(async () => {
        const w = globalThis as unknown as {
          requestAnimationFrame(fn: () => void): number
          document: { getAnimations(): { finished: Promise<void> }[] }
          CSSTransition: new () => { finished: Promise<void> }
        }
        await new Promise<void>((resolve) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => resolve())))
        const pending = w.document.getAnimations().filter((anim) => anim instanceof w.CSSTransition)
        await Promise.all(pending.map((anim) => anim.finished.catch(() => undefined)))
        await new Promise<void>((resolve) => w.requestAnimationFrame(() => resolve()))
      })
      const problems = await page.evaluate(fitProblems)
      expect(problems, `${seats} players at ${viewport.width}x${viewport.height}\n${problems.join('\n')}`).toEqual([])
    }
  }
  await openSizedRoom(page, 4, 'you=2,4,6,8,2;cpu=12,11,10')
  for (let n = 0; n < 6; n++) {
    const hit = page.getByTestId('action-hit')
    if ((await hit.count()) === 0 || !(await hit.isEnabled())) break
    await hit.click()
    await settled(page)
  }
  await expect(page.locator('.f7-me')).toHaveAttribute('data-status', 'busted')
  expect(Number(await page.getByTestId('you-hand').getAttribute('data-count'))).toBeGreaterThanOrEqual(4)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.evaluate(async () => {
      const w = globalThis as unknown as {
        requestAnimationFrame(fn: () => void): number
        document: { getAnimations(): { finished: Promise<void> }[] }
        CSSTransition: new () => { finished: Promise<void> }
      }
      await new Promise<void>((resolve) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => resolve())))
      const pending = w.document.getAnimations().filter((anim) => anim instanceof w.CSSTransition)
      await Promise.all(pending.map((anim) => anim.finished.catch(() => undefined)))
      await new Promise<void>((resolve) => w.requestAnimationFrame(() => resolve()))
    })
    const problems = await page.evaluate(fitProblems)
    expect(problems, `busted at ${viewport.width}x${viewport.height}\n${problems.join('\n')}`).toEqual([])
  }
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

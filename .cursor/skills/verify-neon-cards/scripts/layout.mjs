#!/usr/bin/env node
// Usage: layout.mjs --url <base> --out <dir>
// Drives the real tables and fails when a hand card, slot, or action button is clipped or overlapping.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
  },
})
if (!values.url || !values.out) throw new Error('--url and --out are required')

const viewports = [
  { name: '360x640', width: 360, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: '390x844', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: '1280x800', width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '1440x900', width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
]

const scenes = [
  {
    id: 'ek-defuse',
    min: { cards: 8, slots: 23, buttons: 0 },
    run: async (page) => {
      await gotoGame(page, '/games/exploding-kittens?rig=kitten&seed=ek-viewport-defuse')
      await page.getByTestId('pregame-opponents-3').click()
      await startTable(page, 'ek-table')
      await page.getByTestId('action-draw').click()
      await page.getByTestId('defuse-kitten').waitFor({ state: 'visible', timeout: 20_000 })
      await settled(page, 'ek-table')
      await page.waitForFunction(
        () => globalThis.document.querySelector('[data-testid="inserts"]')?.getAttribute('data-count') === '23',
        null,
        { timeout: 20_000 },
      )
      await page.waitForFunction(
        () => globalThis.document.querySelector('[data-testid="you-hand"]')?.getAttribute('data-count') === '8',
        null,
        { timeout: 20_000 },
      )
    },
  },
  {
    id: 'flip7-hand',
    min: { cards: 7, slots: 7, buttons: 2 },
    run: async (page) => {
      const rig = 'you=8,+4,3,x2,1,+10,2,4,5,6,7;cpu=12,11,10'
      await gotoGame(page, `/games/flip7?rig=${encodeURIComponent(rig)}`)
      await startTable(page, 'flip7-table')
      for (const value of ['12', '15', '26', '28', '38', '42', '50', '60']) {
        await page.getByTestId('action-hit').click()
        await page.waitForFunction(
          (text) => (globalThis.document.querySelector('[data-testid="round-value"]')?.textContent ?? '').includes(text),
          value,
          { timeout: 20_000 },
        )
        await settled(page, 'flip7-table')
      }
    },
  },
  {
    id: 'blackjack-hand',
    min: { cards: 6, slots: 0, buttons: 4 },
    run: async (page) => {
      await gotoGame(page, '/games/blackjack?rig=2H,10C,2S,7D,AH,AS,2C,2D,3H,KS')
      await startTable(page, 'blackjack-table')
      await page.getByTestId('chip-25').click()
      await page.getByTestId('action-deal').click()
      for (const total of ['5/15', '6/16', '8/18', '10/20']) {
        await page.getByTestId('action-hit').click()
        await page.waitForFunction(
          (text) => (globalThis.document.querySelector('[data-testid="hand-0-total"]')?.textContent ?? '').includes(text),
          total,
          { timeout: 20_000 },
        )
        await settled(page, 'blackjack-table')
      }
    },
  },
]

await mkdir(values.out, { recursive: true })
const browser = await chromium.launch()
const failures = []
const report = { url: values.url, viewports: viewports.map((viewport) => viewport.name), runs: [] }

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    deviceScaleFactor: viewport.deviceScaleFactor,
    reducedMotion: 'reduce',
  })
  for (const scene of scenes) {
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()))
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    const shot = join(values.out, `${viewport.name}-${scene.id}.png`)
    try {
      await scene.run(page)
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))
          }),
      )
      const found = await measure(page)
      const short = []
      for (const key of ['cards', 'slots', 'buttons']) {
        if (found.counts[key] < scene.min[key]) short.push(`${key} ${found.counts[key]} < ${scene.min[key]}`)
      }
      const issues = [...found.issues]
      if (short.length) issues.push({ kind: 'empty', label: scene.id, detail: short.join(', ') })
      if (consoleErrors.length) issues.push({ kind: 'console', label: scene.id, detail: consoleErrors.join(' | ') })
      for (const issue of issues) failures.push(`${viewport.name} ${scene.id}: ${issue.kind} ${issue.label}: ${issue.detail}`)
      report.runs.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        scene: scene.id,
        counts: found.counts,
        issues,
        consoleErrors,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failures.push(`${viewport.name} ${scene.id}: drive: ${message.split('\n')[0]}`)
      report.runs.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        scene: scene.id,
        counts: null,
        issues: [{ kind: 'drive', label: scene.id, detail: message.split('\n')[0] }],
        consoleErrors,
      })
    }
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {})
    await page.close()
  }
  await context.close()
}

await browser.close()
report.failures = failures
await writeFile(join(values.out, 'layout.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (failures.length) {
  console.error(`FAIL\n${failures.join('\n')}`)
  process.exit(1)
}
console.error(`PASS ${viewports.map((viewport) => viewport.name).join(', ')} -> ${values.out}`)

async function gotoGame(page, path) {
  const response = await page.goto(new URL(path, values.url).href, { waitUntil: 'domcontentloaded' })
  if (response && response.status() >= 400) throw new Error(`${path} returned ${response.status()}`)
  const screen = page.getByTestId('game-screen')
  await screen.waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(
    () => {
      const state = globalThis.document.querySelector('[data-testid="game-screen"]')?.getAttribute('data-state')
      return state && state !== 'loading'
    },
    null,
    { timeout: 20_000 },
  )
  const state = await screen.getAttribute('data-state')
  if (state === 'error') {
    const message = await page.getByTestId('game-error').innerText()
    throw new Error(message)
  }
  if (state !== 'setup') throw new Error(`expected the pre-game sheet, got ${state}`)
}

async function startTable(page, tableId) {
  await page.getByTestId('pregame-play').click()
  await page.waitForFunction(
    () => globalThis.document.querySelector('[data-testid="game-screen"]')?.getAttribute('data-state') === 'playing',
    null,
    { timeout: 20_000 },
  )
  await page.getByTestId(tableId).waitFor({ state: 'visible', timeout: 20_000 })
  const guide = page.getByTestId('guide')
  const opened = await guide.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
  if (opened) {
    await page.getByTestId('guide-done').click()
    await guide.waitFor({ state: 'hidden', timeout: 10_000 })
  }
  await settled(page, tableId)
}

async function settled(page, tableId) {
  await page.waitForFunction(
    (id) => {
      const el = globalThis.document.querySelector(`[data-testid="${id}"]`)
      if (!el || el.getAttribute('data-busy') !== 'false') return false
      const animating = el.getAttribute('data-animating')
      return animating === null || animating === 'false'
    },
    tableId,
    { timeout: 20_000 },
  )
}

async function measure(page) {
  return page.evaluate(() => {
    const g = globalThis
    const doc = g.document
    const vw = g.innerWidth
    const vh = g.innerHeight
    const slop = 1
    const table = doc.querySelector('[data-testid="ek-table"], [data-testid="flip7-table"], [data-testid="blackjack-table"]')
    if (!table) return { counts: { cards: 0, slots: 0, buttons: 0 }, issues: [{ kind: 'empty', label: 'table', detail: 'no table' }] }

    const shown = (el) => {
      const style = g.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const rect = el.getBoundingClientRect()
      return rect.width >= 1 && rect.height >= 1
    }
    const labelOf = (el) => el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.tagName.toLowerCase()
    const box = (el) => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    }
    const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > slop && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > slop
    const where = (rect) => `x=${Math.round(rect.left)}-${Math.round(rect.right)} y=${Math.round(rect.top)}-${Math.round(rect.bottom)}`
    const issues = []
    const seen = new Set()
    const take = (list, el) => {
      if (seen.has(el) || !shown(el)) return
      seen.add(el)
      list.push(el)
    }

    const cards = []
    for (const el of table.querySelectorAll(
      '[data-testid="you-hand"] .nc-card, [data-testid="you-extras"] .nc-card, [data-testid="dealer-hand"] .bj-card, [data-testid^="hand-"] .bj-card',
    )) take(cards, el)

    const slots = []
    for (const el of table.querySelectorAll('[data-testid="inserts"] button, [data-testid="slots"] [data-testid^="slot-"]')) take(slots, el)

    const buttons = []
    for (const el of table.querySelectorAll('button')) {
      const id = el.getAttribute('data-testid') || ''
      if (id.startsWith('action-card-') || el.querySelector('.nc-card, .bj-card')) continue
      if (!id.startsWith('action-') && id !== 'play-card') continue
      take(buttons, el)
    }

    const clippingAncestor = (el) => {
      const rect = el.getBoundingClientRect()
      let node = el.parentElement
      while (node && node !== doc.body) {
        const style = g.getComputedStyle(node)
        const clips = (value) => value === 'hidden' || value === 'auto' || value === 'scroll' || value === 'clip' || value === 'overlay'
        const clipX = clips(style.overflowX)
        const clipY = clips(style.overflowY)
        if (clipX || clipY) {
          const bounds = node.getBoundingClientRect()
          const covers =
            bounds.left <= slop && bounds.top <= slop && bounds.right >= vw - slop && bounds.bottom >= vh - slop
          const pastX = clipX && (rect.left < bounds.left - slop || rect.right > bounds.right + slop)
          const pastY = clipY && (rect.top < bounds.top - slop || rect.bottom > bounds.bottom + slop)
          if (!covers && (pastX || pastY)) return labelOf(node)
        }
        node = node.parentElement
      }
      return null
    }

    const place = (el, kind) => {
      const rect = box(el)
      const name = labelOf(el)
      if (rect.left < -slop || rect.top < -slop || rect.right > vw + slop || rect.bottom > vh + slop) {
        issues.push({ kind: 'clip', label: `${kind} ${name}`, detail: `${where(rect)} outside ${vw}x${vh}` })
      }
      const ancestor = clippingAncestor(el)
      if (ancestor) issues.push({ kind: 'clip', label: `${kind} ${name}`, detail: `clipped by ${ancestor} ${where(rect)}` })
    }

    for (const el of cards) place(el, 'card')
    for (const el of slots) place(el, 'slot')
    for (const el of buttons) place(el, 'button')

    const fitCards = cards.filter((el) => el.closest('[data-layout="fit"]'))
    for (let i = 0; i < fitCards.length; i++) {
      for (let j = i + 1; j < fitCards.length; j++) {
        const a = fitCards[i]
        const b = fitCards[j]
        if (!a || !b) continue
        if (!overlaps(box(a), box(b))) continue
        issues.push({ kind: 'overlap', label: `card ${labelOf(a)}`, detail: `overlaps card ${labelOf(b)}` })
      }
    }

    for (const row of table.querySelectorAll('[data-testid="inserts"], [data-testid="slots"]')) {
      const items = [...row.querySelectorAll('button, [data-testid^="slot-"]')].filter(shown)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]
          const b = items[j]
          if (!a || !b || !overlaps(box(a), box(b))) continue
          issues.push({ kind: 'overlap', label: `slot ${labelOf(a)}`, detail: `overlaps slot ${labelOf(b)}` })
        }
      }
    }

    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i]
        const b = buttons[j]
        if (!a || !b || !overlaps(box(a), box(b))) continue
        issues.push({ kind: 'overlap', label: `button ${labelOf(a)}`, detail: `overlaps button ${labelOf(b)}` })
      }
    }

    const covered = (el) => {
      const rect = el.getBoundingClientRect()
      const ix = Math.min(3, rect.width / 4)
      const iy = Math.min(3, rect.height / 4)
      const points = [
        [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
        [rect.left + ix, rect.top + iy],
        [rect.right - ix, rect.top + iy],
        [rect.left + ix, rect.bottom - iy],
        [rect.right - ix, rect.bottom - iy],
      ]
      for (const point of points) {
        const x = point[0]
        const y = point[1]
        if (x < 0 || y < 0 || x > vw || y > vh) continue
        const hit = doc.elementFromPoint(x, y)
        if (!hit) return `nothing at ${Math.round(x)},${Math.round(y)}`
        if (!el.contains(hit)) return `${labelOf(hit)} at ${Math.round(x)},${Math.round(y)}`
      }
      return null
    }

    for (const slot of slots) {
      if (slot.tagName === 'BUTTON') continue
      for (const card of cards) {
        if (!overlaps(box(slot), box(card))) continue
        issues.push({ kind: 'overlap', label: `slot ${labelOf(slot)}`, detail: `overlaps card ${labelOf(card)}` })
      }
      for (const button of buttons) {
        if (!overlaps(box(slot), box(button))) continue
        issues.push({ kind: 'overlap', label: `slot ${labelOf(slot)}`, detail: `overlaps button ${labelOf(button)}` })
      }
    }

    for (const el of [...buttons, ...slots]) {
      if (el.tagName !== 'BUTTON') continue
      const hit = covered(el)
      if (hit) issues.push({ kind: 'overlap', label: labelOf(el), detail: `covered by ${hit}` })
    }

    return { counts: { cards: cards.length, slots: slots.length, buttons: buttons.length }, issues }
  })
}

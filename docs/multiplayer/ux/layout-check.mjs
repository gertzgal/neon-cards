import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const shotDir = here
const port = 5199
const origin = `http://127.0.0.1:${port}`

const sizes = [
  { name: '390', width: 390, height: 844 },
  { name: '360', width: 360, height: 640 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
]

function startVite() {
  const child = spawn(
    'pnpm',
    ['--filter', '@neon-cards/web', 'exec', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let log = ''
  child.stdout.on('data', (chunk) => {
    log += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    log += String(chunk)
  })
  return { child, readLog: () => log }
}

async function waitForServer(child) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('vite exited before it was ready')
    try {
      const res = await fetch(`${origin}/ux-preview.html`)
      if (res.ok) return
    } catch {
      // vite is still binding the port
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('vite did not serve ux-preview.html')
}

async function problemsOf(page, width, height) {
  return page.evaluate(({ width: viewW, height: viewH }) => {
    const g = globalThis
    const nodes = [...g.document.querySelectorAll('[data-region]')]
    const boxes = nodes.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.getAttribute('data-region') || 'region',
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }
    })
    const found = []
    const contains = (a, b) => a.x <= b.x + 1 && a.y <= b.y + 1 && a.right + 1 >= b.right && a.bottom + 1 >= b.bottom
    const bands = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
    const hits = (a, b) => bands(a, b) && Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1
    g.document.querySelectorAll('.nc-card').forEach((card) => {
      const face = card.querySelector('.nc-card-in')
      if (!face) return
      const box = face.getBoundingClientRect()
      card.querySelectorAll('.ek-face-title span').forEach((span) => {
        const text = (span.textContent || '').trim()
        if (!text) return
        const range = g.document.createRange()
        range.selectNodeContents(span)
        const ink = range.getBoundingClientRect()
        const outside = ink.left < box.left + 1 || ink.right > box.right - 1
        const line = span.scrollWidth > span.clientWidth + 1
        const note = `title ${text} outside ${card.getAttribute('data-testid') || 'card'}`
        if ((outside || line) && !found.includes(note)) found.push(note)
      })
    })
    const hands = [...g.document.querySelectorAll('[data-region^="hand-"]')]
    const stacked = hands.length >= 2 && hands.every((hand, index) => {
      if (index === 0) return true
      const prev = hands[index - 1].getBoundingClientRect()
      const cur = hand.getBoundingClientRect()
      return cur.top >= prev.bottom - 1 || prev.top >= cur.bottom - 1
    })
    const targets = [...hands, ...g.document.querySelectorAll('[data-region^="total-split-"]')]
    g.document.querySelectorAll('.ux-you .nc-seat-name, .ux-you .ux-points').forEach((label) => {
      const a = label.getBoundingClientRect()
      targets.forEach((hand) => {
        const b = hand.getBoundingClientRect()
        const note = `name on ${hand.getAttribute('data-region')}`
        if ((hits(a, b) || (stacked && bands(a, b))) && !found.includes(note)) found.push(note)
      })
    })
    boxes.forEach((box, i) => {
      if (box.w < 1 || box.h < 1) found.push(`empty ${box.id}`)
      if (box.x < -1 || box.y < -1 || box.right > viewW + 1 || box.bottom > viewH + 1) found.push(`offscreen ${box.id}`)
      if (box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1) found.push(`clipped ${box.id}`)
      for (let j = i + 1; j < boxes.length; j++) {
        const other = boxes[j]
        if (!other || contains(box, other) || contains(other, box)) continue
        const w = Math.min(box.right, other.right) - Math.max(box.x, other.x)
        const h = Math.min(box.bottom, other.bottom) - Math.max(box.y, other.y)
        if (w > 1 && h > 1) found.push(`overlap ${box.id} ${other.id}`)
      }
    })
    if (g.document.documentElement.scrollWidth > viewW + 1 || g.document.documentElement.scrollHeight > viewH + 1) {
      found.push('page scrolls')
    }
    return found
  }, { width, height })
}

const vite = startVite()
const failures = []
let browser
try {
  await waitForServer(vite.child)
  await mkdir(shotDir, { recursive: true })
  browser = await chromium.launch()
  const probe = await browser.newPage()
  await probe.goto(`${origin}/ux-preview.html`, { waitUntil: 'networkidle' })
  await probe.locator('html[data-scenes]').waitFor()
  const raw = await probe.locator('html').getAttribute('data-scenes')
  await probe.close()
  const scenes = (raw ?? '').split(' ').filter(Boolean)
  if (scenes.length === 0) throw new Error('ux preview listed no scenes')
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const scene of scenes) {
      await page.goto(`${origin}/ux-preview.html?scene=${scene}`, { waitUntil: 'networkidle' })
      await page.locator('[data-testid="ux-preview"]').waitFor()
      await page.evaluate(() => {
        const g = globalThis
        return g.document.fonts.ready
      })
      await page.locator('html[data-titles-fit="true"]').waitFor()
      const problems = await problemsOf(page, size.width, size.height)
      const file = path.join(shotDir, `${scene}-${size.name}.png`)
      if (process.env.UX_LAYOUT_SHOTS !== '0') await page.screenshot({ path: file })
      if (problems.length > 0) failures.push(`${scene} ${size.width}x${size.height}: ${problems.join('; ')}`)
    }
    await page.close()
  }
} catch (err) {
  process.stderr.write(`${vite.readLog()}\n`)
  throw err
} finally {
  await browser?.close()
  vite.child.kill('SIGTERM')
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exit(1)
}
process.stdout.write(`layout check passed, shots in ${shotDir}\n`)

#!/usr/bin/env node
// Usage: drive.mjs --url <base> --out <dir> [--path /route] [--expect testid=text]... [--click testid]... [--viewport phone|desktop]
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    path: { type: 'string', default: '/' },
    expect: { type: 'string', multiple: true, default: [] },
    click: { type: 'string', multiple: true, default: [] },
    viewport: { type: 'string', multiple: true, default: ['phone', 'desktop'] },
  },
})
if (!values.url || !values.out) throw new Error('--url and --out are required')

const viewports = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
}

const expectations = values.expect.map((pair) => {
  const at = pair.indexOf('=')
  return at === -1 ? { testid: pair, text: null } : { testid: pair.slice(0, at), text: pair.slice(at + 1) }
})

await mkdir(values.out, { recursive: true })
const browser = await chromium.launch()
const failures = []
const report = { url: values.url, path: values.path, runs: [] }

for (const name of values.viewport) {
  const { width, height, ...device } = viewports[name] ?? viewports.desktop
  const context = await browser.newContext({ viewport: { width, height }, ...device })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()))
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  const response = await page.goto(new URL(values.path, values.url).href, { waitUntil: 'networkidle' })
  await page.screenshot({ path: join(values.out, `${name}-before.png`), fullPage: true })

  for (const testid of values.click) {
    await page.getByTestId(testid).click()
    await page.waitForLoadState('networkidle')
  }

  for (const { testid, text } of expectations) {
    const locator = page.getByTestId(testid)
    try {
      if (text === null) await locator.first().waitFor({ state: 'visible', timeout: 5000 })
      else await locator.filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 5000 })
    } catch {
      const actual = (await locator.count()) ? await locator.first().innerText() : '<missing>'
      failures.push(`${name}: [data-testid=${testid}] expected ${JSON.stringify(text)}, got ${JSON.stringify(actual)}`)
    }
  }

  const testids = await page.$$eval('[data-testid]', (els) =>
    els.map((el) => ({
      testid: el.getAttribute('data-testid'),
      text: el.textContent?.trim().slice(0, 120) ?? '',
      state: el.getAttribute('data-state'),
    })),
  )
  await page.screenshot({ path: join(values.out, `${name}.png`), fullPage: true })
  if (consoleErrors.length) failures.push(`${name}: console errors: ${consoleErrors.join(' | ')}`)
  report.runs.push({ viewport: name, status: response?.status() ?? null, clicks: values.click, testids, consoleErrors })
  await context.close()
}

await browser.close()
report.failures = failures
await writeFile(join(values.out, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (failures.length) {
  console.error(`FAIL\n${failures.join('\n')}`)
  process.exit(1)
}
console.error(`PASS ${values.viewport.join(', ')} -> ${values.out}`)

import { test as base } from '@playwright/test'

// Each test already gets a fresh browser context, so a fresh `nc_player` cookie,
// wallet, and session. `parallelIndex` selects the worker's own wrangler and D1,
// so two tests never write the same SQLite file.
const external = process.env['BASE_URL']
const port = Number(process.env['E2E_PORT'] ?? 8800)

export const test = base.extend({
  // Replaces the built-in baseURL. The empty pattern is Playwright's fixture bag.
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use, info) => {
    if (external) {
      await use(external)
      return
    }
    const workers = Number(process.env['E2E_WORKERS'] ?? 1)
    if (info.parallelIndex >= workers) {
      throw new Error(`parallelIndex ${info.parallelIndex} has no D1 (only ${workers} stacks)`)
    }
    await use(`http://127.0.0.1:${port + info.parallelIndex}`)
  },
})

export { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

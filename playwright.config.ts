import os from 'node:os'
import { defineConfig, devices } from '@playwright/test'

// One wrangler + a fresh local D1 per worker, on ports E2E_PORT .. E2E_PORT+workers-1.
// The ready probe (E2E_READY_PORT) comes up only after every stack is healthy.
// BASE_URL (the verify skill, or a stack you already started) skips the servers
// and pins every test at that one origin; use E2E_WORKERS=1 there.
const external = process.env['BASE_URL']
const port = Number(process.env['E2E_PORT'] ?? 8800)
const workers = Number(
  process.env['E2E_WORKERS'] ??
    (external ? 1 : process.env['CI'] ? 4 : Math.min(4, os.availableParallelism())),
)
const readyPort = port + workers
process.env['E2E_PORT'] = String(port)
process.env['E2E_WORKERS'] = String(workers)
process.env['E2E_READY_PORT'] = String(readyPort)

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  workers,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: external ?? `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, defaultBrowserType: 'chromium' },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  ...(external
    ? {}
    : {
        webServer: {
          command: 'node e2e/dev-server.mjs',
          url: `http://127.0.0.1:${readyPort}/ready`,
          reuseExistingServer: !process.env['CI'],
          timeout: 180_000,
        },
      }),
})

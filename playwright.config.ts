import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env['E2E_PORT'] ?? 8787)
const baseURL = process.env['BASE_URL'] ?? `http://localhost:${port}`

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
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
  ...(process.env['BASE_URL']
    ? {}
    : {
        webServer: {
          command: `pnpm build && PORT=${port} PERSIST_DIR=.wrangler/e2e pnpm --filter @neon-cards/worker start`,
          url: `${baseURL}/api/health`,
          reuseExistingServer: !process.env['CI'],
          timeout: 120_000,
        },
      }),
})

import { fileURLToPath } from 'node:url'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: here('./wrangler.toml') },
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations(here('./migrations')), DEV_RIG: '1' },
      },
    })),
  ],
  test: {
    name: 'worker',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/apply-migrations.ts'],
  },
})

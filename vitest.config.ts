import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      'apps/worker',
      {
        test: {
          name: 'unit',
          include: ['packages/**/src/**/*.test.{ts,tsx}', 'apps/web/src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})

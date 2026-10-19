import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import tableFit from './tools/eslint-plugin-table-fit/index.js'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.wrangler/**', '**/node_modules/**', 'test-results/**', 'playwright-report/**', 'docs/reference/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['prototypes/table-fit/**/*.{ts,tsx}'],
    plugins: { 'table-fit': tableFit },
    rules: { 'table-fit/no-hand-tuned-card-size': 'error' },
  },
)

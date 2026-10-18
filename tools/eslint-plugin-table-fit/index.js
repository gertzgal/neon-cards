import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import rule from './no-hand-tuned-card-size.js'

const plugin = {
  meta: { name: 'table-fit', version: '0.0.0' },
  rules: { 'no-hand-tuned-card-size': rule },
}

const config = [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'table-fit': plugin },
    rules: { 'table-fit/no-hand-tuned-card-size': 'error' },
  },
]

/** @param {string} code @param {string} filename */
export function lintSource(code, filename) {
  const linter = new Linter()
  return linter.verify(code, config, { filename })
}

export default plugin

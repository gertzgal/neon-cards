import type { Linter } from 'eslint'

export function lintSource(code: string, filename: string): Linter.LintMessage[]

declare const plugin: {
  meta: { name: string; version: string }
  rules: Record<string, unknown>
}

export default plugin

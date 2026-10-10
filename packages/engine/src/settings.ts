import { ConfigError } from './errors'
import type { SettingSpec } from './types'

/**
 * Parses the choice-list settings a game declares in meta.settings. Missing keys take the default;
 * keys not declared in `settings` are ignored, so a game can parse its own extras next to this.
 */
export function parseSettings<C extends object>(settings: readonly SettingSpec[], defaults: C, input: unknown): C {
  if (input === undefined || input === null) return { ...defaults }
  if (typeof input !== 'object' || Array.isArray(input)) throw new ConfigError('config must be an object')
  const raw = input as Record<string, unknown>
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const { key, options } of settings) {
    if (raw[key] === undefined) continue
    if (!options.some((o) => o.value === raw[key])) {
      throw new ConfigError(`${key} must be one of ${options.map((o) => JSON.stringify(o.value)).join(', ')}`)
    }
    out[key] = raw[key]
  }
  return out as C
}

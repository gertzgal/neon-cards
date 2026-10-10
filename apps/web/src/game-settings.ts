import type { SettingSpec } from '@neon-cards/engine'

type SettingValue = SettingSpec['options'][number]['value']

export type GameSettings = Record<string, SettingValue>

const key = (gameId: string) => `neon-cards:game-settings:${gameId}`

/**
 * One valid option per spec: the stored choice if it is still offered, else the
 * game's default config value if it is offered, else the first option.
 */
export function resolveGameSettings(specs: readonly SettingSpec[], defaults: unknown, stored: unknown): GameSettings {
  const pick = (source: unknown, spec: SettingSpec) => {
    if (typeof source !== 'object' || source === null) return undefined
    const value = (source as Record<string, unknown>)[spec.key]
    return spec.options.find((option) => option.value === value)?.value
  }
  return Object.fromEntries(
    specs.flatMap((spec) => {
      const value = pick(stored, spec) ?? pick(defaults, spec) ?? spec.options[0]?.value
      return value === undefined ? [] : [[spec.key, value]]
    }),
  )
}

export function loadGameSettings(gameId: string, specs: readonly SettingSpec[], defaults: unknown): GameSettings {
  let stored: unknown
  try {
    stored = JSON.parse(localStorage.getItem(key(gameId)) ?? 'null')
  } catch {
    stored = null
  }
  return resolveGameSettings(specs, defaults, stored)
}

export function saveGameSettings(gameId: string, settings: GameSettings) {
  localStorage.setItem(key(gameId), JSON.stringify(settings))
}

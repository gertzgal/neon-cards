import { useSyncExternalStore } from 'react'

export type MotionPreference = 'system' | 'full' | 'reduced'

export interface ShellSettings {
  muted: boolean
  music: boolean
  sfx: boolean
  motion: MotionPreference
}

export const defaultSettings: ShellSettings = { muted: false, music: true, sfx: true, motion: 'system' }

const KEY = 'neon-cards:settings'

export function parseSettings(raw: string | null): ShellSettings {
  if (!raw) return defaultSettings
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof ShellSettings, unknown>>
    return {
      muted: typeof value.muted === 'boolean' ? value.muted : defaultSettings.muted,
      music: typeof value.music === 'boolean' ? value.music : defaultSettings.music,
      sfx: typeof value.sfx === 'boolean' ? value.sfx : defaultSettings.sfx,
      motion:
        value.motion === 'system' || value.motion === 'full' || value.motion === 'reduced'
          ? value.motion
          : defaultSettings.motion,
    }
  } catch {
    return defaultSettings
  }
}

const listeners = new Set<() => void>()
let cached: { raw: string | null; settings: ShellSettings } | null = null

export function readSettings(): ShellSettings {
  const raw = localStorage.getItem(KEY)
  if (cached?.raw !== raw) cached = { raw, settings: parseSettings(raw) }
  return cached.settings
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function updateSettings(patch: Partial<ShellSettings>) {
  localStorage.setItem(KEY, JSON.stringify({ ...readSettings(), ...patch }))
  for (const listener of listeners) listener()
}

export function useSettings(): ShellSettings {
  return useSyncExternalStore(subscribe, readSettings)
}

const reducedQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)')

function subscribeSystemMotion(listener: () => void) {
  const query = reducedQuery()
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** The motion level to render with, after resolving `system` against the OS preference. */
export function useReducedMotion(): boolean {
  const { motion } = useSettings()
  const systemReduced = useSyncExternalStore(subscribeSystemMotion, () => reducedQuery().matches)
  return motion === 'reduced' || (motion === 'system' && systemReduced)
}

export function audioLevels({ muted, music, sfx }: ShellSettings): { music: boolean; sfx: boolean } {
  return { music: !muted && music, sfx: !muted && sfx }
}

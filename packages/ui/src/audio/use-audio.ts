import { useSyncExternalStore } from 'react'
import type { AudioManager, AudioSettings } from '../api'
import { getAudio } from './manager'

/** Live audio settings, re-rendering on `update()`. */
export function useAudioSettings(manager: AudioManager = getAudio()): AudioSettings {
  return useSyncExternalStore(
    (onChange) => manager.subscribe(onChange),
    () => manager.settings,
    () => manager.settings,
  )
}

/** `{on, toggle}` for the HUD sound icon: toggles the master mute. */
export function useSoundToggle(manager: AudioManager = getAudio()): { on: boolean; toggle(): void } {
  const { muted } = useAudioSettings(manager)
  return { on: !muted, toggle: () => manager.update({ muted: !muted }) }
}

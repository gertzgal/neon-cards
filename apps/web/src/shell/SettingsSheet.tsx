import { updateSettings, useSettings, type MotionPreference } from '../settings'
import { Segmented, Toggle } from './Segmented'
import { Sheet } from './Sheet'

const motionOptions: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Calm' },
]

export function SettingsSheet({ onClose, onNewGame }: { onClose(): void; onNewGame?: () => void }) {
  const settings = useSettings()
  return (
    <Sheet testId="settings" title="Settings" onClose={onClose}>
      <Toggle testId="setting-music" label="Music" on={settings.music} onChange={(music) => updateSettings({ music })} />
      <Toggle testId="setting-sfx" label="Effects" on={settings.sfx} onChange={(sfx) => updateSettings({ sfx })} />
      <Segmented
        testId="setting-motion"
        label="Motion"
        value={settings.motion}
        options={motionOptions}
        onChange={(motion) => updateSettings({ motion })}
      />
      {onNewGame && (
        <button type="button" className="btn wide" data-testid="new-game" onClick={onNewGame}>
          New game
        </button>
      )}
    </Sheet>
  )
}

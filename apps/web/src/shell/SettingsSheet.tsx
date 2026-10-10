import { navigate } from '../router'
import { updateSettings, useSettings, type MotionPreference } from '../settings'
import { Segmented, Toggle } from './Segmented'
import { Sheet } from './Sheet'

const motionOptions: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Calm' },
]

/** Shown when the sheet opens over a live table. */
export interface TableControls {
  gameId: string
  newGame(): void
}

export function SettingsSheet({ onClose, table }: { onClose(): void; table?: TableControls }) {
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
      {table && (
        <div className="sheet-actions">
          <button
            type="button"
            className="btn"
            data-testid="table-history"
            onClick={() => navigate({ name: 'history', gameId: table.gameId })}
          >
            History
          </button>
          <button type="button" className="btn" data-testid="table-lobby" onClick={() => navigate({ name: 'home' })}>
            Lobby
          </button>
          <button
            type="button"
            className="btn main"
            data-testid="new-game"
            onClick={() => {
              onClose()
              table.newGame()
            }}
          >
            New game
          </button>
        </div>
      )}
    </Sheet>
  )
}

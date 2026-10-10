import { useState } from 'react'
import { Link } from '../router'
import type { Route } from '../routes'
import { updateSettings, useSettings } from '../settings'
import { BackIcon, GearIcon, HistoryIcon, SoundIcon } from './icons'
import { SettingsSheet } from './SettingsSheet'
import { WalletPill } from './wallet'

export function Hud({
  back,
  history,
  showWallet = true,
  onNewGame,
}: {
  back?: Route
  history?: Route
  showWallet?: boolean
  onNewGame?: () => void
}) {
  const { muted } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="hud">
      <div className="hud-side">
        {back && (
          <Link to={back} className="pill icon" data-testid="nav-back" aria-label="Back">
            <BackIcon />
          </Link>
        )}
        {showWallet && <WalletPill />}
      </div>
      <div className="pill icons">
        {history && (
          <Link to={history} data-testid="nav-history" aria-label="History">
            <HistoryIcon />
          </Link>
        )}
        <button
          type="button"
          data-testid="sound-toggle"
          data-state={muted ? 'muted' : 'on'}
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => updateSettings({ muted: !muted })}
        >
          <SoundIcon muted={muted} />
        </button>
        <button type="button" data-testid="open-settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <GearIcon />
        </button>
      </div>
      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          {...(onNewGame && {
            onNewGame: () => {
              setSettingsOpen(false)
              onNewGame()
            },
          })}
        />
      )}
    </header>
  )
}

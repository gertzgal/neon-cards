import { useState } from 'react'
import { Link } from '../router'
import type { Route } from '../routes'
import { updateSettings, useSettings } from '../settings'
import { BackIcon, GearIcon, HistoryIcon, SoundIcon } from './icons'
import { SettingsSheet, type TableControls } from './SettingsSheet'
import { WalletPill } from './wallet'

/** The sound and settings buttons. Tables render them in their own top bar via `TableProps.hudIcons`. */
export function HudIcons({ table }: { table?: TableControls }) {
  const { muted } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
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
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} {...(table && { table })} />}
    </>
  )
}

export function Hud({ back, history, showWallet = true }: { back?: Route; history?: Route; showWallet?: boolean }) {
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
        <HudIcons />
      </div>
    </header>
  )
}

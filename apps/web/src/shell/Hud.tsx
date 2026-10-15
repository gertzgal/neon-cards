import { useState } from 'react'
import { BackIcon, GearIcon, Hud as KitHud, IconButton, SoundIcon, type GameGuide } from '@neon-cards/ui'
import { useTableGuide } from '../guide-seen'
import { Link } from '../router'
import type { Route } from '../routes'
import { updateSettings, useSettings } from '../settings'
import { GuidePage } from './guide'
import { BookIcon, HistoryIcon } from './icons'
import { SettingsSheet, type TableControls } from './SettingsSheet'
import { useWallet } from './wallet'

/** A table bar can show the how-to-play book. `table` adds the solo new-game controls. */
export interface HudIconsProps {
  readonly table?: TableControls
  readonly guide?: GameGuide
  readonly gameId?: string
}

function BarIcons({ table }: { table?: TableControls }) {
  const { muted } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <IconButton label={muted ? 'Unmute' : 'Mute'} pressed={muted} testId="hud-sound" onClick={() => updateSettings({ muted: !muted })}>
        <SoundIcon on={!muted} />
      </IconButton>
      <IconButton label="Settings" testId="hud-settings" onClick={() => setSettingsOpen(true)}>
        <GearIcon />
      </IconButton>
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} {...(table && { table })} />}
    </>
  )
}

function GuideButton({ guide, gameId, autoOpen }: { guide: GameGuide; gameId: string; autoOpen: boolean }) {
  const guideUi = useTableGuide(gameId, autoOpen)
  return (
    <>
      <IconButton label="How to play" testId="hud-guide" onClick={guideUi.openGuide}>
        <BookIcon />
      </IconButton>
      {guideUi.open && <GuidePage guide={guide} onClose={guideUi.closeGuide} />}
    </>
  )
}

/** The sound and settings buttons, plus the how-to-play book when a guide is passed. */
export function HudIcons({ table, guide, gameId }: HudIconsProps) {
  const id = table?.gameId ?? gameId
  if (guide && id) {
    return (
      <>
        <GuideButton guide={guide} gameId={id} autoOpen />
        <BarIcons {...(table ? { table } : {})} />
      </>
    )
  }
  return <BarIcons {...(table ? { table } : {})} />
}

export function Hud({
  back,
  onBack,
  history,
  showWallet = true,
  guide,
  gameId,
}: {
  back?: Route
  onBack?: () => void
  history?: Route
  showWallet?: boolean
  guide?: GameGuide
  gameId?: string
}) {
  const { wallet } = useWallet()
  return (
    <KitHud
      bankroll={showWallet && wallet.status === 'ok' ? wallet.balance : null}
      left={
        back && (
          <Link
            to={back}
            className="nc-pill nc-icons"
            data-testid="nav-back"
            aria-label="Back"
            onClick={
              onBack
                ? (event) => {
                    event.preventDefault()
                    onBack()
                  }
                : undefined
            }
          >
            <span className="nc-icon-btn">
              <BackIcon />
            </span>
          </Link>
        )
      }
      right={
        <>
          {guide && gameId && <GuideButton guide={guide} gameId={gameId} autoOpen={false} />}
          {history && (
            <Link to={history} className="nc-icon-btn" data-testid="nav-history" aria-label="History">
              <HistoryIcon />
            </Link>
          )}
          <HudIcons />
        </>
      }
    />
  )
}

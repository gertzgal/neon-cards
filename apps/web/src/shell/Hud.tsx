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

/** Table bar has a guide. Lobby bar has neither field. */
export type HudIconsProps =
  | { readonly table?: undefined }
  | { readonly table: TableControls; readonly guide: GameGuide }

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

function TableIcons({ table, guide }: { table: TableControls; guide: GameGuide }) {
  const guideUi = useTableGuide(table.gameId)
  return (
    <>
      <IconButton label="How to play" testId="hud-guide" onClick={guideUi.openGuide}>
        <BookIcon />
      </IconButton>
      <BarIcons table={table} />
      {guideUi.open && <GuidePage guide={guide} onClose={guideUi.closeGuide} />}
    </>
  )
}

/** The sound and settings buttons. Tables render them in their own top bar via `TableProps.hudIcons`. */
export function HudIcons(props: HudIconsProps) {
  if (props.table) return <TableIcons table={props.table} guide={props.guide} />
  return <BarIcons />
}

export function Hud({ back, history, showWallet = true }: { back?: Route; history?: Route; showWallet?: boolean }) {
  const { wallet } = useWallet()
  return (
    <KitHud
      bankroll={showWallet && wallet.status === 'ok' ? wallet.balance : null}
      left={
        back && (
          <Link to={back} className="nc-pill nc-icons" data-testid="nav-back" aria-label="Back">
            <span className="nc-icon-btn">
              <BackIcon />
            </span>
          </Link>
        )
      }
      right={
        <>
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

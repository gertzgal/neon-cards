import { useState } from 'react'
import { loadGameSettings, saveGameSettings, type GameSettings } from './game-settings'
import type { GamePlugin } from '@neon-cards/ui'
import { useGameSession } from './session'
import { Hud, HudIcons } from './shell/Hud'
import { Segmented } from './shell/Segmented'
import { Sheet } from './shell/Sheet'
import { useWallet } from './shell/wallet'

export function GameScreen({ plugin }: { plugin: GamePlugin }) {
  const { definition, meta } = plugin.rules
  const { wallet, setBalance } = useWallet()
  const { state, start, act, reset } = useGameSession(plugin, setBalance)
  const chips = meta.economy === 'chips'

  return (
    <div className="screen game" data-testid="game-screen" data-game={definition.id} data-state={state.status}>
      {state.status !== 'playing' && (
        <Hud back={{ name: 'home' }} history={{ name: 'history', gameId: definition.id }} showWallet={chips} />
      )}
      {state.status === 'loading' && (
        <p className="center-msg" data-testid="game-loading">
          Shuffling…
        </p>
      )}
      {state.status === 'setup' && <PreGameSheet plugin={plugin} onPlay={start} />}
      {state.status === 'error' && (
        <div className="center-msg" data-testid="game-error">
          <p>Couldn't reach the table.</p>
          <p className="dim">{state.message}</p>
          <button type="button" className="btn main" data-testid="game-retry" onClick={reset}>
            Try again
          </button>
        </div>
      )}
      {state.status === 'playing' && (
        <plugin.Table
          seats={state.seats}
          humanSeat={state.humanSeat}
          view={state.view}
          events={state.events}
          wallet={chips && wallet.status === 'ok' ? wallet.balance : null}
          busy={state.busy}
          act={act}
          hudIcons={<HudIcons key={definition.id} table={{ gameId: definition.id, newGame: reset }} guide={plugin.guide} />}
        />
      )}
    </div>
  )
}

function PreGameSheet({ plugin, onPlay }: { plugin: GamePlugin; onPlay(config: GameSettings): void }) {
  const { definition, meta } = plugin.rules
  const specs = meta.settings ?? []
  const [settings, setSettings] = useState(() => loadGameSettings(definition.id, specs, definition.defaultConfig))

  return (
    <Sheet testId="pregame" title={meta.title}>
      <p className="sheet-desc">{meta.description}</p>
      {specs.map((spec) => (
        <Segmented
          key={spec.key}
          testId={`pregame-${spec.key}`}
          label={spec.label}
          value={settings[spec.key] ?? ''}
          options={spec.options}
          onChange={(value) => setSettings({ ...settings, [spec.key]: value })}
        />
      ))}
      <button
        type="button"
        className="btn main wide"
        data-testid="pregame-play"
        onClick={() => {
          saveGameSettings(definition.id, settings)
          onPlay(settings)
        }}
      >
        Play
      </button>
    </Sheet>
  )
}

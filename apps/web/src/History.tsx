import { useEffect, useState } from 'react'
import { api, type Round } from './api'
import { findGame, games } from './games'
import { Link } from './router'
import { Hud } from './shell/Hud'
import { formatChips } from './shell/wallet'

type Rounds = { status: 'loading' } | { status: 'ok'; rounds: Round[] } | { status: 'error'; message: string }

export function History({ gameId }: { gameId: string | null }) {
  const [rounds, setRounds] = useState<Rounds>({ status: 'loading' })

  useEffect(() => {
    let live = true
    api.history(gameId).then(
      (res) => live && setRounds({ status: 'ok', rounds: res.rounds }),
      (err: unknown) => live && setRounds({ status: 'error', message: String(err) }),
    )
    return () => {
      live = false
      setRounds({ status: 'loading' })
    }
  }, [gameId])

  return (
    <div className="screen history">
      <Hud back={gameId ? { name: 'game', gameId } : { name: 'home' }} />
      <main className="panel">
        <h1>History</h1>
        <nav className="segmented tabs" aria-label="Filter by game">
          <Link to={{ name: 'history', gameId: null }} className={gameId ? 'seg' : 'seg on'} data-testid="history-all">
            All
          </Link>
          {games.map(({ rules: { definition, meta } }) => (
            <Link
              key={definition.id}
              to={{ name: 'history', gameId: definition.id }}
              className={gameId === definition.id ? 'seg on' : 'seg'}
              data-testid={`history-filter-${definition.id}`}
            >
              {meta.title}
            </Link>
          ))}
        </nav>
        <div data-testid="history-list" data-state={rounds.status}>
          {rounds.status === 'loading' && <p className="dim">Loading…</p>}
          {rounds.status === 'error' && <p className="dim">Couldn't load history.</p>}
          {rounds.status === 'ok' && rounds.rounds.length === 0 && (
            <p className="dim" data-testid="history-empty">
              No rounds yet. Go play one.
            </p>
          )}
          {rounds.status === 'ok' && rounds.rounds.length > 0 && (
            <ol className="rounds">
              {rounds.rounds.map((round) => (
                <RoundRow key={round.id} round={round} />
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  )
}

function RoundRow({ round }: { round: Round }) {
  const meta = findGame(round.gameId)?.rules.meta
  const chips = meta?.economy === 'chips'
  const tone = round.net > 0 ? 'win' : round.net < 0 ? 'loss' : 'even'
  return (
    <li className="round" data-testid="history-round" data-game={round.gameId}>
      <span className="round-game">{meta?.title ?? round.gameId}</span>
      <span className="round-when dim">{new Date(round.createdAt).toLocaleString()}</span>
      <span className={`round-net ${tone}`} data-testid="history-net">
        {chips ? `${round.net > 0 ? '+' : round.net < 0 ? '-' : ''}${formatChips(Math.abs(round.net))}` : `Round ${round.roundNo}`}
      </span>
    </li>
  )
}

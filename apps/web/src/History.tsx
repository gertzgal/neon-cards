import { useEffect, useState } from 'react'
import { formatMoney, toneColor, type RoundSummary } from '@neon-cards/ui'
import { api, type Round } from './api'
import { findGame, games } from './games'
import { Link } from './router'
import { Hud } from './shell/Hud'
import { ago } from './when'

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

  const mixed = rounds.status === 'ok' && new Set(rounds.rounds.map((r) => r.gameId)).size > 1

  return (
    <div className="screen history">
      <Hud back={gameId ? { name: 'game', gameId } : { name: 'home' }} />
      <main className="panel">
        <h1>History</h1>
        {games.length > 1 && (
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
        )}
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
                <RoundRow key={round.id} round={round} named={mixed} />
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  )
}

/** `named` shows the game's title, only when the list mixes games. */
function RoundRow({ round, named }: { round: Round; named: boolean }) {
  const game = findGame(round.gameId)
  const meta = game?.rules.meta
  const recap = game?.recap?.(round.summary as RoundSummary) ?? null
  const chips = meta?.economy === 'chips'
  const tone = round.net > 0 ? 'win' : round.net < 0 ? 'loss' : 'even'
  return (
    <li className="round" data-testid="history-round" data-game={round.gameId}>
      <span className="round-what">
        {named && <span className="round-game">{meta?.title ?? round.gameId}</span>}
        {recap && (
          <span className={`round-outcome ${tone}`} style={recap.tone && { color: toneColor[recap.tone] }} data-testid="history-outcome">
            {recap.outcome}
          </span>
        )}
      </span>
      <span className={`round-net ${tone}`} data-testid="history-net">
        {chips ? `${round.net > 0 ? '+' : ''}${formatMoney(round.net)}` : `Round ${round.roundNo}`}
      </span>
      {recap?.hands && game && (
        <span className="round-hands" data-testid="history-hands">
          {recap.hands.map((hand, i) => (
            <span className="round-hand" key={i}>
              {hand.map((card) =>
                card.face === null ? null : (
                  <span key={card.id} style={{ color: toneColor[game.faceRenderer.tone(card.face)] }}>
                    {game.faceRenderer.label(card.face)}
                  </span>
                ),
              )}
            </span>
          ))}
        </span>
      )}
      <time className="round-when dim" dateTime={new Date(round.createdAt).toISOString()} title={new Date(round.createdAt).toLocaleString()}>
        {ago(round.createdAt)}
      </time>
    </li>
  )
}

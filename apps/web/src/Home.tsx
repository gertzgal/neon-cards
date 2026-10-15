import { useState, type FormEvent } from 'react'
import { api } from './api'
import { games } from './games'
import { Link, navigate } from './router'
import { Hud } from './shell/Hud'

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

export function Home() {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const playWithFriends = () => {
    setPending(true)
    setError('')
    void api.createRoom('flip7').then(
      (created) => {
        const search = window.location.search
        window.history.pushState(null, '', `/r/${created.code}${search}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      },
      (err: unknown) => {
        setPending(false)
        setError(err instanceof Error ? err.message : 'Could not open a room')
      },
    )
  }

  const join = (event: FormEvent) => {
    event.preventDefault()
    const next = code.trim().toUpperCase()
    if (!CODE.test(next)) {
      setError('Enter the 4-character code')
      return
    }
    navigate({ name: 'room', code: next })
  }

  return (
    <div className="screen home">
      <Hud history={{ name: 'history', gameId: null }} />
      <main className="lobby">
        <h1 className="logo" data-testid="app-title">
          Neon Cards
        </h1>
        <ul className="game-list" data-testid="game-list">
          {games.map(({ rules: { definition, meta } }) => (
            <li key={definition.id}>
              <Link to={{ name: 'game', gameId: definition.id }} className="game-tile" data-testid={`game-${definition.id}`}>
                <span className="game-title">{meta.title}</span>
              </Link>
            </li>
          ))}
        </ul>
        {games.length === 0 && (
          <p className="dim" data-testid="game-list-empty">
            The tables are being set up. Check back soon.
          </p>
        )}
        <section className="friends">
          <button type="button" className="btn main wide" data-testid="play-with-friends" disabled={pending} onClick={playWithFriends}>
            Play with friends
          </button>
          <form className="room-join" onSubmit={join}>
            <input
              data-testid="room-code-input"
              aria-label="Room code"
              maxLength={4}
              value={code}
              autoCapitalize="characters"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <button type="submit" className="btn" data-testid="room-join">
              Join
            </button>
          </form>
          {error && (
            <p className="dim" data-testid="friends-error">
              {error}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

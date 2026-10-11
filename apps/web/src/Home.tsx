import { games } from './games'
import { Link } from './router'
import { Hud } from './shell/Hud'

export function Home() {
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
      </main>
    </div>
  )
}

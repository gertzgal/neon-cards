import { Link } from './router'
import { Hud } from './shell/Hud'

export function NotFound({ what }: { what: string }) {
  return (
    <div className="screen">
      <Hud back={{ name: 'home' }} />
      <main className="center-msg" data-testid="not-found">
        <h1>Nothing here</h1>
        <p>{what}</p>
        <Link to={{ name: 'home' }} className="btn main" data-testid="go-home">
          Lobby
        </Link>
      </main>
    </div>
  )
}

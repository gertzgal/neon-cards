import { useEffect } from 'react'
import { GameScreen } from './GameScreen'
import { findGame } from './games'
import { History } from './History'
import { Home } from './Home'
import { NotFound } from './NotFound'
import { useRoute } from './router'
import type { Route } from './routes'
import { useReducedMotion } from './settings'
import { WalletProvider } from './shell/wallet'

export function App() {
  const route = useRoute()
  const reduced = useReducedMotion()
  useEffect(() => {
    document.documentElement.dataset['motion'] = reduced ? 'reduced' : 'full'
  }, [reduced])

  return (
    <WalletProvider>
      <Screen route={route} />
    </WalletProvider>
  )
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />
    case 'history':
      return <History gameId={route.gameId} />
    case 'game': {
      const plugin = findGame(route.gameId)
      return plugin ? <GameScreen key={route.gameId} plugin={plugin} /> : <NotFound what={`No game called "${route.gameId}".`} />
    }
    case 'notFound':
      return <NotFound what={`${route.path} is not a page.`} />
  }
}

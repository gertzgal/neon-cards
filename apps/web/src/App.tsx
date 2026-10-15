import { useEffect } from 'react'
import { getAudio, NeonRoot } from '@neon-cards/ui'
import { GameScreen } from './GameScreen'
import { findGame } from './games'
import { History } from './History'
import { Home } from './Home'
import { NotFound } from './NotFound'
import { RoomScreen } from './RoomScreen'
import { useRoute } from './router'
import type { Route } from './routes'
import { useReducedMotion, useSettings } from './settings'
import { WalletProvider } from './shell/wallet'

export function App() {
  const route = useRoute()
  const settings = useSettings()
  const reduced = useReducedMotion()
  useEffect(() => {
    document.documentElement.dataset['motion'] = reduced ? 'reduced' : 'full'
  }, [reduced])
  useEffect(() => {
    getAudio().update({ muted: settings.muted, music: settings.music, sfx: settings.sfx })
  }, [settings.muted, settings.music, settings.sfx])
  useEffect(() => {
    getAudio().startMusic()
    return () => getAudio().stopMusic()
  }, [])

  return (
    <NeonRoot swirl={reduced ? 'static' : 'auto'}>
      <WalletProvider>
        <Screen route={route} />
      </WalletProvider>
    </NeonRoot>
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
    case 'room':
      return <RoomScreen key={route.code} code={route.code} />
    case 'notFound':
      return <NotFound what={`${route.path} is not a page.`} />
  }
}

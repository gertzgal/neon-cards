import { useEffect } from 'react'
import { getAudio, NeonRoot } from '@neon-cards/ui'
import { GameScreen } from './GameScreen'
import { findGame } from './games'
import { History } from './History'
import { Home } from './Home'
import { NotFound } from './NotFound'
import { useRoute } from './router'
import type { Route } from './routes'
import { audioLevels, useReducedMotion, useSettings } from './settings'
import { WalletProvider } from './shell/wallet'

export function App() {
  const route = useRoute()
  const reduced = useReducedMotion()
  useEffect(() => {
    document.documentElement.dataset['motion'] = reduced ? 'reduced' : 'full'
  }, [reduced])
  useAudioSync()

  return (
    <NeonRoot swirl={reduced ? 'static' : 'auto'}>
      <WalletProvider>
        <Screen route={route} />
      </WalletProvider>
    </NeonRoot>
  )
}

/** The shell owns the persisted audio settings; the UI kit's shared manager plays them. Music waits for the first gesture. */
function useAudioSync() {
  const settings = useSettings()
  useEffect(() => {
    const { music, sfx } = audioLevels(settings)
    getAudio().update({ muted: settings.muted, music, sfx })
  }, [settings])
  useEffect(() => {
    getAudio().startMusic()
    return () => getAudio().stopMusic()
  }, [])
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

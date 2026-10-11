import { createRoot } from 'react-dom/client'
import { getAudio, NeonRoot, SoundIcon, useSoundToggle, IconButton } from '@neon-cards/ui'
import { BlackjackTable, useLocalSession } from '../src/view'

const params = new URLSearchParams(location.search)
const config = { ...(params.get('rig') ? { rig: params.get('rig') } : {}), bankroll: Number(params.get('bankroll') ?? 1250) }
const seed = Number(params.get('seed') ?? Date.now())
if (params.has('mute')) getAudio().update({ muted: true })

function App() {
  const session = useLocalSession(config, seed)
  const sound = useSoundToggle()
  const icons = (
    <IconButton label={sound.on ? 'Mute' : 'Unmute'} pressed={!sound.on} onClick={sound.toggle}>
      <SoundIcon on={sound.on} />
    </IconButton>
  )
  return (
    <NeonRoot>
      <BlackjackTable {...session} hudIcons={icons} />
    </NeonRoot>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)

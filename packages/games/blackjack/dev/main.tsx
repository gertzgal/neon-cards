import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BlackjackTable, createSfx, useLocalSession } from '../src/view'
import { Backdrop } from './Backdrop'

const params = new URLSearchParams(location.search)
let muted = params.has('mute')
const sfx = createSfx(() => muted)
const config = { ...(params.get('rig') ? { rig: params.get('rig') } : {}), bankroll: Number(params.get('bankroll') ?? 1250) }
const seed = Number(params.get('seed') ?? Date.now())

function App() {
  const session = useLocalSession(config, seed)
  const [isMuted, setMuted] = useState(muted)
  const icons = (
    <button
      aria-label={isMuted ? 'Unmute' : 'Mute'}
      onClick={() => {
        muted = !muted
        setMuted(muted)
      }}
    >
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 6h3l4-3h1v10H9L5 10H2z" />
        {!isMuted && <path d="M11 6h1v4h-1zM13 4h1v8h-1zM12 5h1v1h-1zM12 10h1v1h-1z" />}
      </svg>
    </button>
  )
  return (
    <>
      <Backdrop />
      <BlackjackTable {...session} sfx={sfx} hudIcons={icons} />
    </>
  )
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<App />)

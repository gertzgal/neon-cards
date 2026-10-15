import { useCallback, useMemo, useState } from 'react'
import type { GuideClose, TableGuide } from '@neon-cards/ui'

const seenKey = (gameId: string) => `neon-cards:guide-seen:${gameId}`

function readSeen(gameId: string): boolean {
  try {
    return localStorage.getItem(seenKey(gameId)) === '1'
  } catch {
    return false
  }
}

function writeSeen(gameId: string) {
  localStorage.setItem(seenKey(gameId), '1')
}

/** First visit opens the page. Closing writes the seen key. Opening again does not clear it. */
export function useTableGuide(gameId: string): TableGuide {
  const [open, setOpen] = useState(() => !readSeen(gameId))
  const openGuide = useCallback(() => setOpen(true), [])
  const closeGuide = useMemo(() => {
    const close = () => {
      writeSeen(gameId)
      setOpen(false)
    }
    return close as GuideClose
  }, [gameId])
  return { open, openGuide, closeGuide }
}

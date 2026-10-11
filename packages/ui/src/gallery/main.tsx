import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index'
import './gallery.css'
import { Gallery } from './gallery'

export const scenes = ['table', 'betting', 'opponents', 'sheet', 'juice'] as const

/** Dev gallery: /ui-gallery.html?scene=table|betting|opponents|sheet[&n=1..3]. */
export function mountGallery(el: HTMLElement) {
  const params = new URLSearchParams(window.location.search)
  const asked = params.get('scene') ?? 'table'
  const scene = (scenes as readonly string[]).includes(asked) ? asked : 'table'
  const count = Math.min(3, Math.max(1, Number(params.get('n') ?? 3) || 3))
  createRoot(el).render(
    <StrictMode>
      <Gallery scene={scene} count={count} />
    </StrictMode>,
  )
}

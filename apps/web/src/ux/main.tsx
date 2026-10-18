import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sceneFrom, scenes } from './scenes'
import { UxPreview } from './preview'
import './preview.css'
import '../styles.css'

document.documentElement.dataset['scenes'] = scenes.join(' ')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from ux-preview.html')

createRoot(root).render(
  <StrictMode>
    <UxPreview scene={sceneFrom(window.location.search)} />
  </StrictMode>,
)

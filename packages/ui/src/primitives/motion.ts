import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'

/** The shell's motion setting on `<html data-motion="full|reduced">` wins; without it, follow the OS. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const setting = document.documentElement.dataset['motion']
  if (setting === 'reduced') return true
  if (setting === 'full') return false
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  mql?.addEventListener('change', onChange)
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mql?.removeEventListener('change', onChange)
    observer.disconnect()
  }
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}

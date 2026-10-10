import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { hrefFor, parseRoute, type Route } from './routes'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const location = () => window.location.pathname + window.location.search

export function navigate(route: Route, { replace = false } = {}) {
  const href = hrefFor(route)
  if (href === location()) return
  if (replace) window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
  for (const listener of listeners) listener()
}

export function useRoute(): Route {
  const href = useSyncExternalStore(subscribe, location)
  const url = new URL(href, window.location.origin)
  return parseRoute(url.pathname, url.search)
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: Route }

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={hrefFor(to)} onClick={handle} {...rest} />
}

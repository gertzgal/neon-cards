const pixel = { viewBox: '0 0 16 16', fill: 'currentColor', shapeRendering: 'crispEdges', 'aria-hidden': true } as const

export function BookIcon() {
  return (
    <svg viewBox="0 0 18 16" shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="2" width="7" height="11" fill="#2ef2ff" />
      <rect x="10" y="2" width="7" height="11" fill="#2ef2ff" />
      <rect x="8" y="3" width="2" height="11" fill="#ff2e88" />
      <rect x="0" y="13" width="18" height="2" fill="#ff2e88" />
      <rect x="2" y="4" width="5" height="1" fill="#050409" />
      <rect x="2" y="6" width="4" height="1" fill="#050409" />
      <rect x="2" y="8" width="5" height="1" fill="#050409" />
      <rect x="11" y="4" width="5" height="1" fill="#050409" />
      <rect x="11" y="6" width="5" height="1" fill="#050409" />
      <rect x="12" y="8" width="4" height="1" fill="#050409" />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg {...pixel}>
      <path d="M2 2h12v2H2zM2 7h12v2H2zM2 12h8v2H2z" />
    </svg>
  )
}

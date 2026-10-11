const pixel = { viewBox: '0 0 16 16', fill: 'currentColor', shapeRendering: 'crispEdges', 'aria-hidden': true } as const

export function HistoryIcon() {
  return (
    <svg {...pixel}>
      <path d="M2 2h12v2H2zM2 7h12v2H2zM2 12h8v2H2z" />
    </svg>
  )
}

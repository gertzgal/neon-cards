const pixel = { viewBox: '0 0 16 16', fill: 'currentColor', shapeRendering: 'crispEdges', 'aria-hidden': true } as const

export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg {...pixel}>
      <path d="M2 6h3l4-3h1v10H9L5 10H2z" />
      {muted ? (
        <path d="M11 5h1v1h-1zM12 6h1v1h-1zM13 7h1v2h-1zM14 5h1v1h-1zM11 10h1v1h-1zM12 9h1v1h-1zM14 10h1v1h-1zM13 6h1v1h-1zM13 9h1v1h-1z" />
      ) : (
        <path d="M11 6h1v4h-1zM13 4h1v8h-1zM12 5h1v1h-1zM12 10h1v1h-1z" />
      )}
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg {...pixel}>
      <path
        fillRule="evenodd"
        d="M7 1h2v2h2v-1h1v1h1v1h-1v2h2v1h1v2h-1v1h-2v2h1v1h-1v1h-1v-1h-2v2H7v-2H5v1H4v-1H3v-1h1v-2H2v-1H1V7h1V6h2V4H3V3h1V2h1v1h2zM7 6v1H6v2h1v1h2V9h1V7H9V6z"
      />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg {...pixel}>
      <path d="M6 3h2v2H6zM4 5h2v2H4zM2 7h12v2H2zM4 9h2v2H4zM6 11h2v2H6z" />
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

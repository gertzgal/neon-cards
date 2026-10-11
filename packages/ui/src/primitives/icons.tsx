// 16x16 (and 8x8) pixel icons from the prototype, drawn with crisp edges in currentColor.

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      <path d="M2 6h3l4-3h1v10H9L5 10H2z" />
      {on ? (
        <g>
          <rect x="11" y="6" width="1" height="4" />
          <rect x="13" y="4" width="1" height="8" />
          <rect x="12" y="5" width="1" height="1" />
          <rect x="12" y="10" width="1" height="1" />
        </g>
      ) : (
        <g>
          <rect x="11" y="5" width="1" height="1" />
          <rect x="12" y="6" width="1" height="1" />
          <rect x="13" y="7" width="1" height="2" />
          <rect x="14" y="5" width="1" height="1" />
          <rect x="11" y="10" width="1" height="1" />
          <rect x="12" y="9" width="1" height="1" />
          <rect x="14" y="10" width="1" height="1" />
          <rect x="13" y="6" width="1" height="1" />
          <rect x="13" y="9" width="1" height="1" />
        </g>
      )}
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      <path
        fillRule="evenodd"
        d="M7 1h2v2h2v-1h1v1h1v1h-1v2h2v1h1v2h-1v1h-2v2h1v1h-1v1h-1v-1h-2v2H7v-2H5v1H4v-1H3v-1h1v-2H2v-1H1V7h1V6h2V4H3V3h1V2h1v1h2zM7 6v1H6v2h1v1h2V9h1V7H9V6z"
      />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg className="nc-icon-close" viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      <path d="M0 0h2v1h1v1h2V1h1V0h2v2H7v1H6v2h1v1h1v2H6V7H5V6H3v1H2v1H0V6h1V5h1V3H1V2H0z" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      <path d="M4 0h2v2H5v1H4v2h1v1h1v2H4V7H3V6H2V5H1V3h1V2h1V1h1z" />
    </svg>
  )
}

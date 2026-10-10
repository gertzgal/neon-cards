import type { BlackjackFace, Suit } from '../rules'

const BITMAPS: Record<Suit | 'crown', string[]> = {
  H: ['..XX...XX..', '.XXXX.XXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'],
  D: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'],
  S: ['.....X.....', '....XXX....', '...XXXXX...', '..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XX..X..XX.', '.....X.....', '....XXX....', '...XXXXX...'],
  C: ['....XXX....', '...XXXXX...', '...XXXXX...', '....XXX....', '.XX..X..XX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XX..X..XX.', '.....X.....', '....XXX....', '...XXXXX...'],
  crown: ['X..X..X', 'XXXXXXX', 'XXXXXXX'],
}

function rects(bitmap: string[]): string {
  let d = ''
  bitmap.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') d += `M${x} ${y}h1v1h-1z`
  })
  return d
}

const PATHS = Object.fromEntries(Object.entries(BITMAPS).map(([k, b]) => [k, rects(b)])) as Record<Suit | 'crown', string>

export function PixelSprite({ name, className }: { name: Suit | 'crown'; className?: string }) {
  const b = BITMAPS[name]
  return (
    <svg className={className} viewBox={`0 0 ${b[0]?.length ?? 0} ${b.length}`} shapeRendering="crispEdges" aria-hidden>
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  )
}

export const suitTone = (suit: Suit): 'pink' | 'cyan' => (suit === 'H' || suit === 'D' ? 'pink' : 'cyan')

const SUIT_NAME: Record<Suit, string> = { H: 'hearts', D: 'diamonds', S: 'spades', C: 'clubs' }

export const faceLabel = (face: BlackjackFace) => `${face.rank} of ${SUIT_NAME[face.suit]}`

/** Draws a face inside the shared card frame: oversized corner ranks, a center pip, a crown on court cards. */
export function BlackjackFaceArt({ face }: { face: BlackjackFace }) {
  const court = face.rank === 'J' || face.rank === 'Q' || face.rank === 'K'
  return (
    <div className="bj-face" data-tone={suitTone(face.suit)}>
      <span className="bj-rank bj-rank-tl">{face.rank}</span>
      <span className="bj-rank bj-rank-br">{face.rank}</span>
      {court && <PixelSprite name="crown" className="bj-crown" />}
      <PixelSprite name={face.suit} className="bj-pip" />
    </div>
  )
}

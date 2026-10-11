import { PixelSprite, type Bitmap } from '@neon-cards/ui'

// The table carries no words besides FLIP 7! and BUST, so every control is a pixel glyph.
const plus: Bitmap = ['...XX...', '...XX...', '...XX...', 'XXXXXXXX', 'XXXXXXXX', '...XX...', '...XX...', '...XX...']
const palm: Bitmap = ['..X.X.X..', '..X.X.X.X', 'X.X.X.X.X', 'X.X.X.X.X', 'XXXXXXXXX', '.XXXXXXXX', '.XXXXXXX.', '..XXXXX..']
const play: Bitmap = ['XX......', 'XXXX....', 'XXXXXX..', 'XXXXXXXX', 'XXXXXX..', 'XXXX....', 'XX......']
export const crown: Bitmap = ['X..X..X', 'XX.X.XX', 'XXXXXXX', 'XXXXXXX']

export const HitIcon = () => <PixelSprite bitmap={plus} color="currentColor" scale={3} glow={false} />
export const StayIcon = () => <PixelSprite bitmap={palm} color="currentColor" scale={3} glow={false} />
export const NextIcon = () => <PixelSprite bitmap={play} color="currentColor" scale={3} glow={false} />

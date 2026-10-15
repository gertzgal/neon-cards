import { PixelSprite, type Bitmap } from '@neon-cards/ui'

const draw: Bitmap = ['XXXXXXXX', 'X......X', 'X..XX..X', 'X..XX..X', 'X......X', 'XXXXXXXX', '........', '...XX...', '..XXXX..', '.XX..XX.']
const nope: Bitmap = ['XX....XX', '.XX..XX.', '..XXXX..', '...XX...', '..XXXX..', '.XX..XX.', 'XX....XX']
const pass: Bitmap = ['........', '........', 'XXXXXXXX', 'XXXXXXXX', '........', '........']

export const crown: Bitmap = ['X..X..X', 'XX.X.XX', 'XXXXXXX', 'XXXXXXX']

export const DrawIcon = () => <PixelSprite bitmap={draw} color="currentColor" scale={3} glow={false} />
export const NopeIcon = () => <PixelSprite bitmap={nope} color="currentColor" scale={3} glow={false} />
export const PassIcon = () => <PixelSprite bitmap={pass} color="currentColor" scale={3} glow={false} />

import type { Policies } from '@neon-cards/engine'
import type { Flip7Action, Flip7View } from '../types'
import { easy } from './easy'
import { hard } from './hard'
import { medium } from './medium'

export { easy, easyThreshold } from './easy'
export { hard } from './hard'
export { medium } from './medium'
export { drawPile, flipWithin, hitValue, lineState, pBust, pBustWithin, pFlip7Within, visiblePile } from './counting'

export const policies: Policies<Flip7View, Flip7Action> = { easy, medium, hard }

import type { EkPolicies } from '../types'
import { easy } from './easy'
import { hard } from './hard'
import { medium } from './medium'

export const policies: EkPolicies = { easy, medium, hard }

export { HARD_P, pTop, unseen } from './count'
export { EASY_DRAW_WEIGHT } from './easy'
export { easy, hard, medium }

/** Phone opening cards stay at the post-#86 fit: 80% of the shared hand. */
export const FLIP7_PHONE_SCALE = 0.8

/** Desktop opening cards are 70% of that post-#86 size. */
export const FLIP7_DESKTOP_SCALE = 0.56

/** Side inset of the player row. Matches the padding on `.f7-me .nc-player`. */
export const FLIP7_HAND_PAD = 10

/** Space between number cards, in px. */
export const FLIP7_CARD_GAP = 12

export function flip7OpenScale(phone: boolean): number {
  return phone ? FLIP7_PHONE_SCALE : FLIP7_DESKTOP_SCALE
}

/**
 * Width the number row may use. The score sits above the row, so it does not spend any of this width.
 * `paddingX` is the left and right padding added together.
 */
export function flip7HandRoom(playerWidth: number, paddingX: number): number {
  return Math.max(72, Math.floor(playerWidth - paddingX))
}

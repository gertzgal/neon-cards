/** Opening Flip 7 cards are a bit smaller than the shared hand size. */
export const FLIP7_OPEN_SCALE = 0.8

/** Side inset of the player row. Matches the padding on `.f7-me .nc-player`. */
export const FLIP7_HAND_PAD = 10

/** Space between the number row and the score badge. Matches that row's gap. */
export const FLIP7_HAND_GAP = 12

/**
 * Width the number row may use so the score badge stays inside the player row.
 * `paddingX` is the left and right padding added together.
 */
export function flip7HandRoom(playerWidth: number, paddingX: number, gap: number, badgeWidth: number): number {
  return Math.max(72, Math.floor(playerWidth - paddingX - gap - badgeWidth))
}

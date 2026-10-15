/**
 * Scroll offset that puts a card inside a horizontal strip.
 * `cardX` is the card's left edge in the strip's content. `current` is left alone when the card already fits.
 */
export function scrollToCard(cardX: number, cardW: number, viewW: number, current: number): number {
  if (viewW <= 0 || cardW <= 0) return current
  const cardRight = cardX + cardW
  if (cardX >= current - 0.5 && cardRight <= current + viewW + 0.5) return current
  const inset = Math.max(0, Math.min(12, (viewW - cardW) / 2))
  return Math.max(0, cardX - inset)
}

const WINDOW_MS = 60_000
const LIMIT = 10

/** Ten failed joins per minute. A rejected attempt is recorded. An allowed one is not a failure. */
export function noteFailedJoin(stamps: readonly number[], now: number): { limited: boolean; stamps: number[] } {
  const recent = stamps.filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) return { limited: true, stamps: recent }
  return { limited: false, stamps: [...recent, now] }
}

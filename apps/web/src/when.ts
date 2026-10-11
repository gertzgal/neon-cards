const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "now", "5m", "3h", "2d", then a short date ("Oct 9"). */
export function ago(at: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE) return 'now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

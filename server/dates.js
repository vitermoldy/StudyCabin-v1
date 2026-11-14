/** Day helpers for the stats. Days are the local dates the browser reported, as YYYY-MM-DD. */

/** The last `days` local dates up to `today`, oldest first, for a per-day chart with no gaps. */
export function dayRange(today, days) {
  const [y, m, d] = today.split('-').map(Number)
  const end = Date.UTC(y, m - 1, d)
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

/** Consecutive days with at least one event, counting back from today (or yesterday, if today has none yet). */
export function streak(activeDays, today) {
  const set = new Set(activeDays)
  const [y, m, d] = today.split('-').map(Number)
  let t = Date.UTC(y, m - 1, d)
  if (!set.has(today)) t -= 86_400_000
  let n = 0
  while (set.has(new Date(t).toISOString().slice(0, 10))) {
    n++
    t -= 86_400_000
  }
  return n
}

import { dayRange, streak } from './dates.js'

/**
 * What this app keeps in MySQL: every focus session that ran to the end (its
 * minutes and its timer preset), and a copy of the browser save.
 */
export default {
  name: 'StudyCabin v1',
  database: 'studycabin_v1',
  port: 8794,
  maxSaveBytes: 256 * 1024,
  events: {
    /** A focus phase that reached zero. */
    focus(data) {
      const minutes = Number(data?.minutes)
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return null
      const preset = typeof data?.preset === 'string' ? data.preset.slice(0, 16) : undefined
      return { minutes: Math.round(minutes * 10) / 10, ...(preset ? { preset } : {}) }
    },
  },
  async stats(pool, device, { days, today }) {
    const range = dayRange(today, days)
    const [[total]] = await pool.query(
      "SELECT COUNT(*) AS sessions, COALESCE(SUM(JSON_EXTRACT(data, '$.minutes')), 0) AS minutes FROM events WHERE device_id = ? AND kind = 'focus'",
      [device],
    )
    const [rows] = await pool.query(
      "SELECT day, COUNT(*) AS sessions, SUM(JSON_EXTRACT(data, '$.minutes')) AS minutes FROM events WHERE device_id = ? AND kind = 'focus' AND day >= ? GROUP BY day",
      [device, range[0]],
    )
    const [active] = await pool.query("SELECT DISTINCT day FROM events WHERE device_id = ? AND kind = 'focus' ORDER BY day DESC LIMIT 400", [device])
    const byDay = new Map(rows.map((r) => [r.day, r]))
    const perDay = range.map((day) => ({ day, sessions: Number(byDay.get(day)?.sessions ?? 0), minutes: Math.round(Number(byDay.get(day)?.minutes ?? 0)) }))
    return {
      sessions: Number(total.sessions),
      minutes: Math.round(Number(total.minutes)),
      today: perDay[perDay.length - 1]?.minutes ?? 0,
      streak: streak(active.map((r) => r.day), today),
      perDay,
    }
  },
}

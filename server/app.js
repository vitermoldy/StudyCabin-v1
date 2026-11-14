import express from 'express'
import project from './project.js'

/**
 * The API, the same in every app:
 *   PUT  /api/save            { device, data }  mirror the browser save
 *   GET  /api/save/:device                      the save, to restore it in another browser
 *   POST /api/events          { device, events } record what happened
 *   GET  /api/stats/:device                     the app's own summary of those events
 *   GET  /api/health
 * There are no accounts: a device is its 12-character recovery code. Anyone who
 * knows a code can read and replace that save, so the code is shown only to its owner.
 */

const CODE = /^[A-HJ-NP-Z2-9]{12}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const YEAR = 365 * 24 * 3600 * 1000

/** Writes come as JSON from this site only: no form posts, no other origin. */
function sameOriginWrites(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  if (!req.is('application/json')) return res.status(415).json({ error: 'Send the data as JSON.' })
  const origin = req.headers.origin
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Unknown request origin.' })
  next()
}

/** At most `limit` writes per minute per address, enough for a busy tab and not for a script. */
function rateLimit(limit) {
  const hits = new Map()
  return (req, res, next) => {
    if (req.method === 'GET') return next()
    const now = Date.now()
    const key = req.ip ?? 'unknown'
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    if (recent.length > limit) return res.status(429).json({ error: 'Too many requests. Try again in a moment.' })
    next()
  }
}

/** The pool appears once MySQL answers; until then the API says so instead of hanging. */
export function createApi(getPool) {
  const api = express.Router()
  api.use(express.json({ limit: project.maxSaveBytes + 64 * 1024 }))
  api.use(sameOriginWrites)
  api.use(rateLimit(120))
  api.use((req, res, next) => (getPool() ? next() : res.status(503).json({ error: 'The database is not connected yet.' })))

  const touch = (device) => getPool().query('INSERT INTO devices (id) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP', [device])

  api.get('/health', (_req, res) => res.json({ ok: true, app: project.name }))

  api.put('/save', async (req, res) => {
    const { device, data } = req.body ?? {}
    if (!CODE.test(device ?? '')) return res.status(400).json({ error: 'Unknown device code.' })
    if (typeof data !== 'string' || data.length === 0) return res.status(400).json({ error: 'The save is empty.' })
    const bytes = Buffer.byteLength(data)
    if (bytes > project.maxSaveBytes) return res.status(413).json({ error: 'The save is too large.' })
    try {
      JSON.parse(data)
    } catch {
      return res.status(400).json({ error: 'The save is not JSON.' })
    }
    await touch(device)
    await getPool().query(
      'INSERT INTO saves (device_id, data, bytes, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE data = VALUES(data), bytes = VALUES(bytes), updated_at = VALUES(updated_at)',
      [device, data, bytes],
    )
    res.json({ ok: true, savedAt: new Date().toISOString() })
  })

  api.get('/save/:device', async (req, res) => {
    const device = String(req.params.device).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!CODE.test(device)) return res.status(400).json({ error: 'A recovery code has 12 letters and digits.' })
    const [rows] = await getPool().query('SELECT data, updated_at AS updatedAt FROM saves WHERE device_id = ?', [device])
    if (!rows[0]) return res.status(404).json({ error: 'Nothing is saved under this code.' })
    res.json({ data: rows[0].data, updatedAt: rows[0].updatedAt })
  })

  api.post('/events', async (req, res) => {
    const { device, events } = req.body ?? {}
    if (!CODE.test(device ?? '')) return res.status(400).json({ error: 'Unknown device code.' })
    if (!Array.isArray(events) || events.length === 0 || events.length > 200) return res.status(400).json({ error: 'Send 1 to 200 events.' })
    const now = Date.now()
    const rows = []
    for (const e of events) {
      const clean = project.events[e?.kind]?.(e?.data)
      const at = Number(e?.at)
      // A malformed event is dropped, not the whole batch: one bad entry must not block a queue forever.
      if (!clean || !Number.isFinite(at) || at < now - YEAR || at > now + 86_400_000 || !DAY.test(e?.day ?? '')) continue
      rows.push([device, e.kind, new Date(at), e.day, JSON.stringify(clean)])
    }
    await touch(device)
    if (rows.length) await getPool().query('INSERT INTO events (device_id, kind, at, day, data) VALUES ?', [rows])
    res.json({ ok: true, stored: rows.length, dropped: events.length - rows.length })
  })

  api.get('/stats/:device', async (req, res) => {
    const device = String(req.params.device)
    if (!CODE.test(device)) return res.status(400).json({ error: 'Unknown device code.' })
    const days = Math.min(60, Math.max(1, Number(req.query.days) || 14))
    const today = DAY.test(String(req.query.today ?? '')) ? String(req.query.today) : new Date().toISOString().slice(0, 10)
    res.json(await project.stats(getPool(), device, { days, today }))
  })

  api.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' })
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The JSON could not be read.' })
    console.error(err)
    res.status(500).json({ error: 'Server error.' })
  })
  return api
}

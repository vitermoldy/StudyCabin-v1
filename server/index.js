import { existsSync } from 'node:fs'
import express from 'express'
import { createApi } from './app.js'
import { ROOT, config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

/**
 * `npm run server` in development (Vite forwards /api here), `npm start` after a
 * build (this also serves dist/). The site keeps working with the server off:
 * the browser holds its data and sends it once the server answers again.
 */
let pool = null
const app = express()
app.disable('x-powered-by')
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  next()
})
app.use('/api', createApi(() => pool))

const dist = ROOT + 'dist'
if (existsSync(dist)) app.use(express.static(dist))

/** MySQL may start after this server; keep trying every few seconds. */
async function connectLoop() {
  try {
    pool = await connect(config.db)
    console.log(`${project.name}: database ${config.db.database} connected`)
  } catch (err) {
    console.error(`${project.name}: database not reachable yet (${err.code ?? err.message}), trying again in 5 seconds`)
    setTimeout(connectLoop, 5000)
  }
}

app.listen(config.port, () => console.log(`${project.name} server on http://localhost:${config.port}`))
connectLoop()

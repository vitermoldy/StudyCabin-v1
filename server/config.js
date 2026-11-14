import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import project from './project.js'

/** Repo root, one level above /server. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url))

// .env is optional: a real deployment can set the variables directly.
if (existsSync(ROOT + '.env')) process.loadEnvFile(ROOT + '.env')

const str = (key, fallback) => process.env[key] ?? fallback
const num = (key, fallback) => {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config = {
  port: num('PORT', project.port),
  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: num('DB_PORT', 3306),
    user: str('DB_USER', 'root'),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', project.database),
  },
}

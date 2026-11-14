import mysql from 'mysql2/promise'

/**
 * Three tables, the same in every app:
 * - devices: one row per browser, keyed by its recovery code;
 * - saves: the app's browser save, mirrored as one JSON text per device;
 * - events: what happened (a focus session finished, a song played), for the stats.
 * Times are stored in UTC; `day` is the local date the browser reported, so a day
 * in the stats is the visitor's own day.
 */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS devices (
    id CHAR(12) PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS saves (
    device_id CHAR(12) PRIMARY KEY,
    data MEDIUMTEXT NOT NULL,
    bytes INT NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT saves_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id CHAR(12) NOT NULL,
    kind VARCHAR(24) NOT NULL,
    at DATETIME NOT NULL,
    day CHAR(10) NOT NULL,
    data JSON NULL,
    INDEX events_by_device (device_id, kind, day),
    CONSTRAINT events_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

/** Creates the database and the tables if they are missing, then hands back a pool. */
export async function connect(db) {
  const boot = await mysql.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password })
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${db.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await boot.end()
  const pool = mysql.createPool({ ...db, connectionLimit: 8, timezone: 'Z' })
  for (const sql of TABLES) await pool.query(sql)
  return pool
}

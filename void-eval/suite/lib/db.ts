// Direct SQLite access to the app under test, for checks a black-box HTTP
// client cannot make (Stage 2 tasks pin table and column names, and some
// cases move time by editing a row). Both apps keep SQLite on local disk:
//   guren  <app>/data/suite.db                       (boot-guren.sh)
//   void   <app>/.void/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
//          (Void's local D1; the running workerd sees outside writes at once)
// A fresh connection per call, so no handle outlives a write.
import { Database } from 'bun:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export function dbPath(driver: string, appDir: string): string {
  if (driver === 'guren') return join(appDir, 'data', 'suite.db')
  const dir = join(appDir, '.void', 'v3', 'd1', 'miniflare-D1DatabaseObject')
  const file = readdirSync(dir).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
  if (!file) throw new Error(`no local D1 database under ${dir}`)
  return join(dir, file)
}

export function sqlAll<T = Record<string, unknown>>(driver: string, appDir: string, query: string, params: unknown[] = []): T[] {
  const db = new Database(dbPath(driver, appDir))
  try {
    return db.query(query).all(...(params as any[])) as T[]
  } finally {
    db.close()
  }
}

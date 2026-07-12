import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'

const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))

export function createDb(filename: string) {
  const sqlite = new Database(filename)
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return db
}

export type Db = ReturnType<typeof createDb>

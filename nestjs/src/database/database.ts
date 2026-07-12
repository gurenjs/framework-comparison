import Database from 'better-sqlite3';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';
import * as schema from './schema';

/** Injection token for the Drizzle database instance. */
export const DRIZZLE = 'DRIZZLE';

export type Drizzle = BetterSQLite3Database<typeof schema>;

export function createDatabase(filename: string): Drizzle {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return db;
}

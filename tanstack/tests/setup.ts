import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Point the app at a fresh temporary SQLite database before any test file
// imports src/db (which opens the database and runs migrations on import).
process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), 'minilog-test-')),
  'test.db',
)

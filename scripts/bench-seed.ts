// Seeds identical benchmark data into the guren and adonisjs SQLite databases.
// Run AFTER each framework's own migrations:
//   (cd guren && bunx guren db:migrate)
//   (cd adonisjs && node ace migration:run --force)
// Usage: bun scripts/bench-seed.ts
import { Database } from 'bun:sqlite'

const TS = '2026-07-01T00:00:00.000Z'
const USERS = [
  { id: 1, name: 'Alice Writer', email: 'alice@example.com' },
  { id: 2, name: 'Bob Reader', email: 'bob@example.com' },
]
const POST_BODY = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(4).trim()
const PASSWORD_PLACEHOLDER = 'x'.repeat(60) // logins are not exercised by the benchmark

function seed(path: string, dialect: 'guren' | 'adonis') {
  const db = new Database(path)
  db.exec('PRAGMA foreign_keys = OFF')
  db.exec('DELETE FROM comments; DELETE FROM posts; DELETE FROM users;')

  const userSql =
    dialect === 'guren'
      ? 'INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)'
      : 'INSERT INTO users (id, full_name, email, password, created_at, updated_at) VALUES (?,?,?,?,?,?)'
  for (const u of USERS) {
    db.run(userSql, [u.id, u.name, u.email, PASSWORD_PLACEHOLDER, TS, TS])
  }

  for (let i = 1; i <= 50; i += 1) {
    db.run('INSERT INTO posts (id, user_id, title, body, created_at, updated_at) VALUES (?,?,?,?,?,?)', [
      i,
      1 + (i % 2),
      `Benchmark Post ${i}`,
      POST_BODY,
      TS,
      TS,
    ])
  }

  const commentCols = db
    .query("SELECT name FROM pragma_table_info('comments')")
    .all()
    .map((row) => (row as { name: string }).name)
  const hasUpdatedAt = commentCols.includes('updated_at')
  for (let i = 1; i <= 100; i += 1) {
    const values = [i, 1 + ((i - 1) % 50), 1 + (i % 2), `Comment ${i} body text for benchmarking purposes.`, TS]
    if (hasUpdatedAt) {
      db.run('INSERT INTO comments (id, post_id, user_id, body, created_at, updated_at) VALUES (?,?,?,?,?,?)', [
        ...values,
        TS,
      ])
    } else {
      db.run('INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?,?,?,?,?)', values)
    }
  }

  const posts = db.query('SELECT COUNT(*) AS n FROM posts').get() as { n: number }
  db.close()
  console.log(`${path}: seeded (${posts.n} posts)`)
}

seed('guren/data/guren.db', 'guren')
seed('adonisjs/tmp/db.sqlite3', 'adonis')

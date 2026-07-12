import type { Db } from './db'

export interface SessionUser {
  id: number
  name: string
  email: string
}

export interface AppEnv {
  Variables: {
    db: Db
    user: SessionUser | null
    sessionToken: string | null
  }
}

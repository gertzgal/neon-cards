import type { Db } from './db'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  /** "1" enables `config.rig` in local dev and tests. Never set in production. */
  DEV_RIG?: string
}

export interface AppEnv {
  Bindings: Env
  Variables: { db: Db; playerId: string }
}

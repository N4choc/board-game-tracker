import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __db_pool: Pool | undefined
}

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: process.env.PG_MAX_CONNECTIONS ? Number(process.env.PG_MAX_CONNECTIONS) : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
}

export const pool = globalThis.__db_pool ?? new Pool(poolConfig)
globalThis.__db_pool = pool

export const db = drizzle(pool, { schema })


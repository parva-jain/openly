// The Postgres connection, wrapped in a Drizzle instance.
//
// This is the ONLY place that opens a pool. Everything else receives a
// `Database` (dependency injection) — so routes/worker are testable against a
// real Postgres in tests without importing global state.

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string = config.databaseUrl): {
  db: Database;
  pool: pg.Pool;
} {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

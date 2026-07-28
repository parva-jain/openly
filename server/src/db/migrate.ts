// Applies pending SQL migrations from ./drizzle, then exits. Run by the
// `db:migrate` script and by the Docker container on startup (before the
// server boots), so the schema is always current.

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client.js";

async function main(): Promise<void> {
  const { db, pool } = createDb();
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

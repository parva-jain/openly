// Drizzle Kit config: where the schema lives, where generated SQL migrations go,
// and how to reach Postgres. `npm run db:generate` reads this to emit migration
// files under ./drizzle (checked into git); `npm run db:migrate` applies them.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://openly:openly@localhost:5432/openly",
  },
});

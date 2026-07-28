// Drizzle table definitions — the single source of truth for the Postgres
// schema. `db:generate` diffs this against the last migration to emit SQL.
//
// Multi-tenancy rule (CLAUDE.md M4): every non-user row carries a `user_id`
// foreign key, so one user can never see another's data.

import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Source, Usage } from "../types.js";

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  // Nullable so future social-login users (no password) fit the same table.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A queued drafting job. Replaces the Python JSON-file queue (openly/queue.py).
// status flows: pending -> processing -> drafted | error.
export const jobs = pgTable("jobs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  intent: text("intent").notNull(),
  sessionContext: text("session_context"),
  researchNotes: text("research_notes"),
  nVariations: integer("n_variations").notNull().default(3),
  model: text("model"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The slate output produced for a job. Mirrors DraftResponse in types.ts.
export const drafts = pgTable("drafts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  // Denormalized so tenancy checks never need a join back through jobs.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  variations: jsonb("variations").$type<string[]>().notNull(),
  contentType: text("content_type").notNull(),
  needsVerification: boolean("needs_verification").notNull(),
  sources: jsonb("sources").$type<Source[]>().notNull(),
  usage: jsonb("usage").$type<Usage>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type User = typeof users.$inferSelect;

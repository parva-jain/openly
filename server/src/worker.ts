// Background worker — turns pending jobs into drafts, off the request path.
//
// Concurrency: `claimNextJob` selects one pending row with
// `FOR UPDATE SKIP LOCKED`, so if several workers/instances run, each grabs a
// DIFFERENT job instead of colliding. The lock is held only for the brief
// claim transaction; the slow Anthropic call happens AFTER the row is marked
// `processing` and the lock is released — we never hold a row lock across a
// multi-second network call.

import { asc, eq } from "drizzle-orm";
import type { Database } from "./db/client.js";
import { drafts, jobs, type Job } from "./db/schema.js";
import type { AiServices } from "./app.js";
import type { DraftRequest } from "./types.js";

export interface WorkerDeps {
  db: Database;
  ai: Pick<AiServices, "draft">;
}

// Atomically claim the oldest pending job (or null if none), flipping it to
// `processing` so no other worker picks it up.
async function claimNextJob(db: Database): Promise<Job | null> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .orderBy(asc(jobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;
    await tx
      .update(jobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    return job;
  });
}

/**
 * Process a single pending job end-to-end. Returns the job id it handled, or
 * null if the queue was empty. Exported (and dependency-injected) so it can be
 * unit-tested with a mocked AI service.
 */
export async function processNextJob(deps: WorkerDeps): Promise<string | null> {
  const job = await claimNextJob(deps.db);
  if (!job) return null;

  try {
    const req: DraftRequest = {
      content_type: job.contentType as DraftRequest["content_type"],
      intent: job.intent,
      session_context: job.sessionContext,
      research_notes: job.researchNotes,
      n_variations: job.nVariations,
      model: job.model,
    };
    const result = await deps.ai.draft(req);
    await deps.db.insert(drafts).values({
      jobId: job.id,
      userId: job.userId,
      variations: result.variations,
      contentType: result.content_type,
      needsVerification: result.needs_verification,
      sources: result.sources,
      usage: result.usage,
    });
    await deps.db
      .update(jobs)
      .set({ status: "drafted", updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await deps.db
      .update(jobs)
      .set({ status: "error", error: message, updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
  }
  return job.id;
}

/**
 * Start the poll loop. Drains all pending jobs, then waits `pollMs` before
 * looking again. Returns a stop() function for graceful shutdown/tests.
 */
export function startWorker(deps: WorkerDeps, pollMs: number): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function tick(): Promise<void> {
    if (stopped) return;
    try {
      while (!stopped && (await processNextJob(deps)) !== null) {
        // keep draining until the queue is empty
      }
    } catch (err) {
      console.error("worker tick error:", err);
    }
    if (!stopped) timer = setTimeout(() => void tick(), pollMs);
  }

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

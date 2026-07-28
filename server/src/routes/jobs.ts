// Authenticated job routes — the async drafting flow.
//
//   POST /api/jobs      enqueue a "mark" (returns instantly; non-blocking)
//   GET  /api/jobs      list this user's jobs
//   GET  /api/jobs/:id  one job + its draft slate (if ready)
//
// Every query is scoped by req.userId, so users only ever touch their own rows.

import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { drafts, jobs } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function jobsRouter(db: Database): Router {
  const router = Router();
  router.use(requireAuth);

  // Enqueue a pending job and return immediately. Drafting happens in the
  // background worker (see worker.ts) — this keeps triggering non-blocking.
  router.post("/", async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.content_type !== "string" || typeof b.intent !== "string") {
      res.status(400).json({ error: "content_type and intent are required" });
      return;
    }
    const [job] = await db
      .insert(jobs)
      .values({
        userId: req.userId!,
        contentType: b.content_type,
        intent: b.intent,
        sessionContext: typeof b.session_context === "string" ? b.session_context : null,
        researchNotes: typeof b.research_notes === "string" ? b.research_notes : null,
        nVariations: typeof b.n_variations === "number" ? b.n_variations : 3,
        model: typeof b.model === "string" ? b.model : null,
      })
      .returning({ id: jobs.id, status: jobs.status });
    res.status(201).json({ jobId: job.id, status: job.status });
  });

  router.get("/", async (req, res) => {
    const rows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, req.userId!))
      .orderBy(desc(jobs.createdAt));
    res.json({ jobs: rows });
  });

  router.get("/:id", async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.userId, req.userId!)))
      .limit(1);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    let draft = null;
    if (job.status === "drafted") {
      const [d] = await db.select().from(drafts).where(eq(drafts.jobId, job.id)).limit(1);
      draft = d ?? null;
    }
    res.json({ job, draft });
  });

  return router;
}

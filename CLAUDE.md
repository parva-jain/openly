# CLAUDE.md — Openly (build-in-public content product)

> Name: **Openly** — building and learning in the open.
>
> Single source of truth for the project. Read top to bottom before a session.
> Keep the **Progress log** at the bottom current as milestones complete.
>
> **Direction (as of 2026-07-10):** this began as a personal single-user Python
> learning project and has been redirected into a **real, multi-user,
> public-facing product**, built on a deliberately **polyglot** architecture.
> See §2 for why and §5 for the architecture.

---

## 1. What this is

A **build-in-public content assistant** that turns real engineering work into
publishable posts (X, later LinkedIn, Medium/Substack) with almost no writing
effort. "The work" is broad: features shipped, problems solved, concepts
learned, and the storyline of a project.

Two ways content starts:

- **Manual trigger (primary).** While coding, the user marks a moment + gives a
  topic/intent. The tool drafts from there.
- **Auto-suggest (later).** The tool scans finished sessions and proposes missed
  moments. Safety net, built last.

Pipeline:

```
  manual mark (primary) ─┐
                         ├─► Capture ─► Draft ─► Review & edit ─► Publish
  auto-suggest (later)  ─┘   (session   (type-     (user, in       (APIs/OAuth)
                              window or   aware;     dashboard)
                              free        research
                              intent)     if needed)
                                 ▲            │
                                 └─ Style memory ◄┘
                                    (voice; learns from edits)
```

The user reviews, edits, and publishes. **The tool never publishes on its own.**

## 2. Why it exists (goals — reprioritized)

The original goals were: (1) a personal tool, (2) portfolio proof-of-work while
job-hunting, (3) a vehicle to learn AI engineering deeply. After building the
single-user Python prototype, we reprioritized:

1. **A shipped, fully-understood, demonstrable PRODUCT** is the top goal — it is
   the strongest possible job-hunting artifact. The user is a **blockchain /
   Solidity developer with Node.js backend skills, not from the AI field**. A
   live full-stack AI product he can explain end-to-end beats a half-finished
   learning repo of concepts he'd struggle to explain.
2. **Learn practical AI product engineering + modern infra** — prompting, tool
   use, RAG, MCP, multi-agent, AND Docker + cloud (AWS) deployment. Depth is
   **practical** (ship it, explain it), not research-level. Each concept gets a
   real job inside the product.
3. **Learn a polyglot codebase and service interaction** — a Python AI service
   and a Node/TS product backend talking over HTTP. Deliberately chosen: it
   showcases Python + Node, and mirrors how real companies split ML from product.

## 3. Content types (do NOT overfit to one)

Content is **typed**; the type drives the format, whether web research is
needed, and whether it's anchored to a coding session. Illustrative, not
exhaustive — anything post-worthy should fit.

| Type                               | Research? | Session-anchored?            | Example                               |
| ---------------------------------- | --------- | ---------------------------- | ------------------------------------- |
| Origin / narrative                 | No        | No (intent is the source)    | "How this project idea came to me"    |
| Progress update / build log        | Light     | Usually                      | "Shipped the capture layer this week" |
| Learning / reflection              | Light     | Sometimes                    | "3 things I learned building an agent"|
| Concept explainer                  | Heavy     | Optional                     | "What RAG actually is"                |
| Problem → fix war story            | Some      | Yes                          | a nasty deployment bug                |
| Feature deep-dive / how-I-built-it | Light     | Yes                          | "How the style-memory loop works"     |

Implications: don't hard-code one article shape; some content has no session
anchor (accept free-form intent); research is conditional, selected by type.

## 4. Guiding principles (read before adding anything)

Hard-won; respect them; push back on me if I violate one.

- **Manual trigger is the core; autonomous suggestion is a later add-on.**
- **Capture is moment-scoped, not session-scoped.** Grab a window around a topic
  (or free-form intent); never force re-segmentation of a whole session.
- **Triggering must be non-blocking.** A trigger *queues a job*; drafting happens
  async and lands in the review dashboard. The user keeps coding.
- **Human-in-the-loop always. Never auto-publish.**
- **The machine is the quality gate.** The user publishes readily, so the
  drafting bar must be high. Don't build a slop cannon.
- **Accuracy > everything for researched content.** Web-sourced claims go out
  under the user's name: drafts MUST cite sources inline; review includes a
  correctness pass. The user is the domain authority; the tool drafts.
- **Learn voice via prompt-level adaptation, NOT fine-tuning.** Evolving style
  guide + a library of (draft → published) edit pairs, fed back as
  instructions + few-shot/RAG. The draft↔published gap is the training signal.
- **Build evals early; re-run after every concept** to verify it helped.
- **Privacy is load-bearing.** Sessions can contain secrets/client code. Never
  leak private/raw content into a public draft. Sanitize and gate. Store little.
- **Simplest thing that works first;** add sophistication deliberately, labeled.
- **Keep the service boundary clean (see §5).** The Python AI service stays
  STATELESS; all product state lives in Node/Postgres. Don't leak product
  concerns into Python or AI concerns into Node.

## 5. Architecture (target system — polyglot)

The core design decision: a **stateless Python "AI brain"** behind an HTTP API,
and a **Node/TS product backend** that owns all state and orchestration. Two
clients (web dashboard + CLI) talk only to the Node backend.

```
   Web dashboard (React/Next — TBD)        CLI (captures local session window)
             │                                        │
             └───────────────────┬────────────────────┘
                                 ▼
                 ┌────────────────────────────────────┐
                 │   NODE / TS  BACKEND  (product)     │  auth · users · job
                 │   Postgres · REST API · OAuth       │  queue · publishing ·
                 └──────────────────┬─────────────────┘  orchestration
                                    │  HTTP  (the contract to design well)
                                    ▼
                 ┌────────────────────────────────────┐
                 │   PYTHON  AI SERVICE  (FastAPI)     │  STATELESS
                 │   POST /draft   → N variations      │  prompts · Anthropic ·
                 │   POST /fuse    → 1 synthesized      │  research loop · (RAG)
                 │   prompts · tool-use research · RAG │
                 └────────────────────────────────────┘

**Variation-slate model (core interaction).** A draft request returns a SLATE
of N variations (N configurable, default 3), each entering from a distinct
angle, generated in a single call for cost efficiency. On the dashboard the
user can: pick one, edit it, **fuse** 2+ into one synthesized draft, or
regenerate (optionally with feedback like "more raw / shorter"). This keeps
"the machine is the quality gate, the human decides" (§4). Bonus: which
variation the user picks / how they fuse is a strong style-memory signal (M7).
```

**Ownership:**

| Concern                              | Lives in            |
| ------------------------------------ | ------------------- |
| Prompts, model calls, tool-use research, (later) RAG retrieval | Python AI service (stateless) |
| Users, auth, sessions                | Node backend        |
| Job queue (was flat JSON)            | Node backend + Postgres |
| Publishing / OAuth to platforms      | Node backend        |
| Local session capture + sanitize     | CLI (client-side)   |
| Draft review / edit UI               | Web dashboard       |

The Node↔Python HTTP contract is the key interface — design it well; it's also
the "two-language interaction" learning goal.

Everything runs in **Docker** (one container per service, wired with
docker-compose) for local dev and later cloud deploy.

## 6. Load-bearing technical facts (verified)

Claude Code / capture:

- Session transcripts are **JSONL** at
  `~/.claude/projects/<encoded-path>/<session-id>.jsonl` — the CLI reads a
  window from here for the manual snapshot (and the later auto-scan).
- Auto-suggest (later) can use the `SessionEnd`/`Stop` hook (JSON on stdin with
  `session_id`, `transcript_path`, `cwd`, etc.). Hooks docs:
  https://code.claude.com/docs/en/hooks

Existing Python engine (reused as the AI service core): `openly/draft.py`
(the `draft()` call + tool-use loop), `openly/prompts.py` (layered prompt
assembly), `openly/research.py` (Tavily `web_search` tool), `openly/cost.py`
(token→USD meter), `openly/content_types.py` (typed content, source of truth).

Cost discipline (job-hunting-friendly, near-zero spend):

- Anthropic + Tavily: prepaid / free-tier, per-call cost metered and visible.
- AWS: use the **12-month Free Tier** (t2/t3.micro EC2, RDS); set a **hard
  billing alarm** (~$1) and tear down when not demoing. Start local (Docker),
  deploy only when there's something worth hosting.

## 7. Roadmap — build the product; learn concepts in-context

> Ordered by dependency. Evals get introduced early and run forever. AI
> concepts (RAG, MCP, multi-agent) and infra (Docker, AWS) are folded into the
> product build, not studied separately. Each milestone: I give a brief
> plain-English explanation of the concept *as it applies here*, then we build.

### Done (single-user Python prototype)
- [x] **Draft engine** — typed content, layered prompts, token→USD cost meter.
- [x] **Tool-use research** — Tavily `web_search`, gated on `needs_research`,
      cited drafts.
- [x] **Manual trigger + non-blocking queue (prototype)** — `openly mark`
      (capture + sanitize + queue), `openly work` (drain), `list`/`show`. NOTE:
      queue/worker move to Node; capture moves to the CLI in the new architecture.

### M1 — Python AI service (FastAPI)
- [x] **Build:** wrapped the engine in a stateless FastAPI app. `GET /health`;
      `POST /draft` (single draft). No DB, no users. Verified via curl.
- [ ] **Refine (do next):** change `/draft` to return a **slate of N
      variations** (`n_variations`, default 3) instead of one draft; add
      `POST /fuse` (selected variations + optional instruction → 1 synthesized
      draft). Fix this contract before Node builds against it (M2).

### M2 — Node/TS backend calls Python  ✅
- [x] **Build:** `server/` — Node + TypeScript + Express 5 (native fetch, no
      HTTP lib; native `.env` via `process.loadEnvFile`, no dotenv). `src/
      types.ts` mirrors the Python contract; `src/aiService.ts` is the sole
      typed client (draft/fuse/health); `src/index.ts` exposes `/health`,
      `/api/draft`, `/api/fuse` and forwards to Python. Service URL is env-driven
      (`PYTHON_SERVICE_URL`).
- [x] **Done when:** Node round-trips through Python. ✅ Verified: `/api/draft`
      returns the slate via Python; `/health` reports `aiReachable`; Python down
      → clean 503 (no crash).

### M3 — Docker + docker-compose  ✅
- [x] **Build:** `Dockerfile` (Python, slim, layer-cached deps), `server/
      Dockerfile` (Node multi-stage build→runtime, tests excluded via
      `tsconfig.build.json`), `docker-compose.yml` with `ai` + `backend` + `db`
      (Postgres), health checks, and `depends_on: service_healthy` ordering.
      Backend reaches Python at `http://ai:8000` (Compose service name). Secrets
      from root `.env`, never baked into images.
- [x] **Done when:** `docker compose up --build` brings the whole stack up. ✅
      Verified: all 3 healthy; round-trip curl→backend→ai works in-network.

### M4 — Postgres + users + auth + job queue (Node)  ✅
- [x] **Learn:** multi-tenancy (`user_id` everywhere), auth basics, migrations.
- [x] **Build:** Drizzle schema (users, jobs, drafts) + generated SQL migration
      applied on boot; own JWT auth (argon2id via `@node-rs/argon2`, `jose`
      tokens, `requireAuth` middleware); job queue moved into Postgres with a
      background worker (`FOR UPDATE SKIP LOCKED` poller) — non-blocking
      preserved. Every job/draft row scoped by `user_id`. Sync `/api/draft`
      removed in favour of `POST /api/jobs` (enqueue) + `GET /api/jobs[/:id]`.
- [x] **Done when:** two users have separate, private queues/drafts behind login.
      ✅ Verified by integration tests against real Postgres (tenancy 404 +
      disjoint lists; full enqueue→worker-drafts→fetch-slate flow).

### M5 — CLI as an authenticated client  ✅
- [x] **Learn:** thick client vs. thin server; where capture belongs.
- [x] **Build:** standalone `cli/` (Node/TS, zero runtime deps). Captures the
      local session window (sanitized client-side) and POSTs an authenticated
      "mark" to `POST /api/jobs`; drafting happens server-side. Browser login
      (loopback + PKCE) with a device-code fallback for SSH/headless; long-lived
      revocable CLI token (sliding 30-day), stored `0600` in `~/.openly`.
- [x] **Done when:** `openly mark ...` from the terminal creates a job in the
      user's account. ✅ Verified end-to-end against the live Docker stack
      (login → mark → worker drafts → show slate) and by the done-bar test.

### Evals — introduce here, keep forever
- [ ] **Learn:** evaluating LLM output (why it differs from normal tests).
- [ ] **Build:** a small labeled good/bad draft set + a script scoring the
      `/draft` output. Re-run after every later change.
- [ ] **Done when:** one command gives a quality number to compare over time.

### M6 — Web dashboard
- [ ] **Learn:** wiring a frontend to the Node API.
- [ ] **Build:** login; list jobs; view the **variation slate** for a job;
      pick / edit / **fuse** / regenerate; approve. (Stack — Next.js/React — TBD.)
- [ ] **Done when:** the user drives the whole slate→pick/fuse→approve flow in
      the browser.

### M7 — Style memory (RAG, per-user)
- [ ] **Learn:** RAG — retrieve relevant style rules + (draft→published) edit
      pairs and inject them at draft time.
- [ ] **Build:** store edit pairs per user; retrieve + inject in the Python
      service. Re-run evals vs. a no-retrieval baseline.
- [ ] **Done when:** drafts measurably sound more like the user.

### M8 — Publishing (human-in-the-loop)
- [ ] **Learn:** OAuth to a platform (X first); posting APIs.
- [ ] **Build:** connect an account; publish an approved draft from the
      dashboard. Never automatic.
- [ ] **Done when:** an approved draft posts to X with one explicit click.

### M9 — Cloud deploy (AWS, near-zero cost)
- [ ] **Learn:** Free Tier, EC2/ECS, RDS, billing alarms, teardown discipline.
- [ ] **Build:** deploy the Dockerized stack to AWS behind a URL; billing alarm
      at ~$1; documented teardown.
- [ ] **Done when:** the app is reachable at a public URL for a demo.

### M10 — MCP + multi-agent + autonomous suggestion (capstone)
- [ ] **Learn:** MCP (expose the pipeline over the protocol); multi-agent
      patterns; a high-precision auto-suggest filter.
- [ ] **Build:** MCP server over the pipeline; per-platform drafter coordinator;
      the session-end scanner that *suggests* missed moments.
- [ ] **Done when:** end-to-end runs and the eval score holds or improves vs. the
      simpler version. (If multi-agent doesn't beat one good agent, keep the
      simpler one — a valid finding.)

### Later / parked
- [ ] "Learn more" explainer: flow diagrams / concept visuals from a session.

## 8. Resources index

- Anthropic courses / cookbook: https://github.com/anthropics/courses ·
  https://github.com/anthropics/claude-cookbooks
- Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- MCP — build a server: https://modelcontextprotocol.io/docs/develop/build-server
- FastAPI: https://fastapi.tiangolo.com · Docker: https://docs.docker.com/get-started/
- AWS Free Tier: https://aws.amazon.com/free · Claude Code hooks: https://code.claude.com/docs/en/hooks

## 9. Stack

- **Python AI service:** Python + FastAPI + Anthropic SDK + Tavily. Stateless.
- **Node backend:** Node + TypeScript. Framework (Express vs. NestJS) TBD.
- **DB:** Postgres (via Docker locally; RDS in cloud).
- **Frontend:** React/Next.js (TBD), built at M6.
- **Infra:** Docker + docker-compose locally; AWS Free Tier for deploy.
- **Secrets:** env vars only; never commit `.env`, transcripts, or tokens.
- **No AI/agent framework** until genuinely needed (capstone).

## 10. How to work with me (instructions for Claude Code)

- Follow the roadmap in order; don't jump ahead a milestone unless asked.
- **Build-along teaching:** the user does NOT want to self-study resources. At
  each milestone/concept, give a short plain-English explanation *as it applies
  here*, then build. Teach the AI parts at **practical** depth (he's a
  blockchain/Node dev, not AI-field). Lean on his Node/backend strengths.
- Treat content as **typed** (§3); only research when the type calls for it.
- Keep the **service boundary clean** (§5): Python stateless, state in Node.
- Enforce §4 — non-blocking triggers, accuracy + citations, human-in-the-loop,
  no fine-tuning, privacy.
- Watch cost (API + AWS); keep spend near zero and visible.
- Update the **Progress log** when a milestone's checkboxes are done.

## 11. Progress log

- Planning complete; original single-user learning plan executed through the
  draft engine + tool-use research + prototype trigger/queue (3 commits).
- **Stage 0 (draft engine) complete.** `openly/content_types.py`,
  `prompts.py`, `cost.py`, `draft.py`, `scripts/draft_cli.py`. Targets X.
  Default model `claude-sonnet-4-6`. ~$0.002–0.004/draft.
- **Stage 1 (tool use + trigger) complete.** `openly/research.py` (Tavily
  web_search + tool-use loop), gated on `needs_research`. `openly/capture.py`,
  `queue.py`, `worker.py`, `scripts/openly_cli.py`. `data/` gitignored.
- **Direction pivot (2026-07-10):** redirected to a multi-user product on a
  polyglot Python(FastAPI) + Node/TS architecture; added Docker + AWS learning
  goals. CLAUDE.md rewritten to match (this version).
- **M1 done:** stateless FastAPI service (`openly/api.py`) — `/health`,
  `/draft`. **Variation-slate** added: `/draft` returns N variations (default 3,
  max 5) in one call; new `/fuse` synthesizes selected ones. Default model
  `claude-sonnet-5` (pricing is an estimate — verify).
- **M2 done:** `server/` Node/TS + Express backend calls the Python service over
  HTTP (typed client, env-driven URL, graceful 503 when Python is down).
- **Standards pass done:** tests (pytest 24 / node:test 6, external APIs
  mocked), Ruff + ESLint/Prettier, GitHub Actions CI, README. Repo public at
  github.com/parva-jain/openly.
- **M3 done:** Dockerized all three services; `docker compose up --build` runs
  the full stack (ai + backend + db), verified end-to-end.
- **M4 done:** Node backend now stateful. Drizzle + Postgres (users/jobs/drafts),
  own JWT auth (argon2id + `jose` + `requireAuth`), and the job queue moved into
  Postgres with a `SKIP LOCKED` background worker (non-blocking preserved).
  Tenancy scoped by `user_id`; sync `/api/draft` replaced by `POST /api/jobs` +
  `GET /api/jobs[/:id]`. Migrations run on container boot. 13 tests (5 unit + 8
  integration vs. real Postgres) green incl. the tenancy done-bar; CI gained a
  Postgres service. Bumped `drizzle-orm`→0.45.2 (SQLi advisory).
- **M5 done:** standalone `cli/` package (Node/TS, zero runtime deps). Browser
  login — loopback + PKCE with a device-code fallback (SSH/headless) — mints a
  long-lived, revocable CLI token (sliding 30-day, sha256-hashed, `openly_`
  prefix) stored `0600` in `~/.openly`. Backend `requireAuth` now accepts either
  a JWT or a CLI token; new `cli_tokens` table + migration; loopback/device
  endpoints serve minimal HTML pages (M6's dashboard will absorb them). `mark`
  captures + sanitizes the session window client-side and enqueues via
  `POST /api/jobs`. Tests: 24 backend (incl. M5 done-bar + flow tests, files run
  serially via `--test-concurrency=1` to avoid shared-DB truncate races) + 12
  CLI (config, http, capture/sanitize, content-types). Verified end-to-end on
  the live Docker stack; privacy check confirmed no secrets in stored capture.
- **Next action:** Evals — a small labeled good/bad draft set + a scoring script
  over `/draft`, re-run after every later change (see roadmap "Evals"); then M6
  (web dashboard).

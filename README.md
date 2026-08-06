# Openly

A build-in-public content assistant: turn your real engineering/learning work
into publishable posts (X, with more platforms coming) — without the writing
effort. You review, edit, and publish; the tool never auto-publishes.

Built as a **polyglot** system: a stateless **Python (FastAPI)** AI service does
the drafting; a **Node/TypeScript (Express)** backend owns the product surface
and calls it over HTTP.

## Architecture

```
  Web dashboard / CLI  ->  Node/Express backend  --HTTP-->  Python/FastAPI AI service
                           (product: auth, queue,          (stateless: prompts,
                            publishing — WIP)               model calls, research)
```

- **`openly/`** — the Python AI service. `draft()` returns a *slate* of N
  variations; `fuse()` synthesizes selected ones. Web research (Tavily) is
  gated to content types that need it, with inline citations.
- **`server/`** — the Node/TS backend. Typed client for the AI service, env-
  driven service URL, graceful degradation when the AI service is down.
- **`cli/`** — the `openly` CLI (Node/TS, zero runtime deps). Captures a window
  of your current coding session, sanitizes secrets locally, and enqueues a
  draft job over the authenticated API. Logs in via the browser.

## Develop

Python service:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env   # add ANTHROPIC_API_KEY (and TAVILY_API_KEY for research)
.venv/bin/uvicorn openly.api:app --reload --port 8000   # http://localhost:8000/docs
```

Node backend:

```bash
cd server
npm install
cp .env.example .env
npm run dev            # http://localhost:3000
```

CLI:

```bash
cd cli
npm install
npm run build

# point at your backend (defaults to http://localhost:3000)
node dist/index.js login                 # opens the browser (loopback + PKCE)
node dist/index.js login --device        # SSH/headless: prints a code to enter
node dist/index.js mark progress_update "shipped the CLI"   # capture + enqueue
node dist/index.js list                  # your jobs + status
node dist/index.js show <job-id>         # the variation slate, once drafted
node dist/index.js logout                # revoke the token + clear local state
```

The token is stored in `~/.openly/config.json` (mode `0600`). Override the
backend with `--url <url>` or `OPENLY_URL`. `mark` auto-captures the session
window for session-anchored types; force it with `--capture` / skip with
`--no-capture`.

## Quality gate

```bash
# Python
.venv/bin/ruff check openly tests scripts
.venv/bin/pytest

# Node backend (in server/)
npm run typecheck && npm run lint && npm run format:check && npm test

# CLI (in cli/)
npm run typecheck && npm run lint && npm test
```

Tests mock the paid/external APIs (Anthropic, Tavily), so they run for free and
deterministically. CI (GitHub Actions) runs the whole gate on every push.

## Docs

- [Architecture & Deployment](./docs/architecture.md) — the polyglot design, the
  Docker setup in depth, and how it maps to AWS (ECR/ECS/Fargate/RDS).

## Status

Roadmap and detailed context live in [CLAUDE.md](./CLAUDE.md). Done so far: the
draft engine (typed content, variation slate, cost metering), tool-use web
research, the FastAPI service, the Node backend, Docker + Postgres, auth + the
job queue, and the authenticated CLI (browser login, session capture, enqueue).
Next: evals, then the web dashboard.

# Openly — Architecture & Deployment

This document explains how Openly is structured, how it runs in containers, and
how that container setup maps onto AWS. It's written to be read alongside the
actual files (`Dockerfile`, `server/Dockerfile`, `docker-compose.yml`).

---

## 1. System overview

Openly is a **polyglot** system with a deliberately clean split:

```
   Web dashboard / CLI                (clients — WIP)
            │
            ▼  HTTP
   ┌─────────────────────────┐   HTTP    ┌───────────────────────────┐
   │  Node / TypeScript       │  ───────▶ │  Python / FastAPI          │
   │  backend  (product)      │           │  AI service  (stateless)   │
   │  auth · queue · publish  │ ◀───────  │  prompts · model · research│
   └───────────┬─────────────┘           └───────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  PostgreSQL   │   (product state)
        └──────────────┘
```

- **Python AI service** (`openly/`) is **stateless**: given a request, it drafts
  content and returns it. No database, no users. It's the "AI brain."
- **Node backend** (`server/`) owns all **product** concerns — users, auth, the
  job queue, publishing — and calls the AI service over HTTP.
- **Postgres** holds product state.

**Why split languages?** It mirrors how real companies separate ML/AI logic
(Python ecosystem) from product/API logic (Node/TS), and it keeps each side
focused. The only coupling between them is a small, explicit HTTP contract.

**The load-bearing design decision:** the two services communicate *only* over
HTTP, and the AI service's address is an **environment variable**
(`PYTHON_SERVICE_URL`). That single choice is what lets the exact same code run
locally, in Docker, and in the cloud with no edits.

---

## 2. Container setup, in depth

### 2.1 Image vs. container

An **image** is a read-only, layered template (app + runtime + dependencies).
A **container** is a running instance of an image. One image can run as many
containers — which is what makes horizontal scaling trivial (run more instances
of the same image).

We build two images: `openly-ai` (from `./Dockerfile`) and `openly-backend`
(from `./server/Dockerfile`).

### 2.2 Layer caching (Python `Dockerfile`)

Each Dockerfile instruction creates a cached **layer**. Instruction order is a
performance decision:

```dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt   # slow — cached
COPY openly ./openly                                 # changes often
```

Dependencies are installed **before** source is copied. Editing application code
only invalidates the last layer, so `pip install` is served from cache instead
of re-running. "Dependencies before source" is the core Dockerfile optimization.

### 2.3 Multi-stage build (Node `server/Dockerfile`)

The Node image uses two stages:

- **build stage** — installs *all* deps (including TypeScript + devDeps) and
  compiles `src/` → `dist/` via `tsconfig.build.json` (which excludes tests).
- **runtime stage** — starts from a clean base, installs **only** production
  deps (`npm ci --omit=dev`), and copies just the compiled `dist/`.

The final image ships **no TypeScript compiler, no test libraries, no source** —
smaller, faster to pull, smaller attack surface.

### 2.4 Build context & `.dockerignore`

The "build context" is everything sent to the Docker daemon at build time. The
`.dockerignore` files exclude `.venv`, `.git`, `data/`, `node_modules`, and
`.env` — for **speed** (don't ship huge dirs) and **security** (never bake
secrets into an image).

### 2.5 Binding `0.0.0.0`, not `localhost`

The Python service runs `uvicorn --host 0.0.0.0`. Inside a container,
`localhost` refers only to the container itself; nothing outside can reach it.
`0.0.0.0` listens on all interfaces so published ports can route traffic in.

### 2.6 `EXPOSE` vs. publishing ports

- `EXPOSE 8000` in a Dockerfile is **documentation** of the port the app uses.
- `ports: ["8000:8000"]` in Compose actually **publishes** it, mapping
  `HOST:CONTAINER`. Without a published port, a service is reachable only from
  inside the Docker network.

### 2.7 Networking & service discovery (`docker-compose.yml`)

Compose places all services on a private network and makes each **service name a
DNS hostname**. That's why the backend reaches Python at `http://ai:8000` — not
an IP address. Services find each other by name; the outside world can reach a
service only if its port is explicitly published. This isolation is a security
property, not just convenience.

### 2.8 Volumes & persistence

Containers are **ephemeral** — their filesystem dies with them. Postgres uses a
named volume (`pgdata:/var/lib/postgresql/data`) that lives outside the
container lifecycle, so `docker compose down` removes containers but keeps the
data. (`docker compose down -v` would also delete the volume.)

### 2.9 Config & secrets via environment

Compose auto-loads the root `.env` and interpolates values like
`${ANTHROPIC_API_KEY}` at **runtime**. Secrets are never written into images.
Keeping config in the environment (rather than the build) is a
[12-Factor](https://12factor.net/) principle and is exactly what cloud runtimes
expect.

### 2.10 Health checks & startup ordering

`ai` and `db` define `healthcheck` commands; `backend` declares
`depends_on: { condition: service_healthy }`. So the backend starts only once
its dependencies are **actually ready** (accepting connections), not merely
"started" — solving the classic boot-order race condition.

---

## 3. Mapping to AWS

Deploying to AWS mostly swaps the *runner* while keeping the same images. Each
local concept has a direct managed-service counterpart.

| Local (this repo)                        | AWS service                          | Role |
| ---------------------------------------- | ------------------------------------ | ---- |
| Built images (`openly-ai`, `-backend`)   | **ECR** (Elastic Container Registry) | Private image registry; `docker push` here |
| `docker compose up` (running containers) | **ECS** on **Fargate** (or EC2)      | Runs containers; Fargate = no servers to manage |
| A Compose `service` block                | ECS **Task Definition**              | Image, CPU/mem, ports, env, health check as JSON |
| `db` Postgres container + volume         | **RDS** (managed Postgres)           | Managed backups, patching, durable storage |
| `.env` / Compose secrets                 | **Secrets Manager** / **SSM Parameter Store** | Inject secrets into tasks at runtime |
| `ports:` + health checks                 | **ALB** (Application Load Balancer)  | Routes public traffic to healthy tasks |
| Compose private network / service names  | **VPC** + security groups + service discovery | Network isolation & who-can-talk-to-whom |
| `pgdata` volume                          | RDS storage / **EBS** / **EFS**      | Persistent storage |
| `docker compose logs`                    | **CloudWatch Logs**                  | Centralized container logs |
| `docker compose up` orchestration        | ECS service (desired count, autoscaling) | Keep N healthy copies, replace failures |

**One-sentence summary (interview-ready):** *Openly is containerized with Docker
Compose locally; the same images deploy to AWS by pushing to ECR and running as
ECS/Fargate tasks behind an ALB, with RDS for Postgres and Secrets Manager for
config.*

---

## 4. Deployment cost strategy

The goal is a demonstrable deploy at **near-zero cost**:

- **Cheapest path (planned for M9):** a single **EC2 `t3.micro`** (12-month free
  tier) running the very same `docker compose up`. Same file, one small VM.
- **Next level:** ECS/Fargate + ALB + RDS — more "production-shaped," but the ALB
  and RDS are not fully free, so expect a few dollars/month.
- **Guardrails (always):** set an AWS **Budget/billing alarm** (~$1) before
  deploying anything, and tear the stack down when it's not being demoed.

---

## 5. File reference

| File                          | Purpose |
| ----------------------------- | ------- |
| `Dockerfile`                  | Python AI service image (slim, layer-cached deps) |
| `server/Dockerfile`           | Node backend image (multi-stage build → lean runtime) |
| `server/tsconfig.build.json`  | Production TS build config (excludes tests) |
| `docker-compose.yml`          | Orchestrates `ai` + `backend` + `db` with health checks |
| `.dockerignore` / `server/.dockerignore` | Trim build context; keep secrets out of images |

_See [CLAUDE.md](../CLAUDE.md) for the full product roadmap and status._

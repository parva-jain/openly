# CLAUDE.md — Openly (build-in-public content agent)

> Name: **Openly** — building and learning in the open.
>
> This file is the single source of truth for the project. It carries the full
> context from the planning conversation so work can continue from here. Read it
> top to bottom before starting a session. Keep the **Progress log** at the
> bottom up to date as milestones complete.

---

## 1. What this is

A **build-in-public content assistant** wired into my Claude Code workflow. As I
build a project, it helps me turn the work into posts/articles — for X, LinkedIn,
and Medium/Substack — with almost none of the writing effort. "The work" is
broad: features I ship, problems I solve, concepts I learn, complexities I hit,
and the storyline of the project itself (how the idea started, what I'm learning,
what I built this week).

Two ways content gets started:

- **Manual trigger (primary).** While working — or any time — I say "this is
  worth a post" and give a topic/intent. The tool takes it from there.
- **Auto-suggest (later).** The tool scans finished sessions and proposes
  moments I might have missed. This is a safety net, built last.

Both feed one pipeline:

```
  manual mark (primary) ─┐
                         ├─► Capture ─► Draft ─► Review & edit ─► Publish
  auto-suggest (later)  ─┘   (session    (type-     (me)            (APIs/MCP)
                              window OR   aware;
                              free        research
                              intent)     only if
                                          needed)
                                 ▲           │
                                 └─ Style memory ◄┘
                                 (my voice; learns from my edits)
```

I review, edit, and publish. The tool never publishes on its own.

## 2. Why it exists (three goals, in priority order)

1. **A personal tool that removes the _effort_ of creating content**, so I can
   build in public consistently. My blocker isn't fear of publishing or failing
   to notice good moments — I'm happy to publish a ready draft and I do spot
   post-worthy moments. The blocker is the time/energy of writing from scratch.
   This tool removes exactly that.
2. **Proof of work / portfolio** while job hunting — a real multi-agent system
   wired into Claude Code is a demonstrable artifact.
3. **A vehicle to learn AI engineering deeply** — prompting, tool use, agents,
   multi-agent orchestration, RAG, MCP, Claude skills, and evals. Each concept
   gets a real (if initially basic) job. Depth comes from building, not reading.

## 3. Content types (do NOT overfit to one)

The tool must handle many kinds of content. **Content type drives the format,
whether web research is needed, and whether it's anchored to a coding session.**
This list is illustrative, not exhaustive — anything that seems like potential
content should fit.

| Type                               | Research? | Session-anchored?            | Example                                   |
| ---------------------------------- | --------- | ---------------------------- | ----------------------------------------- |
| Origin / narrative                 | No        | No (my intent is the source) | "How this project idea came to me"        |
| Progress update / build log        | Light     | Usually                      | "Shipped the capture layer this week"     |
| Learning / reflection              | Light     | Sometimes                    | "3 things I learned building an agent"    |
| Concept explainer                  | Heavy     | Optional                     | "What RAG actually is"                    |
| Problem → fix war story            | Some      | Yes                          | the ERC-7702 deployment bug (one example) |
| Feature deep-dive / how-I-built-it | Light     | Yes                          | "How the style-memory loop works"         |

Implications for the build:

- **Don't hard-code the technical-article structure.** Each type has its own
  template/shape. The ERC-7702 debugging article is ONE template, not THE one.
- **Some content has no session anchor.** The trigger must accept free-form
  intent (e.g. the origin story lives in my head, not a transcript).
- **Research is conditional**, selected by type — not a mandatory step.

## 4. Guiding principles (read before adding anything)

Hard-won decisions from planning. Respect them; push back on me if I violate one.

- **Manual trigger is the v1 core; autonomous suggestion is a later add-on.**
  Marking a moment myself moves the "is this worth posting?" judgment to the
  point where my context and motivation are highest, and sidesteps the hardest
  problem (a high-precision auto-filter) until much later.
- **Capture is moment-scoped, not session-scoped.** A session is long and
  multi-topic; grab a _window_ around a topic (or just free-form intent), never
  force re-segmentation of a whole session.
- **Learn-then-build, one concept per milestone, in dependency order.** Don't
  big-bang all the concepts into v1.
- **Simplest thing that works first; add sophistication deliberately** and as a
  labeled learning step, not by accident.
- **Triggering must be non-blocking.** A trigger _queues a content job_; drafting
  happens async and lands in the review dashboard. I keep coding.
- **Human-in-the-loop always. Never auto-publish.**
- **The machine is the quality gate.** I publish readily, so the drafting/filter
  bar must be high. I keep one habit: a ~20-sec "is this worth someone's time?"
  check before publishing. Don't let this become a slop cannon.
- **Accuracy > everything for researched content.** When the tool pulls from the
  internet (e.g. to explain a concept), it can be wrong, and it goes out under my
  name. Drafts MUST cite sources inline, and my review includes a
  technical-correctness pass. I am the domain authority; the tool is the drafter.
- **Learn my voice via prompt-level adaptation, NOT fine-tuning.** Evolving
  plain-English style guide + a library of (draft → published) edit pairs, fed
  back as instructions + few-shot/RAG. The gap between what was drafted and what
  I published is the training signal, captured for free. Let me optionally leave
  a one-line "why" on an edit.
- **Build evals early; re-run after every concept** to verify it actually helped.
- **Privacy is load-bearing.** Sessions can contain secrets/client code. Never
  leak private/raw content into a public draft. Sanitize and gate. Store little.
- **Defer scope creep** (e.g. the "learn more / flow-diagram explainer").

## 5. Architecture (target system)

| Stage         | Job                                                                           | Primary concept                  |
| ------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| Trigger       | I mark a moment + give intent/type (primary), or tool suggests (later)        | Skill / slash command / MCP tool |
| Capture       | Snapshot a session window OR take free-form intent                            | Event hooks (not AI)             |
| Draft         | Pick the type's template; research if needed; write per platform, in my voice | Tool use + RAG + multi-agent     |
| Review & edit | I approve / fix in a dashboard                                                | Human-in-the-loop                |
| Publish       | Post approved content to platforms                                            | Tool use / MCP                   |
| Style memory  | Store rules + edit pairs; feed Draft; learn from edits                        | Memory + embeddings/RAG          |

The drafter is a small router: it reads the requested content type, decides
whether to call the research tool, pulls the session window (if any) and the
relevant style examples, then drafts in the target platform's format.

## 6. Load-bearing technical facts (verified)

Claude Code integration:

- **Manual trigger** is best implemented as a Claude Code skill or slash command
  (start with a simple script/command, upgrade to a real skill in Stage 3). It
  captures a recent transcript window + my stated type/intent. For non-session
  content, it accepts free-form intent with no window.
- **Auto-suggest (later)** uses the `SessionEnd` (or `Stop`) hook. A hook
  receives JSON on stdin including `session_id`, `transcript_path`, `cwd`, and
  (for tool events) `tool_name`, `tool_input`, `tool_response`.
- Session transcripts are **JSONL** under
  `~/.claude/projects/<encoded-path>/<session-id>.jsonl` — used both for the
  manual window snapshot and the later auto-scan.
- Hooks reference: https://code.claude.com/docs/en/hooks

## 7. Roadmap — learn first, then build (check off as you go)

> The manual path is buildable and useful by the end of Stage 1. Autonomous
> suggestion is the Stage 5 capstone, not v1.

### Stage 0 — Foundations: prompting + structured output + SDK

- [x] **Learn:** prompting + structured output + SDK — taught build-along
      (role/task/constraints/inputs prompt structure; system vs. user split;
      output shaping; token-based pricing).
- [x] **Build:** a `draft` call that takes `{content_type, intent,
    session_context?, research_notes?}` and returns a draft in one platform's
      format (X). 4 content types wired: progress_update, origin_narrative,
      learning_reflection, concept_explainer.
- [x] **Done when:** I can hand it a type + a one-line intent (+ optional pasted
      context) and get a usable first draft. ✅ verified on X for all 4 types.

### Stage 1 — Tool use / single agent (+ the manual trigger + research)

- [x] **Learn:** tool use + non-blocking queue design — taught build-along
      (the request→execute→return loop; tools as descriptions; gating tools by
      need; capture-as-file-reading; queue = non-blocking trigger).
- [x] **Build:** (a) manual trigger — `openly mark` snapshots a sanitized
      transcript window + intent and queues a job (non-blocking); `openly work`
      drains the queue async; `list`/`show` for review. (b) Tavily web_search
      tool, offered only when the content type needs research.
- [x] **Done when:** I trigger mid-session, keep working, and a researched,
      cited draft shows up for review. ✅ verified end-to-end.

### Evals — introduce here, keep forever

- [ ] **Learn:** Prompt evaluations (course #4) + cookbook `evaluation`.
- [ ] **Build:** a small labeled set of good/bad drafts across a few content
      types; a script that scores the current drafter against it.
- [ ] **Done when:** one command gives a quality number to compare after each
      later change.

### Stage 2 — RAG (style memory)

- [ ] **Learn:** cookbook RAG notebook.
- [ ] **Build:** store (draft → published) edit pairs + style rules; at draft
      time retrieve the most relevant ones and inject them. (Optionally also RAG
      over fetched research sources.)
- [ ] **Done when:** drafts measurably sound more like me vs. a no-retrieval
      baseline.

### Stage 3 — Claude skills

- [ ] **Learn:** Agent Skills overview, agentskills.io, `anthropics/skills`,
      "Introduction to agent skills" course.
- [ ] **Build:** turn the manual trigger into a proper skill; encode per-type and
      per-platform drafting guidance as skills with specific descriptions.
- [ ] **Done when:** the right skill loads on demand for the chosen type/platform.

### Stage 4 — MCP

- [ ] **Learn:** "Build an MCP server" quickstart + quickstart-resources repo.
- [ ] **Build:** expose trigger / capture / research / retrieve / publish as an
      MCP server (tools + read-only resources).
- [ ] **Done when:** an MCP client can drive the whole flow through the protocol.

### Stage 5 — Multi-agent + autonomous suggestion (capstone)

- [ ] **Learn:** re-read "Building Effective Agents" (prompt chaining, routing,
      parallelization, orchestrator-worker, evaluator-optimizer) + cookbook
      sub-agent notebooks.
- [ ] **Build:** a coordinator over per-platform drafters; AND the autonomous
      session-end scanner that _suggests_ missed moments (the safety net). This
      is where the high-precision auto-filter finally lives.
- [ ] **Done when:** the pipeline runs end to end and the eval score holds or
      improves vs. the single-agent version. (If multi-agent doesn't beat a
      single good agent, keep the simpler one — that's a valid finding.)

### Later / parked

- [ ] "Learn more" explainer: flow diagrams / concept visuals from a session.

## 8. Resources index

- Anthropic courses (API fundamentals, prompting, real-world prompting, evals,
  tool use): https://github.com/anthropics/courses
- Interactive Prompt Engineering Tutorial: https://github.com/anthropics/prompt-eng-interactive-tutorial
- Claude Cookbook (tool_use, agents, RAG, evaluation, sub-agents): https://github.com/anthropics/claude-cookbooks
- Building Effective Agents (essay): https://www.anthropic.com/research/building-effective-agents
- Agent Skills overview (docs): https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Agent Skills open standard: https://agentskills.io
- Example skills repo: https://github.com/anthropics/skills
- "Introduction to agent skills" course: https://anthropic.skilljar.com/introduction-to-agent-skills
- MCP — Build a server (quickstart): https://modelcontextprotocol.io/docs/develop/build-server
- MCP — quickstart code (servers + clients): https://github.com/modelcontextprotocol/quickstart-resources
- MCP — intro/announcement: https://www.anthropic.com/news/model-context-protocol
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks

## 9. Suggested stack (lightweight; not prescriptive)

- Language: Python (matches the courses/cookbook).
- Model calls: Anthropic SDK.
- Storage: SQLite or flat JSON for the content-job queue, edit pairs, and style
  rules; add a vector store only when the example/source library outgrows a
  prompt.
- Frameworks: NONE to start. Plain SDK + functions. Reach for an agent framework
  only at Stage 5 if simple sequencing genuinely breaks.
- Secrets in env vars; never commit transcripts or tokens.

## 10. How to work with me (instructions for Claude Code)

- Follow the roadmap in order; don't jump to a later stage's concept unless I ask.
- Treat content as **typed** (section 3). Don't assume the technical-article
  shape. Ask which type I want if it's ambiguous, and only research when the type
  calls for it.
- When we start a stage, give me a brief plain-English explanation of the concept
  _as it applies to what we're building_ (rough is fine), then build.
- Prefer the simplest implementation that teaches the concept; flag added
  complexity and why.
- Remind me to run the eval after each stage from Stage 2 on.
- Enforce section 4 — especially manual-first, non-blocking triggers, accuracy +
  citations for researched content, human-in-the-loop, no fine-tuning, privacy.
- Update the **Progress log** when a milestone's checkboxes are done.

## 11. Progress log

- Planning complete; this file written from the planning session.
- **Stage 0 complete.** Built the `draft` call (plain Anthropic SDK, no
  framework). Package layout: `openly/content_types.py` (typed content, source
  of truth), `openly/prompts.py` (layered prompt assembly + input fencing),
  `openly/cost.py` (per-call token→USD meter), `openly/draft.py` (the call),
  `scripts/draft_cli.py` (CLI). Targets X. Default model `claude-sonnet-4-6`.
  Research-needing types (concept_explainer) emit an "UNVERIFIED" banner until
  Stage 1 research lands. Verified working on all 4 types (~$0.002–0.004/draft).
- **Stage 1 complete.** (b) Research tool: `openly/research.py` (Tavily
  web_search + tool-use loop in `draft.py`), gated on `needs_research`. (a)
  Manual trigger + queue: `openly/capture.py` (finds this project's latest
  JSONL transcript, reads a window, redacts secrets), `openly/queue.py` (flat
  JSON job queue → non-blocking), `openly/worker.py` (drains queue, saves
  drafts to `data/drafts/<id>.md`), `scripts/openly_cli.py` (`mark`/`work`/
  `list`/`show`). `data/` is gitignored (privacy). Verified end-to-end.
- **Next action:** Evals — build a small labeled good/bad draft set across a few
  content types + a scoring script, so every later change (Stage 2 RAG onward)
  can be measured. Then Stage 2 (RAG style memory).

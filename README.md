# Career Copilot

Career Copilot is an India-focused government exam and recruitment operating system. The product is designed to help aspirants discover official opportunities, verify eligibility, track deadlines, prepare strategically, and eventually receive personalized study and career guidance.

The system is built around one core principle:

```text
Database = recruitment
Frontend language = exam
Foreign key = recruitment_id
Avoid = public.exams
```

## Product scope

Career Copilot is not only a notification tracker. It is intended to become an aspirant mission-control system covering:

- official recruitment discovery,
- deterministic eligibility matching,
- personalized recruitment alerts,
- application and deadline tracking,
- AI-assisted study planning,
- exam intelligence and PYQ analysis,
- marketplace/resource discovery,
- community and mentorship workflows.

## Current engineering priority

Governance baseline is now operational (Sprints 5/6/7 complete).

Current execution sequence:

1. Sprint 8 trust-redesign hardening (UX trust language + deterministic CTAs).
2. Documentation truth alignment (`README.md`, implementation checklist, feature registry).
3. Phase 8 community foundation (forum channels, moderation queue, reply notifications).
4. AI follow-up hardening (deterministic-to-LLM explanations with provenance, embeddings ETL).

See [`docs/operations/implementation-checklist.md`](docs/operations/implementation-checklist.md) and [`docs/product/roadmap.md`](docs/product/roadmap.md).

## Tech stack

- Next.js App Router
- TypeScript
- Supabase Postgres, Auth, RLS, Edge Functions
- Deno Edge Functions for scheduled jobs
- Razorpay billing foundation
- AI-assisted product modules planned through governed workflows

## Local development

```bash
npm install
npm run dev
```

Before merging or marking a task complete, run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

## Required reading for AI/code agents

Start with:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/00-ai-context.md`](docs/00-ai-context.md)
3. [`docs/operations/implementation-checklist.md`](docs/operations/implementation-checklist.md)
4. [`docs/engineering/domain-model.md`](docs/engineering/domain-model.md)
5. [`docs/operations/runbook.md`](docs/operations/runbook.md)
6. [`docs/engineering/admin-strategy.md`](docs/engineering/admin-strategy.md)

Do not use old phase reports as current implementation truth. Phase reports are historical context only.
## Documentation map

| Document | Purpose |
|---|---|
| `docs/00-ai-context.md` | Short context pack for ChatGPT, Claude, and other agents |
| `docs/feature-registry.md` | Feature-to-code implementation map |
| `docs/engineering/domain-model.md` | Canonical domain model and migration rules |
| `docs/operations/implementation-checklist.md` | Current implementation truth and P0/P1/P2 priorities |
| `docs/operations/runbook.md` | Operations, verification, migration, release, and troubleshooting steps |
| `docs/engineering/admin-strategy.md` | Governance-first admin and automation doctrine |
| `docs/engineering/source-intelligence.md` | Source, scraper, official/aggregator, trust, and RSS/JSON strategy |
| `docs/product/roadmap.md` | Broad product and architecture roadmap |
| `docs/decisions/` | Architecture Decision Records (ADRs) |
| `docs/history/` | Historical phase reports and chat summaries |

## Non-negotiable engineering rules

- `public.recruitments` is canonical.
- `exam` is allowed as UI language only.
- New tables and joins should use `recruitment_id`, `organization_id`, and `post_id`.
- Do not create `public.exams` to satisfy old code.
- Eligibility verdicts must come from deterministic logic.
- AI may propose, summarize, classify, and explain; AI must not independently publish, verify, or override official data.
- Aggregator sources are discovery inputs, not user-facing canonical truth.
- Admin mutations must be permission-protected and audit-logged.

## Design system

Career Copilot uses a serious, information-dense visual system: dark navy-black surfaces, warm gold accents, Playfair Display for display type, DM Sans for UI/body text, and DM Mono for tabular/code values.

See [`SKILL.md`](SKILL.md) and the Claude design frontend kit for implementation guidance.

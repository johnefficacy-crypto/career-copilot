<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Career Copilot agent rules

Career Copilot is an eligibility-first, recruitment-canonical operating system for Indian government-job aspirants.

Before editing code, read these files in order:

1. `docs/00-ai-context.md`
2. `docs/operations/implementation-checklist.md`
3. `docs/engineering/domain-model.md`
4. `docs/operations/runbook.md`
5. The module document relevant to the task, if one exists:
   - Admin/RBAC work → `docs/engineering/admin-strategy.md`
   - AI features → `docs/engineering/ai-strategy.md`
   - Community/forum/mentor → `docs/product/community-platform.md`
   - Monetization/tiers → `docs/product/monetization.md`
   - Product direction → `docs/product/vision.md` and `docs/product/roadmap.md`

## Non-negotiable domain rules

```text
Database = recruitment
Frontend language = exam
Foreign key = recruitment_id
Avoid = public.exams
```

- `public.recruitments` is canonical.
- `exam` is UI/product language only.
- New joins, migrations, and APIs should use `recruitment_id`, `organization_id`, and `post_id`.
- Do not create `public.exams` to satisfy old code.
- Do not introduce a parallel domain model without an explicit ADR.

## Governance rules

- Governance comes before automation.
- RBAC enforcement, audit visibility, and eligibility queue monitoring are P0.
- Admin route visibility is not enough; server actions must enforce permissions independently.
- Admin mutations must be audit-logged where the audit utility exists.
- AI may propose, summarize, classify, and explain. AI must not independently publish, verify, calculate final eligibility, or override deterministic results.

## Source and notification rules

- Official sources are canonical.
- Aggregators are discovery inputs, not user-facing truth.
- User-facing recruitment links should prefer official notification/apply URLs.
- Eligibility-triggered `new_match` notifications must come from deterministic engine verdicts, not blind broadcasts.

## Verification before marking work complete

Run or explicitly report inability to run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Also check for domain/governance regressions:

```bash
grep -R "public.exams\|from(\"exams\"\|from('exams'" app actions lib supabase --exclude-dir=node_modules || true
grep -R "is_admin\|profile?.is_admin" app actions lib components --exclude-dir=node_modules || true
```

## Documentation update rule

After any meaningful change, update the smallest relevant truth document:

- Current status/progress: `docs/operations/implementation-checklist.md`
- Feature-to-code mapping: `docs/feature-registry.md`
- Operational procedure: `docs/operations/runbook.md`
- Permanent architecture decision: `docs/decisions/ADR-*.md`
- AI handoff summary: `docs/00-ai-context.md` only when the top-level context changes

Historical phase reports and strategy chat summaries are in `docs/history/` — they are immutable context, not current implementation truth.

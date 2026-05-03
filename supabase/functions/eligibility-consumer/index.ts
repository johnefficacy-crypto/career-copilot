/**
 * supabase/functions/eligibility-consumer/index.ts
 *
 * Deno Edge Function — consumes eligibility_recompute_queue atomically.
 *
 * Key change (migration 024 follow-up):
 *   Previously this function fetched pending rows and marked them 'processing'
 *   in two separate statements, allowing concurrent invocations to double-claim
 *   the same row. Now it calls claim_eligibility_queue() — a single SQL
 *   transaction using FOR UPDATE SKIP LOCKED — so each row is claimed by
 *   exactly one invocation.
 *
 *   Failed jobs are retried with exponential backoff (capped at 60 min).
 *   attempt_count and last_error are stored for ops visibility.
 *
 * Deploy:
 *   supabase functions deploy eligibility-consumer
 *
 * Trigger (pg_cron, every 5 minutes):
 *   select net.http_post(
 *     url := 'https://<project>.supabase.co/functions/v1/eligibility-consumer',
 *     headers := '{"Authorization":"Bearer <service_role_key>"}',
 *     body := '{}'
 *   );
 *
 * Required env vars (set via `supabase secrets set`):
 *   SUPABASE_URL                  — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY     — auto-provided
 *   APP_BASE_URL                  — e.g. https://career-copilot.app (no trailing slash)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BATCH_SIZE   = 50
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? ""

Deno.serve(async (_req: Request) => {
  if (!APP_BASE_URL) {
    return Response.json(
      { error: "APP_BASE_URL env var not set on Edge Function" },
      { status: 500 },
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // ── 1. Atomically claim a batch via FOR UPDATE SKIP LOCKED ────────────────
  const { data: jobs, error: claimError } = await supabase.rpc(
    "claim_eligibility_queue",
    { p_limit: BATCH_SIZE },
  )

  if (claimError) {
    return Response.json({ error: claimError.message }, { status: 500 })
  }
  if (!jobs?.length) {
    return Response.json({ processed: 0, message: "queue empty" })
  }

  // ── 2. Dedupe by user — one POST per distinct user per batch ──────────────
  // The authoritative engine recomputes ALL posts for the user anyway, so
  // calling it once per (user, recruitment) is wasteful.
  const byUser = new Map<string, Array<{ id: string; attempt_count: number }>>()
  for (const job of jobs) {
    const list = byUser.get(job.user_id) ?? []
    list.push({ id: job.id, attempt_count: job.attempt_count })
    byUser.set(job.user_id, list)
  }

  let succeeded = 0
  let failed    = 0
  const errors: string[] = []

  for (const [userId, rows] of byUser) {
    const rowIds       = rows.map((r) => r.id)
    const maxAttempts  = Math.max(...rows.map((r) => r.attempt_count))

    try {
      const resp = await fetch(`${APP_BASE_URL}/api/eligibility/recompute`, {
        method: "POST",
        headers: {
          "content-type":  "application/json",
          "authorization": `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!resp.ok) {
        const detail = await resp.text().catch(() => "")
        throw new Error(`HTTP ${resp.status}: ${detail.slice(0, 300)}`)
      }

      await supabase
        .from("eligibility_recompute_queue")
        .update({ status: "completed", processed_at: new Date().toISOString(), last_error: null })
        .in("id", rowIds)

      succeeded += rows.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[eligibility-consumer] user=${userId} failed: ${msg}`)
      errors.push(`user ${userId}: ${msg}`)

      // Exponential backoff: 2^attempt minutes, capped at 60 minutes
      const backoffMs = Math.min(Math.pow(2, maxAttempts) * 60_000, 3_600_000)
      const nextAttempt = new Date(Date.now() + backoffMs).toISOString()

      await supabase
        .from("eligibility_recompute_queue")
        .update({
          status:          "pending",
          last_error:      msg,
          next_attempt_at: nextAttempt,
        })
        .in("id", rowIds)

      failed += rows.length
    }
  }

  return Response.json({
    processed: jobs.length,
    users:     byUser.size,
    succeeded,
    failed,
    errors:    errors.length ? errors : undefined,
  })
})

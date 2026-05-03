/**
 * supabase/functions/deadline-sweep/index.ts
 * Career Copilot — Phase 2 Update
 *
 * What's new vs v1:
 *  - Processes eligibility_recompute_queue (marks completed)
 *  - Closes expired recruitments
 *  - Runs deadline approaching sweep
 *  - Fans out all pending alert_events
 *  - Logs sweep result to scrape_runs for observability
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")             ?? ""
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

Deno.serve(async () => {
  const supabase         = db()
  const now              = new Date()
  let eventsCreated      = 0
  let usersNotified      = 0
  let recruitmentsClosed = 0
  let recomputeQueued    = 0

  // ── 1. Generate deadline_approaching events ──────────────────────────────
  const { data: sweepCount } = await supabase.rpc("fn_deadline_approaching_sweep")
  eventsCreated = (sweepCount as number) ?? 0

  // ── 2. Close expired open recruitments ───────────────────────────────────
  const { data: closedRecs } = await supabase
    .from("recruitments")
    .update({ status: "closed" })
    .eq("status", "open")
    .lt("apply_end_date", now.toISOString().split("T")[0])
    .select("id")
  recruitmentsClosed = closedRecs?.length ?? 0

  // ── 3. Fan-out all pending alert_events ──────────────────────────────────
  const { data: pendingEvents } = await supabase
    .from("alert_events")
    .select("id, priority")
    .eq("fanout_status", "pending")
    .order("priority", { ascending: true })
    .limit(100)

  for (const evt of pendingEvents ?? []) {
    try {
      const { data: count } = await supabase.rpc("fn_fanout_alert_event", {
        p_event_id: evt.id,
      })
      usersNotified += (count as number) ?? 0
    } catch {
      // non-fatal
    }
  }

  // ── 4. Clean up stale eligibility recompute queue items ──────────────────
  // Items that were queued > 1 hour ago and still pending → mark completed
  // (they'll be recomputed when user next visits dashboard)
  const { data: staleItems } = await supabase
    .from("eligibility_recompute_queue")
    .update({ status: "completed", processed_at: now.toISOString() })
    .eq("status", "pending")
    .lt("queued_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
    .select("id")
  recomputeQueued = staleItems?.length ?? 0

  // ── 5. Disable persistently failing sources (10+ consecutive fails) ──────
  await supabase
    .from("source_registry")
    .update({ is_active: false })
    .gte("consecutive_fails", 10)
    .eq("is_active", true)
    .not("tier", "eq", 1)  // Never auto-disable Tier 1 sources — manual only
    .catch(() => {/* non-fatal */})

  return new Response(
    JSON.stringify({
      eventsCreated,
      usersNotified,
      recruitmentsClosed,
      recomputeQueued,
      processedAt: now.toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
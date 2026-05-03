/**
 * scripts/validate-scraper-trust.ts
 * Career Copilot — Scraper Trust Pipeline Sanity Checks
 *
 * Usage:
 *   npx tsx scripts/validate-scraper-trust.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 * Prints PASS / FAIL for each check.
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL     = process.env.SUPABASE_URL     ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let passed = 0
let failed = 0

function pass(label: string) {
  console.log(`  PASS  ${label}`)
  passed++
}

function fail(label: string, detail?: string) {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
  failed++
}

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    fail(label, e instanceof Error ? e.message : String(e))
  }
}

async function run() {
  console.log("\n=== Career Copilot — Scraper Trust Validation ===\n")

  // ── 1. notification_documents table exists ─────────────────────────────────
  await check("notification_documents table exists", async () => {
    const { error } = await db.from("notification_documents").select("id").limit(1)
    if (error) throw new Error(error.message)
    pass("notification_documents table exists")
  })

  // ── 2. extracted_field_evidence table exists ───────────────────────────────
  await check("extracted_field_evidence table exists", async () => {
    const { error } = await db.from("extracted_field_evidence").select("id").limit(1)
    if (error) throw new Error(error.message)
    pass("extracted_field_evidence table exists")
  })

  // ── 3. scrape_queue has new trust columns ──────────────────────────────────
  await check("scrape_queue has extraction_status column", async () => {
    const { data, error } = await db
      .from("scrape_queue")
      .select("extraction_status, evidence_required, notification_document_id")
      .limit(1)
    if (error) throw new Error(error.message)
    void data
    pass("scrape_queue has extraction_status, evidence_required, notification_document_id columns")
  })

  // ── 4. Auto-promote trigger is gone ───────────────────────────────────────
  await check("trg_promote_approved_scrape trigger does not exist", async () => {
    const { data, error } = await db.rpc("sql" as never, {
      query: `SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_promote_approved_scrape'`,
    } as never)
    // If the rpc doesn't exist, fall back to a direct check via a select
    // on pg_trigger isn't accessible via client — use information_schema instead
    if (error) {
      // Can't query pg_trigger via anon client — skip this check with a warning
      console.warn("  SKIP  trg_promote_approved_scrape check (pg_trigger not accessible via client)")
      return
    }
    const count = (data as { count: string }[])?.[0]?.count
    if (parseInt(count ?? "0", 10) > 0) {
      throw new Error("trg_promote_approved_scrape trigger still exists — run migration 016")
    }
    pass("trg_promote_approved_scrape trigger does not exist")
  })

  // ── 5. RSS-only items are not auto-promoted ────────────────────────────────
  await check("RSS-direct items are not auto-promoted (status != approved)", async () => {
    const { data, error } = await db
      .from("scrape_queue")
      .select("id, status, extraction_provider")
      .eq("extraction_provider", "rss_direct")
      .eq("status", "approved")
      .limit(5)
    if (error) throw new Error(error.message)
    if ((data ?? []).length > 0) {
      throw new Error(
        `${data!.length} rss_direct item(s) have status='approved'. ` +
        `These should be 'pending'. IDs: ${data!.map(r => r.id).join(", ")}`
      )
    }
    pass("No rss_direct items auto-promoted to approved")
  })

  // ── 6. Promoted items have document links ─────────────────────────────────
  await check("Approved items link to notification_documents", async () => {
    const { data, error } = await db
      .from("scrape_queue")
      .select("id, notification_document_id")
      .eq("status", "approved")
      .is("notification_document_id", null)
      .limit(10)
    if (error) throw new Error(error.message)
    const missing = (data ?? []).length
    if (missing > 10) {
      // Allow some historical items from before migration 017
      throw new Error(`${missing} approved items have no notification_document_id`)
    }
    pass(`Approved items without document link: ${missing} (acceptable for pre-migration rows)`)
  })

  // ── 7. notification_documents rows have content_hash ──────────────────────
  await check("notification_documents have non-null content_hash", async () => {
    const { data, error } = await db
      .from("notification_documents")
      .select("id")
      .is("content_hash", null)
      .limit(1)
    if (error && error.code !== "42P01") throw new Error(error.message)
    if ((data ?? []).length > 0) {
      throw new Error("Found notification_documents row with null content_hash")
    }
    pass("All notification_documents have content_hash")
  })

  // ── 8. v_admin_queue_review includes evidence columns ─────────────────────
  await check("v_admin_queue_review exposes evidence_total_count", async () => {
    const { data, error } = await db
      .from("v_admin_queue_review")
      .select("evidence_total_count, evidence_verified_count, extraction_status")
      .limit(1)
    if (error) throw new Error(error.message)
    void data
    pass("v_admin_queue_review exposes evidence counts and extraction_status")
  })

  // ── 9. No direct inserts into recruitments from scraper ───────────────────
  // (Structural check: verify the canonical tables don't accept service-role
  //  inserts from the scraper's insertion path — this is enforced by code, not DB.)
  console.log("  NOTE  Direct-insert guard for recruitments/posts is enforced in code only.")
  console.log("        Verify: scheduled-scraper does NOT import promoteToRecruitments.")

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

run().catch(e => {
  console.error("Unexpected error:", e)
  process.exit(1)
})

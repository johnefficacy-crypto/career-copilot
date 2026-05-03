/**
 * lib/db/notifications.ts
 * Career Copilot — Notification & Scraper DB layer
 *
 * ARCHITECTURE RULES (enforced here):
 *  1. source_registry CRUD → lib/db/source-registry.ts  (never here)
 *  2. SourceRegistryEntry type → re-exported from source-registry (never duplicated)
 *  3. All types → @/types/notifications (never hand-typed DB shapes here)
 *  4. No `as any` — use explicit casts with comments when necessary
 *  5. Auth guards belong in actions/, not here
 *
 * What this file owns:
 *  - notification_alerts / v_notification_feed queries
 *  - scrape_queue queries
 *  - scrape_runs queries
 *  - source_health_metrics queries (two-query merge until FK migration runs)
 *  - alert_events fan-out
 *  - user notification preferences
 *  - tracked_recruitments
 *  - Legacy scrape_sources helpers (to be removed in Phase 3)
 */

import { createClient } from "@/utils/supabase/server"
import type { Database } from "@/types/supabase"
import type {
  NotificationAlert,
  ScrapeRun,
  ScrapeQueueItem,
  ScrapeSource,
  QueueReviewItem,
  FieldEvidence,
  ScraperStats,
  SourceHealthSnapshot,
  SourceTier,
  UserNotificationPrefs,
  GroupedNotification,
} from "@/types/notifications"
import type { ExtractedRecruitment } from "@/types/scraping"

// ─── Re-export SourceRegistryEntry from the authoritative file ─────────────────
// NEVER duplicate this type here — lib/db/source-registry.ts is the single source.
export type { SourceRegistryEntry } from "@/lib/db/source-registry"

// ─── Generated DB insert types ────────────────────────────────────────────────
type ScrapeSourceInsert = Database["public"]["Tables"]["scrape_sources"]["Insert"]

// =============================================================================
// USER NOTIFICATIONS
// =============================================================================

export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean; offset?: number } = {}
): Promise<NotificationAlert[]> {
  const supabase = await createClient()

  // v_notification_feed is created by supabase/migrations/notification_feed_view.sql
  // If the view doesn't exist yet, this query will throw a helpful error.
  let query = supabase
    .from("v_notification_feed")
    .select("*")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(opts.limit ?? 50)

  if (opts.unreadOnly) query = query.eq("is_read", false)
  if (opts.offset)     query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1)

  const { data, error } = await query
  if (error) throw new Error(`getUserNotifications: ${error.message}`)
  return (data ?? []) as unknown as NotificationAlert[]
}


export async function getGroupedUserNotifications(
  userId: string,
  opts: { limit?: number } = {}
): Promise<GroupedNotification[]> {
  const alerts = await getUserNotifications(userId, { limit: Math.max((opts.limit ?? 50) * 4, 100) })
  const map = new Map<string, GroupedNotification>()

  for (const a of alerts) {
    const current = map.get(a.recruitment_id)
    if (!current) {
      map.set(a.recruitment_id, {
        recruitment_id: a.recruitment_id,
        recruitment_name: a.recruitment_name,
        org_name: a.org_name ?? null,
        latest_sent_at: a.sent_at,
        latest_alert_type: a.alert_type,
        latest_priority: a.priority,
        latest_is_read: a.is_read,
        unread_count: a.is_read ? 0 : 1,
        total_events: 1,
        days_to_deadline: a.days_to_deadline ?? null,
      })
      continue
    }

    current.total_events += 1
    if (!a.is_read) current.unread_count += 1
    if (new Date(a.sent_at).getTime() > new Date(current.latest_sent_at).getTime()) {
      current.latest_sent_at = a.sent_at
      current.latest_alert_type = a.alert_type
      current.latest_priority = a.priority
      current.latest_is_read = a.is_read
      current.days_to_deadline = a.days_to_deadline ?? current.days_to_deadline
    }
  }

  return [...map.values()]
    .sort((a, b) => new Date(b.latest_sent_at).getTime() - new Date(a.latest_sent_at).getTime())
    .slice(0, opts.limit ?? 50)
}

// =============================================================================
// ALERT UPSERT
// =============================================================================

export type AlertUpsertInput = {
  user_id:        string
  recruitment_id: string
  alert_type:     "new_match" | "deadline" | "update" | "profile_blocker"
  priority:       number
  explanation:    string | null
  sent_at?:       string
}

/**
 * upsertNotificationAlerts — insert or update alert rows.
 *
 * Uses onConflict on (user_id, recruitment_id, alert_type) so that re-running
 * eligibility for the same user updates the existing alert's priority and
 * explanation rather than silently ignoring the duplicate.
 *
 * Requires migration 026 to have created the canonical constraint name
 * "notification_alerts_user_recruitment_type_key".
 */
export async function upsertNotificationAlerts(
  alerts: AlertUpsertInput[]
): Promise<void> {
  if (!alerts.length) return
  const supabase = await createClient()
  const { error } = await supabase
    .from("notification_alerts")
    .upsert(alerts, {
      onConflict:       "user_id,recruitment_id,alert_type",
      ignoreDuplicates: false,
    })
  if (error) throw new Error(`upsertNotificationAlerts: ${error.message}`)
}

// =============================================================================
// NOTIFICATION READINESS DIAGNOSTIC
// =============================================================================

export interface NotificationReadiness {
  onboardingCompleted:          boolean
  hasDob:                       boolean
  hasCategory:                  boolean
  hasDomicile:                  boolean
  hasEducation:                 boolean
  hasPreferences:               boolean
  hasTargetExams:               boolean
  eligibilityRowsCount:         number
  notificationRowsCount:        number
  matchingOpenRecruitmentsCount: number
  blockers:                     string[]
  recommendedActions:           string[]
}

export async function getNotificationReadiness(userId: string): Promise<NotificationReadiness> {
  const supabase = await createClient()

  const [profileRes, educationRes, prefsRes, eligRes, alertsRes, recruitmentsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("onboarding_completed, dob, category, domicile_state")
        .eq("id", userId)
        .single(),
      supabase
        .from("aspirant_education")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_completed", true),
      supabase
        .from("aspirant_preferences")
        .select("target_exams")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("eligibility_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("notification_alerts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("recruitments")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "open"]),
    ])

  const p = profileRes.data

  const onboardingCompleted          = p?.onboarding_completed ?? false
  const hasDob                       = !!p?.dob
  const hasCategory                  = !!p?.category
  const hasDomicile                  = !!p?.domicile_state
  const hasEducation                 = (educationRes.count ?? 0) > 0
  const hasPreferences               = !!prefsRes.data
  const hasTargetExams               = Array.isArray(prefsRes.data?.target_exams) &&
                                       (prefsRes.data.target_exams as unknown[]).length > 0
  const eligibilityRowsCount         = eligRes.count ?? 0
  const notificationRowsCount        = alertsRes.count ?? 0
  const matchingOpenRecruitmentsCount = recruitmentsRes.count ?? 0

  const blockers: string[]           = []
  const recommendedActions: string[] = []

  if (!onboardingCompleted) {
    blockers.push("Profile setup is not complete.")
    recommendedActions.push("Finish your onboarding profile to activate eligibility matching.")
  }
  if (!hasDob) {
    blockers.push("Date of birth is missing — required for age-based eligibility rules.")
    recommendedActions.push("Add your date of birth in Profile settings.")
  }
  if (!hasCategory) {
    blockers.push("Reservation category (General / OBC / SC / ST / EWS) is not set.")
    recommendedActions.push("Set your category in Profile settings to apply relaxation rules correctly.")
  }
  if (!hasEducation) {
    blockers.push("No completed education record found — exams require a minimum qualification.")
    recommendedActions.push("Add your highest completed qualification in Profile → Education.")
  }
  if (!hasDomicile) {
    blockers.push("Domicile state is missing — required for state-level and domicile-restricted exams.")
    recommendedActions.push("Add your home/domicile state in Profile settings.")
  }

  if (blockers.length === 0) {
    if (!hasTargetExams) {
      blockers.push("No target exams selected — eligibility matching is not narrowed to your goals.")
      recommendedActions.push("Select target exams in Profile → Preferences.")
    }
    if (eligibilityRowsCount === 0) {
      blockers.push("Eligibility check has not run yet — your profile was recently completed.")
      recommendedActions.push("Eligibility is usually computed within a few minutes. Check back shortly.")
    } else if (notificationRowsCount === 0) {
      if (matchingOpenRecruitmentsCount === 0) {
        blockers.push("No officially verified recruitments are currently open.")
        recommendedActions.push("Notifications will appear automatically when new official vacancies are approved.")
      } else {
        blockers.push("No open recruitments currently match your profile criteria.")
        recommendedActions.push("Review your category, education, and domicile settings. Broaden your target exam list to see more matches.")
      }
    }
  }

  return {
    onboardingCompleted,
    hasDob,
    hasCategory,
    hasDomicile,
    hasEducation,
    hasPreferences,
    hasTargetExams,
    eligibilityRowsCount,
    notificationRowsCount,
    matchingOpenRecruitmentsCount,
    blockers,
    recommendedActions,
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("notification_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
  if (error) throw new Error(`getUnreadCount: ${error.message}`)
  return count ?? 0
}

export async function markAlertRead(alertId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("notification_alerts")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("user_id", userId)
  if (error) throw new Error(`markAlertRead: ${error.message}`)
}

export async function markAllAlertsRead(userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("notification_alerts")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false)
  if (error) throw new Error(`markAllAlertsRead: ${error.message}`)
}

/**
 * Seed initial notification_alerts for a newly onboarded user.
 *
 * Called once after finishOnboarding(). The authoritative seeding happens
 * inside `runEligibilityForUser`, which finishOnboarding() also calls — the
 * engine writes eligibility_results AND emits `new_match` alerts for every
 * recruitment it verifies as eligible or conditional, with explanation
 * flags derived from tracked_recruitments and the engine's own verdict.
 *
 * This function exists as a defensive top-up: if the engine ran but missed
 * any eligible/conditional recruitment (e.g. because the row was added
 * between the engine's post scan and this call), we still insert `new_match`
 * alerts for those. We NO LONGER fall back to "seed every open recruitment"
 * when eligibility_results is empty — that was the P0 over-claim flagged by
 * the April 19 code review (it showed users recruitments for UPSC posts they
 * have no qualifications for, advertised as "new match for you").
 *
 * Returns the number of alerts inserted.
 */
export async function seedNotificationsForNewUser(userId: string): Promise<number> {
  const supabase = await createClient()

  // Eligibility-first: only seed alerts for recruitments the engine has
  // already verified as eligible or conditional for this user.
  const { data: eligibilityResults, error: elErr } = await supabase
    .from("eligibility_results")
    .select("recruitment_id, is_eligible, is_conditional")
    .eq("user_id", userId)

  if (elErr) {
    console.error("[seedNotificationsForNewUser] eligibility read:", elErr.message)
    return 0
  }

  // Dedupe: one alert per recruitment, strict eligibility wins over conditional.
  const verdictByRec = new Map<string, boolean>() // true = eligible, false = conditional only
  for (const r of eligibilityResults ?? []) {
    const rid = r.recruitment_id as string | null
    if (!rid) continue
    if (r.is_eligible) {
      verdictByRec.set(rid, true)
    } else if (r.is_conditional && !verdictByRec.has(rid)) {
      verdictByRec.set(rid, false)
    }
  }

  if (verdictByRec.size === 0) {
    // No eligible/conditional recruitments — that's fine. The feed can be
    // empty. It will fill up as the scraper approves new recruitments and
    // the eligibility consumer re-runs the engine per user.
    return 0
  }

  // Load tracked set so we can populate the is_tracked explanation flag.
  const { data: trackedRows } = await supabase
    .from("tracked_recruitments")
    .select("recruitment_id")
    .eq("user_id", userId)

  const trackedSet = new Set(
    (trackedRows ?? []).map((t) => t.recruitment_id as string),
  )


  const { data: prefs } = await supabase
    .from("aspirant_preferences")
    .select("target_exams, preferred_sectors")
    .eq("user_id", userId)
    .maybeSingle()

  const { data: recMeta } = await supabase
    .from("recruitments")
    .select("id, name, organizations(type)")
    .in("id", Array.from(verdictByRec.keys()))

  const targetExams = ((prefs?.target_exams as string[] | null) ?? []).map((x) => x.toLowerCase())
  const preferredSectors = ((prefs?.preferred_sectors as string[] | null) ?? []).map((x) => x.toLowerCase())
  const metaMap = new Map((recMeta ?? []).map((r: { id: string; name?: string | null; organizations?: { type?: string | null } | null }) => [r.id as string, r]))

  const now = new Date().toISOString()
  const inserts = Array.from(verdictByRec.entries()).map(
    ([recruitmentId, isEligibleStrict]) => ({
      user_id:        userId,
      alert_type:     "new_match" as const,
      is_read:        false,
      sent_at:        now,
      priority:       3 as const,
      recruitment_id: recruitmentId,
      alert_event_id: null,
      // `event_type` is NOT a column on notification_alerts — it's exposed
      // by v_notification_feed. Setting it here used to throw in some dev
      // DBs that didn't have the stray column from an aborted migration.
      explanation: {
        is_tracked:     trackedSet.has(recruitmentId),
        is_eligible:    isEligibleStrict === true,
        matched_exam:   (() => { const m = metaMap.get(recruitmentId); const n = String(m?.name ?? "").toLowerCase(); return targetExams.some((t) => n.includes(t)); })(),
        matched_sector: (() => { const m = metaMap.get(recruitmentId); const orgType = String((m?.organizations as { type?: string } | null)?.type ?? "").toLowerCase(); return preferredSectors.includes(orgType); })(),
        matched_type:   false,
      },
    }),
  )

  const { data: inserted, error } = await supabase
    .from("notification_alerts")
    .upsert(inserts, {
      onConflict: "user_id,recruitment_id,alert_type",
      ignoreDuplicates: true,
    })
    .select("id")

  if (error) {
    console.error("[seedNotificationsForNewUser]", error.message)
    return 0
  }

  return inserted?.length ?? 0
}

// =============================================================================
// USER NOTIFICATION PREFERENCES
// =============================================================================

export async function getUserNotifPrefs(userId: string): Promise<UserNotificationPrefs | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(`getUserNotifPrefs: ${error.message}`)
  return data as UserNotificationPrefs | null
}

export async function upsertUserNotifPrefs(
  userId: string,
  prefs: Partial<Omit<UserNotificationPrefs, "user_id">>
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("notification_preferences")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({ user_id: userId, ...prefs } as any, { onConflict: "user_id" })
  if (error) throw new Error(`upsertUserNotifPrefs: ${error.message}`)
}

// =============================================================================
// TRACKED RECRUITMENTS
// =============================================================================

export async function trackRecruitment(userId: string, recruitmentId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tracked_recruitments")
    .upsert({ user_id: userId, recruitment_id: recruitmentId }, { ignoreDuplicates: true })
  if (error) throw new Error(`trackRecruitment: ${error.message}`)
}

export async function untrackRecruitment(userId: string, recruitmentId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tracked_recruitments")
    .delete()
    .eq("user_id",        userId)
    .eq("recruitment_id", recruitmentId)
  if (error) throw new Error(`untrackRecruitment: ${error.message}`)
}

// =============================================================================
// ALERT EVENTS FAN-OUT
// =============================================================================

export async function fanOutNotificationAlerts(recruitmentId: string): Promise<number> {
  const supabase = await createClient()
  // fn_fanout_for_recruitment does not exist in the DB schema.
  // The available RPC is fn_fanout_alert_event(p_event_id).
  // Fan out all pending alert_events for this recruitment one by one.
  const { data: events, error: evErr } = await supabase
    .from("alert_events")
    .select("id")
    .eq("recruitment_id", recruitmentId)
    .eq("fanout_status",  "pending")
    .limit(50)
  if (evErr) throw new Error(`fanOutNotificationAlerts: ${evErr.message}`)

  let total = 0
  for (const event of events ?? []) {
    const { data } = await supabase
      .rpc("fn_fanout_alert_event", { p_event_id: event.id })
    total += (data as number | null) ?? 0
  }
  return total
}

// =============================================================================
// SCRAPE QUEUE
// =============================================================================

export async function getScrapeQueue(
  status?: ScrapeQueueItem["status"],
  limit = 50
): Promise<QueueReviewItem[]> {
  const supabase = await createClient()

  // ── Try the enriched view first (v_admin_queue_review from migration 009) ──
  // If the view doesn't exist yet (pre-migration DB), fall back to a direct
  // scrape_queue query that extracts title/org from the extracted_data JSONB.
  // Supabase returns code "42P01" (PGRST116/42P01) when relation does not exist.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewQuery = (supabase as any)
      .from("v_admin_queue_review")
      .select("*")
      .order("scraped_at", { ascending: false })
      .limit(limit)
    if (status) viewQuery = viewQuery.eq("status", status)
    const { data: viewData, error: viewErr } = await viewQuery
    if (!viewErr) {
      return (viewData ?? []) as QueueReviewItem[]
    }
    // If error.code is not a missing-relation error, rethrow so real errors surface
    const code: string = viewErr?.code ?? ""
    if (code !== "42P01" && code !== "PGRST116" && !viewErr.message?.includes("does not exist")) {
      throw new Error(`getScrapeQueue (view): ${viewErr.message}`)
    }
    // Fall through to direct table query
  }

  // ── Fallback: query scrape_queue directly ────────────────────────────────
  // Extracts title + org_name from the extracted_data JSONB.
  // The view fields fingerprint / obs_status / canonical_id / canonical_name
  // (from source_observations JOIN) are null in the fallback — UI handles nulls.
  let query = supabase
    .from("scrape_queue")
    .select("id,source_url,source_name,confidence_score,data_quality_score,status,scraped_at,reviewed_at,reviewer_notes,extracted_data")
    .order("scraped_at", { ascending: false })
    .limit(limit)
  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) throw new Error(`getScrapeQueue: ${error.message}`)

  return (data ?? []).map((row) => {
    const ext = (row.extracted_data ?? {}) as Record<string, unknown>
    return {
      id:                 row.id,
      source_url:         row.source_url,
      source_name:        row.source_name ?? "",
      confidence_score:   row.confidence_score ?? 0,
      data_quality_score: (row.data_quality_score as number | null) ?? null,
      status:             row.status as ScrapeQueueItem["status"],
      scraped_at:         row.scraped_at,
      reviewed_at:        row.reviewed_at ?? null,
      reviewer_notes:     row.reviewer_notes ?? null,
      // Extracted from JSONB
      title:              (ext.title as string | null)               ?? null,
      org_name:           (ext.organization_name as string | null)   ?? null,
      apply_end_date:     (ext.apply_end_date as string | null)      ?? null,
      total_vacancies:    ext.total_vacancies != null ? String(ext.total_vacancies) : null,
      // Fields from source_observations JOIN — not available in direct fallback
      fingerprint:        null,
      obs_status:         null,
      canonical_id:       null,
      canonical_name:     null,
      run_started_at:     null,
      // Trust pipeline — not available in direct table fallback
      extraction_status:         null,
      evidence_required:         true,
      notification_document_id:  null,
      extraction_provider:       null,
      extraction_model:          null,
      evidence_total_count:      null,
      evidence_verified_count:   null,
      evidence_rejected_count:   null,
      evidence_missing_count:    null,
    } satisfies QueueReviewItem
  })
}

// =============================================================================
// SCRAPE ITEM PROMOTION VALIDATION
// =============================================================================

/**
 * Validates a scrape_queue item before promotion to canonical recruitments.
 *
 * Rules enforced:
 *  - Row must exist and have extraction_status = 'verified' (or evidence_required = false)
 *  - notification_document_id must be set
 *  - extracted_data must have title, organization_name, official_notification_url
 *  - posts must be a non-empty array for eligibility-grade promotion
 *  - Each post with age/education data must have at least one verified evidence row
 *  - Required fields must have extracted_field_evidence rows (reviewer_status = 'verified')
 *
 * Throws with a detailed message listing every missing requirement.
 */
export async function validateScrapeItemForPromotion(itemId: string): Promise<void> {
  const supabase = await createClient()

  const { data: item, error: fetchErr } = await supabase
    .from("scrape_queue")
    .select("*")
    .eq("id", itemId)
    .single()

  if (fetchErr || !item) throw new Error(`validateScrapeItemForPromotion: row not found ${itemId}`)

  const missing: string[] = []
  const ext = (item.extracted_data ?? {}) as Record<string, unknown>
  const row = item as unknown as Record<string, unknown>

  // evidence_required=false means this item was manually curated — skip evidence checks
  if (item.evidence_required !== false) {
    // Must have a linked document
    if (!item.notification_document_id) {
      missing.push("notification_document_id is null — no source document linked")
    }

    // Must be marked verified (or this is an explicit override by admin)
    if (item.extraction_status !== "verified") {
      missing.push(`extraction_status='${item.extraction_status}' — must be 'verified' before promotion`)
    }

    // Aggregator-origin guard:
    // If discovered from an aggregator source, the extracted official URL must
    // resolve to a different host than the aggregator/listing host. This blocks
    // promoting aggregator/listing URLs as canonical truth.
    if (item.source_url) {
      const { data: src } = await supabase
        .from("source_registry")
        .select("source_type, official_url")
        .or(`official_url.eq.${item.source_url},notification_url.eq.${item.source_url},rss_url.eq.${item.source_url}`)
        .maybeSingle()

      const sourceType = src?.source_type ?? null
      if (sourceType === "aggregator") {
        const officialUrl = typeof ext.official_notification_url === "string"
          ? ext.official_notification_url.trim()
          : ""

        const toHost = (raw: string | null | undefined): string | null => {
          if (!raw) return null
          try {
            const withProto = raw.startsWith("http") ? raw : `https://${raw}`
            return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase()
          } catch {
            return null
          }
        }

        const aggregatorHost =
          toHost(item.source_url) ??
          toHost(src?.official_url ?? null)
        const officialHost = toHost(officialUrl)

        if (!officialHost) {
          missing.push("aggregator item has invalid official_notification_url host")
        } else if (aggregatorHost && officialHost === aggregatorHost) {
          missing.push(
            `aggregator item official_notification_url host '${officialHost}' matches aggregator host; resolve first-party official notification URL before promotion`
          )
        }
      }
    }

    // Explicit migration-043 gate: when official confirmation is tracked as not
    // resolved, never allow promotion.
    if (row.official_source_resolved === false) {
      missing.push("official_source_resolved=false — resolve first-party official source before promotion")
    }
  }

  // Required fields always checked
  if (!ext.title || String(ext.title).trim().length < 3) {
    missing.push("extracted_data.title is missing or too short")
  }
  if (!ext.organization_name || String(ext.organization_name).trim().length < 2) {
    missing.push("extracted_data.organization_name is missing")
  }
  if (!ext.official_notification_url) {
    missing.push("extracted_data.official_notification_url is missing")
  }
  const posts = Array.isArray(ext.posts) ? ext.posts as Record<string, unknown>[] : []
  if (posts.length === 0) {
    missing.push("extracted_data.posts is empty — eligibility engine requires post-level data")
  }

  // For items with evidence_required, check evidence row coverage on critical fields
  if (item.evidence_required !== false && item.notification_document_id) {
    const { data: evidenceRows } = await supabase
      .from("extracted_field_evidence")
      .select("field_name, reviewer_status, entity_type")
      .eq("scrape_queue_id", itemId)

    const verifiedFields = new Set(
      (evidenceRows ?? [])
        .filter(e => e.reviewer_status === "verified")
        .map(e => e.field_name as string)
    )

    const requiredFields = ["title", "organization_name", "apply_end_date"]
    for (const f of requiredFields) {
      if (ext[f] && !verifiedFields.has(f)) {
        missing.push(`field '${f}' has no verified evidence row`)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `validateScrapeItemForPromotion failed for ${itemId}:\n` +
      missing.map(m => `  • ${m}`).join("\n")
    )
  }
}

export async function approveScrapeItem(
  itemId: string, reviewerId: string, notes?: string
): Promise<void> {
  const supabase = await createClient()

  // ── 1. Load queue row ──────────────────────────────────────────────────────
  const { data: item, error: fetchErr } = await supabase
    .from("scrape_queue")
    .select("*")
    .eq("id", itemId)
    .single()

  if (fetchErr || !item) throw new Error(`approveScrapeItem: row not found ${itemId}`)

  // ── 2. Idempotency: already promoted? ──────────────────────────────────────
  // duplicate_of stores the promoted recruitment_id after first approval
  if (item.status === "approved" && item.duplicate_of) return

  // ── 3. Validate ────────────────────────────────────────────────────────────
  if (!["pending", "reviewing"].includes(item.status)) {
    throw new Error(`approveScrapeItem: cannot approve item in status '${item.status}'`)
  }

  // ── 3b. Evidence validation ────────────────────────────────────────────────
  // Run evidence validation when evidence_required=true (the default).
  // On failure: mark extraction_status='needs_review' and rethrow so the
  // admin UI shows exactly what evidence is missing.
  if (item.evidence_required !== false) {
    try {
      await validateScrapeItemForPromotion(itemId)
    } catch (validationErr) {
      await supabase
        .from("scrape_queue")
        .update({
          status:             "reviewing",
          extraction_status:  "needs_review",
          reviewer_id:        reviewerId,
          reviewer_notes:     (notes ? notes + "\n" : "") +
                              (validationErr instanceof Error ? validationErr.message : String(validationErr)),
          reviewed_at:        new Date().toISOString(),
        })
        .eq("id", itemId)
      throw validationErr
    }
  }
 
  // ── 4. Promote to canonical recruitments ──────────────────────────────────
  // promoteToRecruitments now THROWS on real errors. We let those bubble to the
  // admin UI so the reviewer sees the actual database error (e.g. missing
  // unique constraint, CHECK violation, RLS denial) instead of a ghost approval.
  const { promoteToRecruitments } = await import("@/lib/scraping/runner")
  if (!item.extracted_data) throw new Error(`approveScrapeItem: no extracted_data on item ${itemId}`)

  let recruitmentId: string | null = null
  try {
    recruitmentId = await promoteToRecruitments(
      item.extracted_data as unknown as ExtractedRecruitment,
      supabase
    )
  } catch (err) {
    // Mark the row 'reviewing' with the error note, then re-throw so the admin
    // UI shows the real error. DO NOT mark 'approved'.
    await supabase
      .from("scrape_queue")
      .update({
        status:            "reviewing",
        extraction_status: "needs_review",
        reviewer_id:       reviewerId,
        reviewer_notes:    (notes ?? "") + ` [promotion failed: ${err instanceof Error ? err.message : String(err)}]`,
        reviewed_at:       new Date().toISOString(),
      })
      .eq("id", itemId)
    throw err
  }

  if (!recruitmentId) {
    throw new Error(`approveScrapeItem: promotion returned no recruitment_id for item ${itemId}`)
  }

  // ── 5. Mark approved (+ store recruited_id in duplicate_of for idempotency)
  const { error: updateErr } = await supabase
    .from("scrape_queue")
    .update({
      status:             "approved",
      extraction_status:  "verified",
      reviewer_id:        reviewerId,
      reviewer_notes:     notes ?? null,
      reviewed_at:        new Date().toISOString(),
      duplicate_of:       recruitmentId,
    })
    .eq("id", itemId)

  if (updateErr) throw new Error(`approveScrapeItem update: ${updateErr.message}`)

  // ── 6. Record alert_event for audit trail ────────────────────────────────────
  //
  // Phase 3B follow-up (P0 — April 19 code review fix):
  //   We no longer blind-broadcast a `new_match` notification_alert to every
  //   onboarded user with every explanation flag set to false. That was the
  //   "we over-claim that a new match is personalised" bug the reviewer
  //   flagged — users saw "new match for you" rows that had nothing to do
  //   with their profile.
  //
  //   The authoritative path is now:
  //     approveScrapeItem → promote → enqueue eligibility recompute
  //        → eligibility-consumer → POST /api/eligibility/recompute
  //        → runEligibilityForUser(serviceClient)
  //        → engine runs, writes eligibility_results,
  //          AND emits notification_alerts ONLY for users the engine
  //          verifies as eligible or conditional, with trustworthy
  //          explanation flags (is_tracked, is_eligible).
  //
  //   So this block only records the audit row. Fan-out happens downstream
  //   through the engine, not here.

  let alertEventId: string | null = null
  try {
    const { data: evt, error: evtErr } = await supabase
      .from("alert_events")
      .insert({
        event_type:     "new_recruitment",
        recruitment_id: recruitmentId,
        priority:       2,
        payload: {
          source_url:      item.source_url,
          source_name:     item.source_name,
          queue_item_id:   itemId,
          reviewer_id:     reviewerId,
          confidence_score: item.confidence_score,
        },
        fanout_status: "pending",
      })
      .select("id")
      .single()

    if (evtErr) {
      console.error("[approveScrapeItem] alert_event insert:", evtErr.message)
    } else {
      alertEventId = evt?.id ?? null
    }
  } catch (e) {
    console.error("[approveScrapeItem] alert_event non-fatal:", e)
  }

  // ── 7. Queue eligibility recompute for all users ───────────────────────────
  // Each user who has completed onboarding needs to be re-evaluated against
  // the new recruitment. We insert into eligibility_recompute_queue; the
  // eligibility-consumer Edge Function drains this every 5 minutes.
  // Non-fatal — a failure here doesn't affect the approval itself.
  try {
    const { data: userIds } = await supabase
      .from("profiles")
      .select("id")
      .eq("onboarding_completed", true)

    if (userIds && userIds.length > 0) {
      await supabase
        .from("eligibility_recompute_queue")
        .upsert(
          userIds.map((u) => ({
            user_id:        u.id,
            recruitment_id: recruitmentId,
            status:         "pending",
            reason:         "new_recruitment_approved",
            queued_at:      new Date().toISOString(),
          })),
          // uq_recompute_queue is on (user_id, recruitment_id, status) — must include all 3
          { onConflict: "user_id,recruitment_id,status", ignoreDuplicates: true }
        )
      console.log(`[approveScrapeItem] queued eligibility recompute for ${userIds.length} users`)

      // Mark the audit alert_event as completed — fan-out now happens through
      // the engine when the consumer drains the queue. users_notified is a
      // ceiling (not every queued user will end up eligible), so we store
      // the number of candidates, not the number of inserted alerts.
      if (alertEventId) {
        await supabase
          .from("alert_events")
          .update({ fanout_status: "completed", users_notified: userIds.length })
          .eq("id", alertEventId)
      }
    } else if (alertEventId) {
      await supabase
        .from("alert_events")
        .update({ fanout_status: "completed", users_notified: 0 })
        .eq("id", alertEventId)
    }
  } catch (e) {
    console.error("[approveScrapeItem] eligibility queue non-fatal:", e)
  }
}

export async function rejectScrapeItem(
  itemId: string, reviewerId: string, notes?: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("scrape_queue")
    .update({
      status:            "rejected",
      extraction_status: "rejected",
      reviewer_id:       reviewerId,
      reviewer_notes:    notes ?? null,
      reviewed_at:       new Date().toISOString(),
    })
    .eq("id", itemId)
  if (error) throw new Error(`rejectScrapeItem: ${error.message}`)
}

// =============================================================================
// SCRAPE RUNS
// =============================================================================

export async function getScrapeRuns(limit = 20): Promise<ScrapeRun[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("scrape_runs")
    .select("id,started_at,finished_at,status,sources_checked,items_found,items_new,items_duplicate,error_log,triggered_by")
    .order("started_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getScrapeRuns: ${error.message}`)
  return (data ?? []) as unknown as ScrapeRun[]
}

// ─── Paginated helpers ────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  rows:       T[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export async function getScrapeQueuePaginated(
  status?: ScrapeQueueItem["status"],
  page    = 1,
  pageSize = 25
): Promise<PaginatedResult<QueueReviewItem>> {
  const supabase = await createClient()
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  // Try the enriched view first
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("v_admin_queue_review")
      .select("*", { count: "exact" })
      .order("scraped_at", { ascending: false })
      .range(from, to)
    if (status) q = q.eq("status", status)
    const { data, error, count } = await q
    if (!error) {
      const total = count ?? 0
      return {
        rows:       (data ?? []) as QueueReviewItem[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }
    }
    const code: string = (error as { code?: string })?.code ?? ""
    if (code !== "42P01" && code !== "PGRST116" && !(error as { message?: string }).message?.includes("does not exist")) {
      throw new Error(`getScrapeQueuePaginated (view): ${(error as { message?: string }).message}`)
    }
  }

  // Fallback: query scrape_queue directly
  let q = supabase
    .from("scrape_queue")
    .select("id,source_url,source_name,confidence_score,data_quality_score,status,scraped_at,reviewed_at,reviewer_notes,extracted_data", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .range(from, to)
  if (status) q = q.eq("status", status)
  const { data, error, count } = await q
  if (error) throw new Error(`getScrapeQueuePaginated: ${error.message}`)

  const rows = (data ?? []).map((row) => {
    const ext = (row.extracted_data ?? {}) as Record<string, unknown>
    return {
      id:                        row.id,
      source_url:                row.source_url,
      source_name:               row.source_name ?? "",
      confidence_score:          row.confidence_score ?? 0,
      data_quality_score:        (row.data_quality_score as number | null) ?? null,
      status:                    row.status as ScrapeQueueItem["status"],
      scraped_at:                row.scraped_at,
      reviewed_at:               row.reviewed_at ?? null,
      reviewer_notes:            row.reviewer_notes ?? null,
      title:                     (ext.title as string | null) ?? null,
      org_name:                  (ext.organization_name as string | null) ?? null,
      apply_end_date:            (ext.apply_end_date as string | null) ?? null,
      total_vacancies:           ext.total_vacancies != null ? String(ext.total_vacancies) : null,
      fingerprint:               null,
      obs_status:                null,
      canonical_id:              null,
      canonical_name:            null,
      run_started_at:            null,
      extraction_status:         null,
      evidence_required:         true,
      notification_document_id:  null,
      extraction_provider:       null,
      extraction_model:          null,
      evidence_total_count:      null,
      evidence_verified_count:   null,
      evidence_rejected_count:   null,
      evidence_missing_count:    null,
    } satisfies QueueReviewItem
  })

  const total = count ?? 0
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getScrapeRunsPaginated(
  page    = 1,
  pageSize = 20
): Promise<PaginatedResult<ScrapeRun>> {
  const supabase = await createClient()
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, error, count } = await supabase
    .from("scrape_runs")
    .select("id,started_at,finished_at,status,sources_checked,items_found,items_new,items_duplicate,error_log,triggered_by", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(from, to)

  if (error) throw new Error(`getScrapeRunsPaginated: ${error.message}`)
  const total = count ?? 0
  return {
    rows:       (data ?? []) as unknown as ScrapeRun[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// =============================================================================
// SCRAPER STATS
// =============================================================================

export async function getScraperStats(): Promise<ScraperStats> {
  const supabase = await createClient()

  const [lastRunRes, pendingRes, failedRes, healthyRes] = await Promise.all([
    supabase
      .from("scrape_runs")
      .select("id,started_at,finished_at,status,sources_checked,items_found,items_new,items_duplicate,error_log,triggered_by")
      .order("started_at", { ascending: false })
      .limit(1),
    supabase
      .from("scrape_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("source_registry")
      .select("id", { count: "exact", head: true })
      .gte("consecutive_fails", 5),
    supabase
      .from("source_registry")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("consecutive_fails", 0),
  ])

  return {
    lastRun:        (lastRunRes.data?.[0] ?? null) as unknown as ScrapeRun | null,
    pendingReview:  pendingRes.count  ?? 0,
    approvedTotal:  0,
    failedSources:  failedRes.count   ?? 0,
    healthySources: healthyRes.count  ?? 0,
  }
}

// =============================================================================
// SOURCE HEALTH SNAPSHOTS
// =============================================================================

export async function getSourceHealthSnapshots(): Promise<SourceHealthSnapshot[]> {
  const supabase = await createClient()

  // Two separate queries — source_health_metrics.source_id FK still points to
  // scrape_sources (legacy). Until the FK migration (TASK 8) runs and
  // source_registry_id is backfilled, we merge in-memory.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [sourcesRes, metricsRes] = await Promise.all([
    supabase
      .from("source_registry")
      .select("id,source_name,tier,is_active,consecutive_fails,last_scraped_at,last_success_at")
      .order("tier",        { ascending: true })
      .order("source_name"),
    supabase
      .from("source_health_metrics")
      .select("source_id,source_registry_id,confidence_avg,items_extracted,measured_at")
      .gte("measured_at", cutoff)
      .order("measured_at", { ascending: false }),
  ])

  if (sourcesRes.error) throw new Error(`getSourceHealthSnapshots: ${sourcesRes.error.message}`)

  type SourceRow = {
    id:                string
    source_name:       string
    tier:              number
    is_active:         boolean
    consecutive_fails: number
    last_scraped_at:   string | null
    last_success_at:   string | null
  }

  type MetricRow = {
    source_id:           string | null
    source_registry_id:  string | null
    confidence_avg:      number | null
    items_extracted:     number
    measured_at:         string
  }

  const sources = (sourcesRes.data ?? []) as unknown as SourceRow[]
  const metrics = (metricsRes.data ?? []) as unknown as MetricRow[]

  // Group metrics by source_registry_id first, fall back to source_id
  const metricsBySource = new Map<string, MetricRow[]>()
  for (const m of metrics) {
    const key = m.source_registry_id ?? m.source_id ?? ""
    if (!key) continue
    const existing = metricsBySource.get(key) ?? []
    existing.push(m)
    metricsBySource.set(key, existing)
  }

  return sources.map((s: SourceRow): SourceHealthSnapshot => {
    const recent = metricsBySource.get(s.id) ?? []

    const avgConf = recent.length
      ? recent.reduce((sum, m) => sum + (m.confidence_avg ?? 0), 0) / recent.length
      : null

    const items7d = recent.reduce((sum, m) => sum + (m.items_extracted ?? 0), 0)

    return {
      source_id:         s.id,
      name:              s.source_name,
      tier:              s.tier as SourceTier,
      is_active:         s.is_active,
      is_healthy:        s.consecutive_fails === 0,
      last_scraped_at:   s.last_scraped_at,
      last_success_at:   s.last_success_at,
      consecutive_fails: s.consecutive_fails,
      avg_confidence:    avgConf,
      items_7d:          items7d,
    }
  })
}

// =============================================================================
// EVIDENCE REVIEW
// =============================================================================

/**
 * Loads all extracted_field_evidence rows for a scrape_queue item.
 * Used by the evidence review panel in the admin scrape dashboard.
 */
export async function getEvidenceForQueueItem(queueItemId: string): Promise<FieldEvidence[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("extracted_field_evidence")
    .select("id,scrape_queue_id,document_id,field_name,field_value,evidence_text,char_start,char_end,confidence,reviewer_status,provider,model_used,created_at")
    .eq("scrape_queue_id", queueItemId)
    .order("field_name")
  if (error) throw new Error(`getEvidenceForQueueItem: ${error.message}`)
  return (data ?? []) as unknown as FieldEvidence[]
}

/**
 * Update reviewer_status on a single evidence row.
 * Called by admin when verifying or rejecting individual field evidence.
 */
export async function setEvidenceReviewerStatus(
  evidenceId: string,
  status: FieldEvidence["reviewer_status"]
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("extracted_field_evidence")
    .update({ reviewer_status: status })
    .eq("id", evidenceId)
  if (error) throw new Error(`setEvidenceReviewerStatus: ${error.message}`)
}

/**
 * Update extraction_status on a scrape_queue row.
 * Called by admin to mark an item as verified/needs_review from the UI
 * (independent of the full approval flow).
 */
export async function setExtractionStatus(
  queueItemId: string,
  status: "unverified" | "needs_review" | "verified" | "rejected" | "stale" | "duplicate"
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("scrape_queue")
    .update({ extraction_status: status })
    .eq("id", queueItemId)
  if (error) throw new Error(`setExtractionStatus: ${error.message}`)
}

// =============================================================================
// LEGACY: SOURCE REGISTRY PASS-THROUGH
// These delegate to lib/db/source-registry.ts — kept here for actions/notifications.ts
// backward compatibility. Remove in Phase 3 once all callers are migrated.
// =============================================================================

export { dbToggleSourceActive as toggleSourceRegistry } from "@/lib/db/source-registry"
export { dbResetSourceFails   as resetSourceFails }     from "@/lib/db/source-registry"

/**
 * upsertSourceRegistry — delegates to dbCreateSource / dbUpdateSource.
 * Kept for adminSaveSourceRegistry in actions/notifications.ts.
 * @deprecated Use createSource / updateSource server actions instead.
 */
export async function upsertSourceRegistry(
  data: Parameters<typeof import("@/lib/db/source-registry").dbCreateSource>[0] & { id?: string }
): Promise<void> {
  const { dbCreateSource, dbUpdateSource } = await import("@/lib/db/source-registry")
  if (data.id) {
    const { id, ...rest } = data
    await dbUpdateSource(id, rest)
  } else {
    await dbCreateSource(data)
  }
}

// =============================================================================
// LEGACY: SCRAPE SOURCES (reads from scrape_sources — phase out in Phase 3)
// =============================================================================

export async function getScrapeSources(activeOnly = false): Promise<ScrapeSource[]> {
  const supabase = await createClient()
  let query = supabase
    .from("scrape_sources")
    .select("id,name,base_url,notification_path,org_type,state,is_active,is_healthy,last_scraped_at,last_success_at,scrape_interval_hours,tier,trust_score,adapter_type,consecutive_fails,selector_config,metadata")
    .order("name")
  if (activeOnly) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) throw new Error(`getScrapeSources: ${error.message}`)
  // Coerce nullables — is_healthy and others may be null in older rows
  return (data ?? []).map(row => ({
    ...row,
    is_healthy:        row.is_healthy        ?? false,
    consecutive_fails: row.consecutive_fails ?? 0,
    trust_score:       row.trust_score       ?? 0.7,
  })) as ScrapeSource[]
}

export async function toggleScrapeSource(id: string, active: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("scrape_sources")
    .update({ is_active: active })
    .eq("id", id)
  if (error) throw new Error(`toggleScrapeSource: ${error.message}`)
}

export async function upsertScrapeSource(
  data: Partial<ScrapeSource> & { name: string; base_url: string }
): Promise<void> {
  const supabase = await createClient()

  const payload: ScrapeSourceInsert = {
    id:                    data.id,
    name:                  data.name,
    base_url:              data.base_url,
    notification_path:     data.notification_path     ?? null,
    org_type:              data.org_type              ?? "Central Govt",
    state:                 data.state                 ?? null,
    is_active:             data.is_active             ?? true,
    last_scraped_at:       data.last_scraped_at       ?? null,
    scrape_interval_hours: data.scrape_interval_hours ?? 24,
    selector_config: (data.selector_config ?? {}) as ScrapeSourceInsert["selector_config"],
    ...(data.tier              !== undefined ? { tier:              data.tier }              : {}),
    ...(data.trust_score       !== undefined ? { trust_score:       data.trust_score }       : {}),
    ...(data.adapter_type      !== undefined ? { adapter_type:      data.adapter_type }      : {}),
    ...(data.consecutive_fails !== undefined ? { consecutive_fails: data.consecutive_fails } : {}),
    ...(data.metadata          !== undefined
      ? { metadata: data.metadata as ScrapeSourceInsert["metadata"] } : {}),
  }

  const { error } = await supabase.from("scrape_sources").upsert(payload)
  if (error) throw new Error(`upsertScrapeSource: ${error.message}`)
}

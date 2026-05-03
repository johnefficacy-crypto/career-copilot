"use server"

/**
 * actions/notifications.ts
 * Career Copilot — Notification & Scraper Server Actions
 *
 * ARCHITECTURE:
 *  - User notification actions (mark read, prefs, track)
 *  - Admin queue review actions (approve, reject)
 *  - Admin trigger actions (scraper, deadline sweep)
 *  - Source registry actions delegate to actions/sources.ts (createSource, updateSource, etc.)
 *    NOT to the deprecated upsertSourceRegistry in lib/db/notifications.ts
 *
 * 401 FIX: Supabase Edge Functions require both:
 *   Authorization: Bearer <service_role_key>    ← authenticates the caller
 *   apikey: <anon_key>                          ← required for JWT validation pipeline
 * Using only Authorization was causing "Invalid Token or Protected Header formatting".
 */

import { redirect }       from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient }   from "@/utils/supabase/server"
import {
  markAlertRead,
  markAllAlertsRead,
  approveScrapeItem,
  rejectScrapeItem,
  toggleScrapeSource,
  toggleSourceRegistry,
  resetSourceFails,
  fanOutNotificationAlerts,
  upsertUserNotifPrefs,
  trackRecruitment,
  untrackRecruitment,
  setExtractionStatus,
  setEvidenceReviewerStatus,
} from "@/lib/db/notifications"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"
import type { UserNotificationPrefs, FieldEvidence } from "@/types/notifications"

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  return user
}

// requireAdmin: accepts any admin role — delegates to lib/db/admin.ts
async function requireAdmin() {
  try {
    const ctx = await requireAdminRole()
    return { id: ctx.userId, email: ctx.userEmail }
  } catch {
    redirect("/dashboard")
  }
}

// =============================================================================
// USER ACTIONS
// =============================================================================

export async function markNotificationRead(alertId: string): Promise<void> {
  const user = await requireUser()
  await markAlertRead(alertId, user.id)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/notifications")
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser()
  await markAllAlertsRead(user.id)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/notifications")
}

export const markUserAlertsRead = markAllNotificationsRead

export async function saveNotificationPrefs(
  prefs: Partial<Omit<UserNotificationPrefs, "user_id">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser()
    await upsertUserNotifPrefs(user.id, prefs)
    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function trackRecruitmentAction(recruitmentId: string): Promise<void> {
  const user = await requireUser()
  await trackRecruitment(user.id, recruitmentId)
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/recruitments/${recruitmentId}`)
}

export async function untrackRecruitmentAction(recruitmentId: string): Promise<void> {
  const user = await requireUser()
  await untrackRecruitment(user.id, recruitmentId)
  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/recruitments/${recruitmentId}`)
}

// =============================================================================
// ADMIN — SCRAPE QUEUE
// =============================================================================

export async function adminApproveQueueItem(formData: FormData) {
  const admin  = await requireAdmin()
  const itemId = formData.get("item_id") as string
  const notes  = (formData.get("notes") as string) || undefined
  if (!itemId) redirect("/admin/scrape?error=Missing+item_id")
  try {
    await approveScrapeItem(itemId, admin.id, notes)
    void logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     "approve_scrape_item",
      entityType: "scrape_queue",
      entityId:   itemId,
      newValue:   { status: "approved", notes },
    })
    // Do NOT revalidatePath("/admin/scrape") — the client already applies an
    // optimistic update (status → "approved") in handleApprove(), and
    // revalidating the full page causes Next.js to recompile it in dev mode
    // (5-10 s delay per click). The DB is updated; on next full page load
    // the correct data will be shown.
    revalidatePath("/admin/recruitments")   // admin recruitment list
    revalidatePath("/dashboard")            // user dashboard feed
  } catch (err) {
    redirect(`/admin/scrape?error=${encodeURIComponent(err instanceof Error ? err.message : "Error")}`)
  }
}

export async function adminRejectQueueItem(formData: FormData) {
  const admin  = await requireAdmin()
  const itemId = formData.get("item_id") as string
  const notes  = (formData.get("notes") as string) || undefined
  if (!itemId) redirect("/admin/scrape?error=Missing+item_id")
  try {
    await rejectScrapeItem(itemId, admin.id, notes)
    void logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     "reject_scrape_item",
      entityType: "scrape_queue",
      entityId:   itemId,
      newValue:   { status: "rejected", notes },
    })
    revalidatePath("/admin/scrape")
  } catch (err) {
    redirect(`/admin/scrape?error=${encodeURIComponent(err instanceof Error ? err.message : "Error")}`)
  }
}

// =============================================================================
// ADMIN — EVIDENCE REVIEW
// =============================================================================

/** Set extraction_status on a scrape_queue item from the evidence review UI. */
export async function adminSetExtractionStatus(
  itemId: string,
  status: "unverified" | "needs_review" | "verified" | "rejected" | "stale" | "duplicate",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    await setExtractionStatus(itemId, status)
    void logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     "set_extraction_status",
      entityType: "scrape_queue",
      entityId:   itemId,
      newValue:   { extraction_status: status },
      notes,
    })
    revalidatePath("/admin/scrape")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/** Fetch evidence rows for a scrape_queue item (used by the review panel). */
export async function adminGetEvidenceForItem(
  queueItemId: string
): Promise<{ success: boolean; data?: FieldEvidence[]; error?: string }> {
  try {
    await requireAdminRole("queue")
    const { getEvidenceForQueueItem } = await import("@/lib/db/notifications")
    const rows = await getEvidenceForQueueItem(queueItemId)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/** Mark a single evidence field as verified or rejected. */
export async function adminReviewEvidenceField(
  evidenceId: string,
  reviewerStatus: FieldEvidence["reviewer_status"],
  queueItemId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    await setEvidenceReviewerStatus(evidenceId, reviewerStatus)
    void logAdminAction({
      actorId:    admin.id,
      actorEmail: admin.email,
      action:     "review_evidence_field",
      entityType: "extracted_field_evidence",
      entityId:   evidenceId,
      newValue:   { reviewer_status: reviewerStatus, queue_item_id: queueItemId },
    })
    if (queueItemId) revalidatePath("/admin/scrape")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

// =============================================================================
// ADMIN — LEGACY SCRAPE SOURCES
// =============================================================================

export async function adminToggleScrapeSource(formData: FormData) {
  await requireAdmin()
  const id     = formData.get("source_id") as string
  const active = formData.get("active") === "true"
  try {
    // Try source_registry first, fall back to legacy scrape_sources
    await toggleSourceRegistry(id, active).catch(() => toggleScrapeSource(id, active))
    revalidatePath("/admin/scrape")
    revalidatePath("/admin/sources")
  } catch (err) {
    redirect(`/admin/scrape?error=${encodeURIComponent(err instanceof Error ? err.message : "Error")}`)
  }
}

// =============================================================================
// ADMIN — SOURCE REGISTRY
// =============================================================================

/** Reset consecutive_fails for a source and re-enable it. */
export async function adminResetSourceFails(sourceId: string): Promise<void> {
  await requireAdmin()
  await resetSourceFails(sourceId)
  revalidatePath("/admin/scrape")
  revalidatePath("/admin/sources")
}

// =============================================================================
// ADMIN — NOTIFICATIONS FAN-OUT
// =============================================================================

export async function adminFanOutNotifications(formData: FormData): Promise<{
  success: boolean; count?: number; error?: string
}> {
  await requireAdmin()
  const recruitmentId = formData.get("recruitment_id") as string
  try {
    const count = await fanOutNotificationAlerts(recruitmentId)
    revalidatePath("/admin/recruitments")
    revalidatePath(`/admin/recruitments/${recruitmentId}`)
    revalidatePath("/dashboard")
    return { success: true, count }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

// =============================================================================
// ADMIN — TRIGGER FUNCTIONS
//
// 401 FIX: Supabase Edge Functions validate the JWT in the Authorization header.
// When calling with a service_role key, you ALSO need to pass the anon key as
// the `apikey` header, otherwise the JWT pipeline rejects with 401.
// The service_role key is a JWT signed differently from user tokens — passing
// it without the `apikey` header causes "Invalid Token or Protected Header".
//
// Solution: pass BOTH headers:
//   Authorization: Bearer <service_role_key>
//   apikey: <anon_key>
// =============================================================================

export async function adminTriggerScraper(): Promise<{
  success: boolean; message: string; runId?: string; itemsNew?: number; itemsFound?: number
}> {
  await requireAdmin()

  const edgeFnUrl  = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scheduled-scraper`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!serviceKey) return { success: false, message: "SUPABASE_SERVICE_ROLE_KEY not configured" }
  if (!anonKey)    return { success: false, message: "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured" }

  try {
    const res = await fetch(edgeFnUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey":        anonKey,
      },
      body:   JSON.stringify({ triggered_by: "admin", force: true }),
      signal: AbortSignal.timeout(90_000),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, message: `Edge Function ${res.status}: ${body}` }
    }

    const json = await res.json() as { runId?: string; totalNew?: number; totalFound?: number }
    revalidatePath("/admin/scrape")
    revalidatePath("/dashboard")
    return {
      success:    true,
      message:    `Scraper done. ${json.totalNew ?? 0} new, ${json.totalFound ?? 0} found.`,
      runId:      json.runId,
      itemsNew:   json.totalNew,
      itemsFound: json.totalFound,
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Unknown" }
  }
}

export async function adminTriggerDeadlineSweep(): Promise<{
  success: boolean; message: string; eventsCreated?: number
}> {
  await requireAdmin()

  const edgeFnUrl  = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deadline-sweep`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!serviceKey) return { success: false, message: "SUPABASE_SERVICE_ROLE_KEY not configured" }
  if (!anonKey)    return { success: false, message: "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured" }

  try {
    const res = await fetch(edgeFnUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey":        anonKey,
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, message: `Edge Function ${res.status}: ${body}` }
    }

    const json = await res.json() as { eventsCreated?: number }
    revalidatePath("/dashboard")
    return {
      success:       true,
      message:       `Sweep done. ${json.eventsCreated ?? 0} events created.`,
      eventsCreated: json.eventsCreated,
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Unknown" }
  }
}
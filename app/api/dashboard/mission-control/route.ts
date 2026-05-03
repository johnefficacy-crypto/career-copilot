/**
 * GET /api/dashboard/mission-control
 *
 * Returns the mission-control payload for the authenticated user:
 *   summary        — aggregate counts by eligibility status and urgency
 *   recommendedAction — highest-priority next action (null until ranking v1)
 *   feed           — per-recruitment cards ordered by alert priority
 *   profileImpact  — fields to fill that unlock more opportunities (stub)
 *   tab            — active tab echo for the client
 *
 * Backed by the user_recruitment_state materialized view (migration 027).
 * Refresh the view after eligibility recompute to keep data current.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url   = new URL(req.url)
  const tab   = url.searchParams.get("tab") ?? "urgent"
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100)

  const { data: rows, error } = await supabase
    .from("user_recruitment_state")
    .select(`
      recruitment_id,
      recruitment_name,
      organization_id,
      eligibility_status,
      reason_codes,
      explanation,
      apply_end_date,
      days_to_deadline,
      latest_alert_type,
      latest_alert_priority,
      saved,
      applied
    `)
    .eq("user_id", user.id)
    .order("latest_alert_priority", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const feed = (rows ?? []).map((row) => ({
    recruitmentId:     row.recruitment_id,
    title:             row.recruitment_name,
    eligibilityStatus: row.eligibility_status,
    daysToDeadline:    row.days_to_deadline,
    priority:          row.latest_alert_priority ?? 0,
    why:               (row.reason_codes as string[] | null) ?? [],
    blockers:          row.eligibility_status === "conditional"
                         ? [row.explanation].filter(Boolean)
                         : [],
    detailHref:        `/dashboard/recruitments/${row.recruitment_id}`,
    saved:             row.saved,
    applied:           row.applied,
  }))

  const summary = {
    eligibleNow:      feed.filter((x) => x.eligibilityStatus === "eligible").length,
    closingThisWeek:  feed.filter((x) => x.daysToDeadline != null && x.daysToDeadline <= 7).length,
    conditional:      feed.filter((x) => x.eligibilityStatus === "conditional").length,
    profileBlockers:  feed.filter((x) => x.eligibilityStatus === "needs_profile_data").length,
  }

  return NextResponse.json({
    summary,
    recommendedAction: null,
    feed,
    profileImpact:     [],
    tab,
  })
}

import { createClient } from "@/utils/supabase/server"

export type MissionControlFeedItem = {
  recruitmentId:    string
  recruitmentName:  string | null
  eligibilityStatus: string
  daysToDeadline:   number | null
  priority:         number
  reasonCodes:      string[] | null
  explanation:      string | null
  saved:            boolean
  applied:          boolean
  detailHref:       string
}

export type MissionControlSummary = {
  eligibleNow:     number
  closingThisWeek: number
  conditional:     number
  profileBlockers: number
}

export type MissionControlData = {
  summary: MissionControlSummary
  feed:    MissionControlFeedItem[]
}

const EMPTY: MissionControlData = {
  summary: { eligibleNow: 0, closingThisWeek: 0, conditional: 0, profileBlockers: 0 },
  feed:    [],
}

/**
 * getMissionControlData — queries user_recruitment_state (migration 027).
 *
 * Returns EMPTY rather than throwing when the view doesn't exist yet or has
 * no rows, so the dashboard still renders during initial rollout.
 */
export async function getMissionControlData(
  userId: string,
  limit = 30,
): Promise<MissionControlData> {
  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from("user_recruitment_state")
      .select(`
        recruitment_id,
        recruitment_name,
        eligibility_status,
        reason_codes,
        explanation,
        apply_end_date,
        days_to_deadline,
        latest_alert_priority,
        saved,
        applied
      `)
      .eq("user_id", userId)
      .order("latest_alert_priority", { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error || !rows) return EMPTY

    const feed: MissionControlFeedItem[] = rows.filter((r) => r.recruitment_id != null).map((r) => ({
      recruitmentId:     r.recruitment_id!,
      recruitmentName:   r.recruitment_name ?? null,
      eligibilityStatus: r.eligibility_status ?? "unknown",
      daysToDeadline:    r.days_to_deadline  ?? null,
      priority:          r.latest_alert_priority ?? 0,
      reasonCodes:       (r.reason_codes as string[] | null) ?? null,
      explanation:       r.explanation ?? null,
      saved:             r.saved  ?? false,
      applied:           r.applied ?? false,
      detailHref:        `/dashboard/recruitments/${r.recruitment_id}`,
    }))

    const summary: MissionControlSummary = {
      eligibleNow:     feed.filter((x) => x.eligibilityStatus === "eligible").length,
      closingThisWeek: feed.filter((x) => x.daysToDeadline != null && x.daysToDeadline <= 7).length,
      conditional:     feed.filter((x) => x.eligibilityStatus === "conditional").length,
      profileBlockers: feed.filter((x) => x.eligibilityStatus === "needs_profile_data").length,
    }

    return { summary, feed }
  } catch {
    return EMPTY
  }
}

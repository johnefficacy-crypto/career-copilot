import { createClient } from "@/utils/supabase/server"

export type CommunityReportRow = {
  id: string
  created_at: string
  reason: string
  details: string | null
  status: "pending" | "reviewing" | "resolved" | "dismissed"
}

type CommunityReportUpdateRow = {
  id: string
  status: CommunityReportRow["status"]
  moderation_notes: string | null
  moderated_by: string | null
  moderated_at: string | null
}

export async function getCommunityModerationQueue(limit = 100): Promise<CommunityReportRow[]> {
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from("community_reports")
    .select("id, created_at, reason, details, status")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as CommunityReportRow[]
}

export async function moderateCommunityReport(input: {
  reportId: string
  status: "reviewing" | "resolved" | "dismissed"
  moderationNotes?: string
  moderatedBy: string
}): Promise<CommunityReportUpdateRow> {
  const supabase = await createClient()
  const db = supabase as any
  const patch = {
    status: input.status,
    moderation_notes: input.moderationNotes ?? null,
    moderated_by: input.moderatedBy,
    moderated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("community_reports")
    .update(patch)
    .eq("id", input.reportId)
    .select("id, status, moderation_notes, moderated_by, moderated_at")
    .single()

  if (error) throw new Error(error.message)
  return data as CommunityReportUpdateRow
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { logAdminAction, requireAdminRole } from "@/lib/db/admin"

export async function updateForumReportAction(formData: FormData) {
  const ctx = await requireAdminRole("community")
  const supabase = await createClient()

  const reportId = String(formData.get("report_id") ?? "")
  const status = String(formData.get("status") ?? "open")
  const severity = String(formData.get("severity") ?? "p2_spam_noise")
  const notes = String(formData.get("action_notes") ?? "").trim() || null

  if (!reportId) return

  const db = supabase as any

  const { data: before } = await db
    .from("forum_reports")
    .select("id,status,severity,assigned_admin_id,action_notes,resolved_at,resolved_by")
    .eq("id", reportId)
    .maybeSingle()

  const patch: Record<string, string | null> = {
    status,
    severity,
    action_notes: notes,
    assigned_admin_id: ctx.userId,
  }

  if (status === "resolved" || status === "dismissed") {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = ctx.userId
  }

  const { error } = await db.from("forum_reports").update(patch).eq("id", reportId)
  if (error) throw new Error(error.message)

  await logAdminAction({
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    action: "update_forum_report",
    entityType: "forum_report",
    entityId: reportId,
    oldValue: before,
    newValue: patch,
    notes: notes ?? undefined,
  })

  revalidatePath("/admin/community")
}

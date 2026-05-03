"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

const ALLOWED = new Set([
  "wrong_match",
  "deadline_wrong",
  "official_link_broken",
  "duplicate_notification",
  "not_interested",
  "already_applied",
  "other",
])

export async function submitRecruitmentFeedback(formData: FormData): Promise<void> {
  const recruitmentId = String(formData.get("recruitment_id") ?? "")
  const feedbackType = String(formData.get("feedback_type") ?? "")
  const message = String(formData.get("message") ?? "").trim()

  if (!recruitmentId || !ALLOWED.has(feedbackType)) {
    return
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const db = supabase as unknown as { from: (table: string) => { insert: (v: unknown) => Promise<{ error: { message: string } | null }> } }
  const { error } = await db.from("user_recruitment_feedback").insert({
    user_id: user.id,
    recruitment_id: recruitmentId,
    feedback_type: feedbackType,
    message: message || null,
  })

  if (error) return

  revalidatePath("/dashboard/notifications")
  return
}

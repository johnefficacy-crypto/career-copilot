"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function saveExamCredential(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const examKey = String(formData.get("exam_key") ?? "").trim().toLowerCase()
  if (!examKey) redirect("/onboarding/exam-credentials?error=missing_exam")

  const score = formData.get("score") ? Number(formData.get("score")) : null
  const percentile = formData.get("percentile") ? Number(formData.get("percentile")) : null
  const examYear = formData.get("exam_year") ? Number(formData.get("exam_year")) : null

  const db = supabase as unknown as { from: (table: string) => { upsert: (v: unknown, o: unknown) => Promise<{ error: { message: string } | null }> } }
  const { error } = await db.from("aspirant_exam_credentials").upsert({
    user_id: user.id,
    exam_key: examKey,
    score,
    percentile,
    exam_year: examYear,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,exam_key" })

  if (error) redirect(`/onboarding/exam-credentials?error=${encodeURIComponent(error.message)}`)
  redirect("/dashboard?success=exam_credentials_saved")
}

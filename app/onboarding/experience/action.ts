"use server"

// FIX: Was using createClient(cookieStore) — old broken signature.
// The canonical server client is `await createClient()` with no arguments.

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

interface ExperienceInsert {
  sector: string
  role: string
  organization: string
  start_date: string
  end_date: string | null
  years_experience: number
}

export async function saveExperience(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login?error=Session+expired.+Please+sign+in+again.")
  }

  const isFresher = formData.get("is_fresher") === "true"

  if (isFresher) {
    redirect("/onboarding/exam-attempts")
  }

  // Parse indexed FormData rows from the client
  const rows: (ExperienceInsert & { user_id: string })[] = []
  let i = 0
  while (formData.get(`exp_${i}_role`)) {
    const startDate = formData.get(`exp_${i}_start_date`) as string
    const endDate   = formData.get(`exp_${i}_end_date`) as string | null
    const years     = Number(formData.get(`exp_${i}_years_experience`)) || 0

    rows.push({
      user_id:          user.id,
      sector:           (formData.get(`exp_${i}_sector`) as string) || "PRIVATE",
      role:             (formData.get(`exp_${i}_role`) as string).trim(),
      organization:     (formData.get(`exp_${i}_organization`) as string).trim(),
      start_date:       startDate,
      end_date:         endDate || null,
      years_experience: years,
    })
    i++
  }

  if (rows.length > 0) {
    // Replace pattern — delete then re-insert for idempotency
    await supabase.from("aspirant_experience").delete().eq("user_id", user.id)

    const { error } = await supabase.from("aspirant_experience").insert(rows)
    if (error) {
      redirect(`/onboarding/experience?error=${encodeURIComponent(error.message)}`)
    }
  }

  redirect("/onboarding/exam-attempts")
}
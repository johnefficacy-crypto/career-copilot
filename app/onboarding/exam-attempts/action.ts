"use server"

// FIX 1: Original called server action via onClick with typed args — bypasses CSRF.
//         Now uses FormData, user resolved server-side.
// FIX 2: Was using createClient(cookieStore) — fixed to canonical pattern.
// FIX 3: Table was "aspirant_exam_attempts" — correct table is "user_exam_attempts".

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function saveExamAttempts(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login?error=Session+expired.+Please+sign+in+again.")
  }

  const rows: { user_id: string; exam_name: string; attempts_used: number }[] = []
  let i = 0

  while (formData.get(`exam_${i}_name`)) {
    const examName     = (formData.get(`exam_${i}_name`) as string).trim()
    const attemptsUsed = Number(formData.get(`exam_${i}_attempts`) ?? 0)

    if (examName) {
      rows.push({ user_id: user.id, exam_name: examName, attempts_used: attemptsUsed })
    }
    i++
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("user_exam_attempts")
      .upsert(rows, { onConflict: "user_id,exam_name" })

    if (error) {
      redirect(`/onboarding/attempts?error=${encodeURIComponent(error.message)}`)
    }
  }

  redirect("/onboarding/preferences")
}
"use server"

// FIX 1: `insertEducationRows` does not exist in lib/db/education.ts.
//         The actual export is `replaceEducation(userId, records)`.
// FIX 2: Was using `getCurrentUser()` helper — replaced with canonical createClient().
// FIX 3: Field names match the EducationInsert type from lib/db/education.ts.

import { createClient } from "@/utils/supabase/server"
import { replaceEducation } from "@/lib/db/education"
import { redirect } from "next/navigation"
import type { EducationInsert } from "@/lib/db/education"

export async function saveEducation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login?error=Session+expired.+Please+sign+in+again.")
  }

  const records: EducationInsert[] = []

  // ── 10th ──────────────────────────────────────────────────────────────
  records.push({
    level:           "10th",
    institution:     (formData.get("tenth_board") as string | null) ?? undefined,
    percentage:      Number(formData.get("tenth_percentage")) || undefined,
    graduation_year: Number(formData.get("tenth_year")) || undefined,
    is_completed:    true,
  })

  // ── 12th ──────────────────────────────────────────────────────────────
  records.push({
    level:           "12th",
    institution:     (formData.get("twelfth_board") as string | null) ?? undefined,
    percentage:      Number(formData.get("twelfth_percentage")) || undefined,
    graduation_year: Number(formData.get("twelfth_year")) || undefined,
    is_completed:    true,
  })

  // ── Dynamic degree rows ────────────────────────────────────────────────
  let i = 0
  while (formData.get(`degree_${i}_qualification`)) {
    records.push({
      level:           "graduate",
      degree:          (formData.get(`degree_${i}_qualification`) as string | null) ?? undefined,
      stream:          (formData.get(`degree_${i}_specialization`) as string | null) ?? undefined,
      institution:     (formData.get(`degree_${i}_university`) as string | null) ?? undefined,
      percentage:      Number(formData.get(`degree_${i}_percentage`)) || undefined,
      graduation_year: Number(formData.get(`degree_${i}_year`)) || undefined,
      is_completed:    true,
    })
    i++
  }

  // replaceEducation deletes existing rows then re-inserts — fully idempotent
  await replaceEducation(user.id, records)

  redirect("/onboarding/certifications")
}
"use server"

// FIX 1: Was using getCurrentUser() helper — replaced with canonical createClient().
// FIX 2: Removed all commented-out dead code.
// FIX 3: File was action.tsx (no JSX) — should be action.ts.

import { createClient } from "@/utils/supabase/server"
import { insertCertifications } from "@/lib/db/certifications"
import { redirect } from "next/navigation"

export async function saveCertifications(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login?error=Session+expired.+Please+sign+in+again.")
  }

  const rows: { user_id: string; certification_name: string; issuing_body: string; year_completed: number | null; is_active: boolean }[] = []
  let i = 0

  while (formData.get(`cert_${i}_name`)) {
    const name = (formData.get(`cert_${i}_name`) as string).trim()
    if (name) {
      rows.push({
        user_id:            user.id,
        certification_name: name,
        issuing_body:       (formData.get(`cert_${i}_org`) as string | null) ?? "",
        year_completed:     Number(formData.get(`cert_${i}_year`)) || null,
        is_active:          true,
      })
    }
    i++
  }

  if (rows.length > 0) {
    await insertCertifications(rows)
  }

  redirect("/onboarding/experience")
}
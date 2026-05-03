"use server"

/**
 * app/onboarding/preferences/action.ts
 *
 * FIXES:
 * 1. Old version imported `JobType`, `StudyMode` from aspirant.types — these
 *    types don't match the schema or the preferences page form. Removed.
 * 2. Old version read `job_types`, `states`, `study_mode`, `hours` from FormData —
 *    none of these match what the preferences page form sends. Fixed to:
 *      - preferred_sectors  (checkbox group)
 *      - preferred_states   (multi-select)
 *      - target_exams       (checkbox group)
 *      - willing_to_relocate (single checkbox)
 * 3. Used `getCurrentUser()` helper — replaced with canonical createClient().
 *
 * NOTE: This file is the per-route action for /onboarding/preferences.
 * The same logic is also exported from actions/onboarding.ts as savePreferences()
 * so both import paths work.
 */

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { setOnboardingStep } from "@/lib/db/profiles"

export async function savePreferences(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/auth/login?error=Session+expired.+Please+sign+in+again.")
  }

  try {
    // FIX: field names now match the preferences page form exactly
    const preferredSectors  = formData.getAll("preferred_sectors")  as string[]
    const preferredStates   = formData.getAll("preferred_states")   as string[]
    const targetExams       = formData.getAll("target_exams")       as string[]
    const willingToRelocate = formData.get("willing_to_relocate") === "true"

    const { error } = await supabase
      .from("aspirant_preferences")
      .upsert(
        {
          user_id:             user.id,
          preferred_sectors:   preferredSectors,
          preferred_states:    preferredStates,
          target_exams:        targetExams,
          willing_to_relocate: willingToRelocate,
        },
        { onConflict: "user_id" }
      )

    if (error) throw new Error(error.message)

    await setOnboardingStep(user.id, 5)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save preferences"
    redirect(`/onboarding/preferences?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/complete")
}
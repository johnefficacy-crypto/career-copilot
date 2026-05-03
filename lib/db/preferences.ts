// import { createClient } from "@/utils/supabase/server"

// // FIX: removed `import { cookies }` and `createClient(cookieStore)`.

// export interface AspirantPreferencesInsert {
//   user_id: string
//   preferred_sectors?: string[]
//   preferred_states?: string[]
//   target_exams?: string[]
//   willing_to_relocate?: boolean
// }

// export async function insertPreferences(row: AspirantPreferencesInsert) {
//   const supabase = await createClient()   // ← no cookieStore arg

//   const { error } = await supabase
//     .from("aspirant_preferences")
//     .upsert(row, { onConflict: "user_id" })

//   if (error) throw new Error(error.message)
// }



import { createClient } from "@/utils/supabase/server"
import type { PreferencesStepPayload } from "@/types/onboarding"

/**
 * Upsert preferences for a user.
 *
 * Schema fact (from CLI-generated supabase.ts):
 *   aspirant_preferences has a UNIQUE constraint on user_id (isOneToOne: true).
 *   So we can safely upsert on user_id.
 *
 * NOT in schema → NOT written here:
 *   study_mode, study_hours_per_day
 *   If you later add these to the DB, add them here. Do not write to columns
 *   that don't exist.
 */
export async function upsertPreferences(
  userId: string,
  data: PreferencesStepPayload
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("aspirant_preferences")
    .upsert(
      {
        user_id:             userId,
        preferred_sectors:   data.preferred_sectors,
        preferred_states:    data.preferred_states,
        target_exams:        data.target_exams,
        willing_to_relocate: data.willing_to_relocate,
      },
      { onConflict: "user_id" }
    )

  if (error) throw new Error(`upsertPreferences: ${error.message}`)
}

export async function getPreferences(userId: string): Promise<PreferencesStepPayload | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("aspirant_preferences")
    .select(
      "preferred_sectors, preferred_states, target_exams, willing_to_relocate"
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(`getPreferences: ${error.message}`)
  if (!data) return null

  return {
    preferred_sectors:   data.preferred_sectors   ?? [],
    preferred_states:    data.preferred_states    ?? [],
    target_exams:        data.target_exams        ?? [],
    willing_to_relocate: data.willing_to_relocate ?? true,
  }
}
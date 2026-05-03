import { createClient } from "@/utils/supabase/server"

export type EducationInsert = {
  level: string
  degree?: string | null
  stream?: string | null
  institution?: string | null
  university?: string | null
  graduation_year?: number | null
  percentage?: number | null
  cgpa?: number | null
  is_completed?: boolean
}

/**
 * Get all education records for a user.
 */
export async function getEducation(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("aspirant_education")
    .select("*")
    .eq("user_id", userId)
    .order("graduation_year", { ascending: false })

  if (error) throw new Error(`Failed to fetch education: ${error.message}`)
  return data ?? []
}

/**
 * Upsert education records.
 * Deletes existing records for the user and re-inserts.
 * This is simpler than diffing individual rows during onboarding.
 */
export async function replaceEducation(userId: string, records: EducationInsert[]) {
  const supabase = await createClient()

  // Delete existing
  const { error: deleteError } = await supabase
    .from("aspirant_education")
    .delete()
    .eq("user_id", userId)

  if (deleteError) throw new Error(`Failed to clear education: ${deleteError.message}`)

  if (records.length === 0) return

  // Insert fresh
  const { error: insertError } = await supabase
    .from("aspirant_education")
    .insert(records.map((r) => ({ ...r, user_id: userId })))

  if (insertError) throw new Error(`Failed to save education: ${insertError.message}`)
}

/**
 * Get the highest education level for a user.
 * Used by the eligibility engine.
 */
export async function getHighestEducation(userId: string) {
  const supabase = await createClient()

  const levelOrder = ["phd", "postgraduate", "graduate", "diploma", "12th", "10th"]

  const { data } = await supabase
    .from("aspirant_education")
    .select("level, degree, stream, percentage, cgpa")
    .eq("user_id", userId)
    .eq("is_completed", true)

  if (!data || data.length === 0) return null

  return data.sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  )[0]
}


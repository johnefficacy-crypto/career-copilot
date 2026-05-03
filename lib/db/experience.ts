import { createClient } from "@/utils/supabase/server"
import type { ExperienceRowInsert, ExperienceRowFromDB } from "@/types/onboarding"

// ─── Local DB row shape ───────────────────────────────────────────────────────
// Declared explicitly so the .map() below doesn't depend on Supabase's
// inferred type (which breaks when .select() receives a non-literal string).

type ExperienceDBRow = {
  id:               string
  user_id:          string | null
  sector:           string | null
  role:             string | null
  organization:     string | null
  start_date:       string | null
  end_date:         string | null
  years_experience: number | null
  created_at:       string | null
}

/**
 * Replace all experience rows for a user atomically.
 * Idempotent delete-then-insert — safe on revisit.
 */
export async function replaceExperience(
  userId: string,
  records: ExperienceRowInsert[]
): Promise<void> {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("aspirant_experience")
    .delete()
    .eq("user_id", userId)

  if (deleteError) throw new Error(`replaceExperience delete: ${deleteError.message}`)

  if (records.length === 0) return

  const rows = records.map((r) => ({
    user_id:          userId,
    sector:           r.sector,
    role:             r.role,
    organization:     r.organization,
    start_date:       r.start_date,
    end_date:         r.end_date,
    years_experience: r.years_experience,
  }))

  const { error: insertError } = await supabase
    .from("aspirant_experience")
    .insert(rows)

  if (insertError) throw new Error(`replaceExperience insert: ${insertError.message}`)
}

export async function getExperience(userId: string): Promise<ExperienceRowFromDB[]> {
  const supabase = await createClient()

  // FIX: Use a single unbroken string literal — never string concatenation.
  // Supabase's TypeScript inference only works on literal strings. A "a" + "b"
  // expression can't be parsed at compile time, so it falls back to
  // GenericStringError and every row property becomes unknown.
  const { data, error } = await supabase
    .from("aspirant_experience")
    .select("id, user_id, sector, role, organization, start_date, end_date, years_experience, created_at")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })

  if (error) throw new Error(`getExperience: ${error.message}`)

  // Explicit cast to the local type so the .map() is fully typed regardless
  // of what Supabase infers from the select string.
  return (data as ExperienceDBRow[] ?? []).map((row) => ({
    id:               row.id,
    user_id:          row.user_id,
    sector:           row.sector,
    role:             row.role,
    organization:     row.organization,
    start_date:       row.start_date,
    end_date:         row.end_date,
    years_experience: row.years_experience,
    created_at:       row.created_at,
  }))
}
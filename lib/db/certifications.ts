import { createClient } from "@/utils/supabase/server"

// FIX: removed `import { cookies }` and `createClient(cookieStore)`.
// The canonical server client calls `await createClient()` with no arguments.

export interface CertificationEntry {
  user_id: string
  certification_name: string
  issuing_body?: string
  year_completed?: number | null
  is_active?: boolean
}

export async function insertCertifications(rows: CertificationEntry[]) {
  const supabase = await createClient()   // ← no cookieStore arg

  const { error } = await supabase
    .from("aspirant_certifications")
    .insert(rows)

  if (error) throw new Error(error.message)
}
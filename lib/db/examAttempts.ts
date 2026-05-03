import { createClient } from "@/utils/supabase/server"

// FIX: removed `import { cookies }` and `createClient(cookieStore)`.
// FIX: table was "aspirant_exam_attempts" — schema uses "user_exam_attempts".
//      Aligned with the schema documented in the handover and dashboard.ts.

export interface ExamAttemptInsert {
  exam_name: string
  attempts_used: number
  recruitment_id?: string | null
}

export async function insertExamAttempts(rows: ExamAttemptInsert[]) {
  const supabase = await createClient()   // ← no cookieStore arg

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("Unauthorized")

  const rowsWithUser = rows.map((r) => ({
    ...r,
    user_id: user.id,
  }))

  // FIX: correct table name from schema ("user_exam_attempts", not "aspirant_exam_attempts")
  const { error } = await supabase
    .from("user_exam_attempts")
    .upsert(rowsWithUser, { onConflict: "user_id,exam_name" })

  if (error) throw new Error(error.message)
}
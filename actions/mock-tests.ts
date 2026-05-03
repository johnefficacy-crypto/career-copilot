"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createMockTest, deleteMockTest } from "@/lib/db/mock-tests"

export async function saveMockTestAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  const subjectsJson = formData.get("subjects_json") as string | null

  try {
    await createMockTest(user.id, {
      exam_name:            formData.get("exam_name") as string,
      plan_id:              (formData.get("plan_id") as string) || undefined,
      test_name:            (formData.get("test_name") as string) || undefined,
      attempted_at:         (formData.get("attempted_at") as string) || undefined,
      total_marks:          formData.get("total_marks")    ? Number(formData.get("total_marks"))    : undefined,
      scored_marks:         formData.get("scored_marks")   ? Number(formData.get("scored_marks"))   : undefined,
      total_questions:      formData.get("total_questions") ? Number(formData.get("total_questions")) : undefined,
      attempted_questions:  formData.get("attempted_questions") ? Number(formData.get("attempted_questions")) : undefined,
      correct_answers:      formData.get("correct_answers") ? Number(formData.get("correct_answers")) : undefined,
      wrong_answers:        formData.get("wrong_answers")  ? Number(formData.get("wrong_answers"))  : undefined,
      unattempted:          formData.get("unattempted")    ? Number(formData.get("unattempted"))    : undefined,
      duration_mins:        formData.get("duration_mins")  ? Number(formData.get("duration_mins"))  : undefined,
      percentile:           formData.get("percentile")     ? Number(formData.get("percentile"))     : undefined,
      rank_in_series:       formData.get("rank_in_series") ? Number(formData.get("rank_in_series")) : undefined,
      notes:                (formData.get("notes") as string) || undefined,
      breakdowns:           subjectsJson ? JSON.parse(subjectsJson) : undefined,
    })
    revalidatePath("/dashboard/study-plan/mock-tests")
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save test" }
  }
}

export async function deleteMockTestAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  const id = formData.get("id") as string
  try {
    await deleteMockTest(id, user.id)
    revalidatePath("/dashboard/study-plan/mock-tests")
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete test" }
  }
}

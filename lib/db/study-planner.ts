import { createClient } from "@/utils/supabase/server"
import type { GeneratedPlan } from "@/lib/ai/study-planner"

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getUserPlans(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("study_plans")
    .select(`
      id, exam_name, target_date, daily_hours, weekly_days,
      current_level, status, generated_at,
      study_weeks ( id, week_number, title, focus_area, status )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("generated_at", { ascending: false })
  return data ?? []
}

export async function getPlanWithWeeks(planId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("study_plans")
    .select(`
      *,
      study_weeks (
        id, week_number, title, focus_area, description,
        topics, daily_tasks, resources, status, completed_at
      )
    `)
    .eq("id", planId)
    .eq("user_id", userId)
    .single()

  if (!data) return null

  return {
    ...data,
    study_weeks: [...(data.study_weeks ?? [])].sort(
      (a, b) => a.week_number - b.week_number
    ),
  }
}

/**
 * Persist a generated plan + all its weeks to the database.
 * Returns the created plan ID.
 */
export async function savePlan(
  userId: string,
  meta: {
    recruitment_id?: string | null
    exam_name: string
    target_date?: string | null
    daily_hours: number
    weekly_days: number
    current_level: string
  },
  generatedPlan: GeneratedPlan
): Promise<string> {
  const supabase = await createClient()

  // Archive any existing active plan for the same exam
  await supabase
    .from("study_plans")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("exam_name", meta.exam_name)
    .eq("status", "active")

  // Insert new plan
  const { data: plan, error: planError } = await supabase
    .from("study_plans")
    .insert({
      user_id: userId,
      recruitment_id: meta.recruitment_id ?? null,
      exam_name: meta.exam_name,
      target_date: meta.target_date ?? null,
      daily_hours: meta.daily_hours,
      weekly_days: meta.weekly_days,
      current_level: meta.current_level,
      status: "active",
    })
    .select()
    .single()

  if (planError || !plan) throw new Error(`Failed to save plan: ${planError?.message}`)

  // Insert all weeks
  const weekRows = generatedPlan.weeks.map((w) => ({
    plan_id: plan.id,
    week_number: w.week_number,
    title: w.title,
    focus_area: w.focus_area,
    description: w.description,
    topics: w.topics,
    daily_tasks: w.daily_tasks,
    resources: w.resources,
    status: "pending",
  }))

  const { error: weeksError } = await supabase
    .from("study_weeks")
    .insert(weekRows)

  if (weeksError) throw new Error(`Failed to save weeks: ${weeksError.message}`)

  return plan.id
}

export async function deletePlan(planId: string, userId: string) {
  const supabase = await createClient()
  await supabase
    .from("study_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", userId)
}

// ─── Week progress ────────────────────────────────────────────────────────────

export async function markWeekStatus(
  weekId: string,
  userId: string,
  status: "pending" | "in_progress" | "completed"
) {
  const supabase = await createClient()

  // Verify ownership via join
  const { data: week } = await supabase
    .from("study_weeks")
    .select("plan_id, study_plans!inner(user_id)")
    .eq("id", weekId)
    .single()

  if ((week as { study_plans?: { user_id?: string } | null } | null)?.study_plans?.user_id !== userId) {
    throw new Error("Unauthorized")
  }

  await supabase
    .from("study_weeks")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", weekId)
}

// ─── Study logs ───────────────────────────────────────────────────────────────

export async function logStudySession(
  userId: string,
  input: {
    plan_id: string
    week_id?: string | null
    hours_studied: number
    topics_covered: string[]
    notes?: string | null
    mood?: string | null
    logged_date?: string
  }
) {
  const supabase = await createClient()
  const { error } = await supabase.from("study_logs").insert({
    user_id: userId,
    plan_id: input.plan_id,
    week_id: input.week_id ?? null,
    hours_studied: input.hours_studied,
    topics_covered: input.topics_covered,
    notes: input.notes ?? null,
    mood: input.mood ?? null,
    logged_date: input.logged_date ?? new Date().toISOString().split("T")[0],
  })
  if (error) throw new Error(error.message)
}

export async function getStudyLogs(userId: string, planId: string, limit = 30) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("study_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .order("logged_date", { ascending: false })
    .limit(limit)
  return data ?? []
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getPlanStats(planId: string, userId: string) {
  const supabase = await createClient()

  const [weeksRes, logsRes] = await Promise.all([
    supabase
      .from("study_weeks")
      .select("status")
      .eq("plan_id", planId),
    supabase
      .from("study_logs")
      .select("hours_studied, logged_date")
      .eq("plan_id", planId)
      .eq("user_id", userId),
  ])

  const weeks = weeksRes.data ?? []
  const logs  = logsRes.data ?? []

  const totalWeeks     = weeks.length
  const completedWeeks = weeks.filter((w) => w.status === "completed").length
  const inProgressWeek = weeks.find((w) => w.status === "in_progress")
  const totalHours     = logs.reduce((s, l) => s + (l.hours_studied ?? 0), 0)
  const studyDays      = new Set(logs.map((l) => l.logged_date)).size

  // Streak: consecutive days studied up to today
  const sortedDates = [...new Set(logs.map((l) => l.logged_date))].sort().reverse()
  let streak = 0
  let checkDate = new Date()
  for (const d of sortedDates) {
    const logDate = new Date(d)
    const diff = Math.round(
      (checkDate.getTime() - logDate.getTime()) / (24 * 60 * 60 * 1000)
    )
    if (diff <= 1) { streak++; checkDate = logDate }
    else break
  }

  return {
    totalWeeks,
    completedWeeks,
    percentComplete: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
    totalHours: Math.round(totalHours * 10) / 10,
    studyDays,
    streak,
    hasActiveWeek: !!inProgressWeek,
  }
}
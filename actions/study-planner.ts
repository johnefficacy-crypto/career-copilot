"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { generateStudyPlan, type PlannerInput } from "@/lib/ai/study-planner"
import { savePlan, deletePlan, markWeekStatus, logStudySession } from "@/lib/db/study-planner"
import { getGate } from "@/lib/billing/gate"

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user
}

// ─── Typed shape for exam stage rows ─────────────────────────────────────────
// Avoids `as any` when mapping over the Supabase response.

type ExamStageRow = { stage_name: string | null }

// ─── Generate plan ────────────────────────────────────────────────────────────

export async function generatePlan(formData: FormData) {
  const user = await requireUser()
  const supabase = await createClient()

  // ── Gate check 1: plan count limit ──────────────────────────────────
  const gate = await getGate(user.id)

  const { count: existingPlanCount } = await supabase
    .from("study_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")

  if (!gate.within("study_plans_limit", existingPlanCount ?? 0)) {
    const limit = gate.features.study_plans_limit
    redirect(
      `/pricing?error=${encodeURIComponent(
        `You've reached the limit of ${limit} active study plan${limit !== 1 ? "s" : ""} on the ${gate.planId} plan. Upgrade to create more.`
      )}`
    )
  }

  // ── Gate check 2: monthly regeneration limit ─────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: monthlyCount } = await supabase
    .from("study_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("generated_at", startOfMonth.toISOString())

  if (!gate.within("plan_regenerations_per_month", monthlyCount ?? 0)) {
    redirect(
      `/pricing?error=${encodeURIComponent(
        `Monthly limit of ${gate.features.plan_regenerations_per_month} AI generations reached. Upgrade to Pro for more.`
      )}`
    )
  }

  // ── Resolve optional recruitment_id ─────────────────────────────────
  const recruitmentIdRaw = formData.get("recruitment_id")
  const recruitmentId =
    typeof recruitmentIdRaw === "string" && recruitmentIdRaw.length > 0
      ? recruitmentIdRaw
      : null

  // ── Load user context in parallel ───────────────────────────────────
  const [profileRes, eduRes, examStagesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),

    supabase
      .from("aspirant_education")
      .select("level, stream, degree")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .order("graduation_year", { ascending: false })
      .limit(1),

    // Only query exam_stages if we have a recruitment_id
    recruitmentId
      ? supabase
          .from("exam_stages")
          .select("stage_name")
          .eq("recruitment_id", recruitmentId)
          .order("stage_order")
      : Promise.resolve<{ data: ExamStageRow[] | null }>({ data: [] }),
  ])

  const profile = profileRes.data
  const edu     = eduRes.data?.[0]

  // Typed stage extraction — no any, null-filtered
  const stages: string[] = (examStagesRes.data ?? [])
    .map((s: ExamStageRow) => s.stage_name)
    .filter((n): n is string => n !== null)

  // ── Build planner input ──────────────────────────────────────────────
  const examName     = formData.get("exam_name") as string
  const targetDate   = (formData.get("target_date") as string) || null
  const dailyHours   = Number(formData.get("daily_hours") ?? 2)
  const weeklyDays   = Number(formData.get("weekly_days") ?? 5)
  const currentLevel = (formData.get("current_level") as PlannerInput["currentLevel"]) || "beginner"

  const plannerInput: PlannerInput = {
    examName,
    examType:            (formData.get("exam_type") as string) || "Government",
    targetDate,
    examStages:          stages,
    currentLevel,
    dailyHours,
    weeklyDays,
    educationLevel:      edu?.level ?? profile?.career_stage ?? "graduate",
    educationStream:     edu?.stream ?? edu?.degree ?? null,
    workingProfessional: profile?.govt_employee ?? false,
    category:            profile?.category ?? null,
    strongSubjects:      (formData.get("strong_subjects") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    weakSubjects:        (formData.get("weak_subjects") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    previousAttempts:    Number(formData.get("previous_attempts") ?? 0),
  }

  // ── Generate and persist ─────────────────────────────────────────────
  let planId: string

  try {
    const generatedPlan = await generateStudyPlan(plannerInput)
    planId = await savePlan(
      user.id,
      {
        recruitment_id: recruitmentId,
        exam_name:      examName,
        target_date:    targetDate,
        daily_hours:    dailyHours,
        weekly_days:    weeklyDays,
        current_level:  currentLevel,
      },
      generatedPlan
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed"
    redirect(`/dashboard/study-plan/new?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/study-plan")
  redirect(`/dashboard/study-plan/${planId}`)
}

// ─── Delete plan ──────────────────────────────────────────────────────────────

export async function deletePlanAction(formData: FormData) {
  const user = await requireUser()
  const planId = formData.get("plan_id") as string
  await deletePlan(planId, user.id)
  revalidatePath("/dashboard/study-plan")
  redirect("/dashboard/study-plan")
}

// ─── Week status ──────────────────────────────────────────────────────────────

export async function updateWeekStatus(formData: FormData) {
  const user = await requireUser()
  const weekId = formData.get("week_id") as string
  const status = formData.get("status") as "pending" | "in_progress" | "completed"
  const planId = formData.get("plan_id") as string
  await markWeekStatus(weekId, user.id, status)
  revalidatePath(`/dashboard/study-plan/${planId}`)
}

// ─── Log study session ────────────────────────────────────────────────────────

export async function logSession(formData: FormData) {
  const user = await requireUser()
  const planId    = formData.get("plan_id") as string
  const topicsRaw = formData.get("topics_covered") as string

  await logStudySession(user.id, {
    plan_id:        planId,
    week_id:        (formData.get("week_id") as string) || null,
    hours_studied:  Number(formData.get("hours_studied")),
    topics_covered: topicsRaw
      ? topicsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    notes:       (formData.get("notes") as string) || null,
    mood:        (formData.get("mood") as string) || null,
    logged_date: (formData.get("logged_date") as string) || undefined,
  })

  revalidatePath(`/dashboard/study-plan/${planId}`)
}
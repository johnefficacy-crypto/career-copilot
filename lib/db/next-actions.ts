/**
 * lib/db/next-actions.ts
 * Career Copilot — Next-Best-Action Engine
 *
 * Generates a prioritised list of concrete actions for a user based on:
 *   - Eligible recruitments with upcoming deadlines
 *   - Profile completeness gaps
 *   - Study plan activity (study today / setup plan)
 *   - Unread notification count
 *
 * Actions are stored in user_next_actions and surfaced on the dashboard.
 * Generation is deterministic (no AI call). AI explanation of actions comes later (AI-9).
 *
 * Priority scale: 1 = highest urgency, 10 = lowest
 */

import { createClient } from "@/utils/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export type NextActionType =
  | "apply_now"
  | "deadline_alert"
  | "complete_profile"
  | "study_today"
  | "setup_plan"
  | "check_eligibility"
  | "check_notifications"
  | "mock_test"

export interface NextAction {
  id:          string
  user_id:     string
  action_type: NextActionType
  title:       string
  description: string | null
  cta_label:   string | null
  cta_url:     string | null
  source_type: string | null
  source_id:   string | null
  priority:    number
  due_at:      string | null
  status:      "pending" | "done" | "snoozed" | "dismissed"
  snoozed_until: string | null
  created_at:  string
  completed_at: string | null
  expires_at:  string | null
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getUserNextActions(userId: string): Promise<NextAction[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("user_next_actions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "snoozed"])
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order("priority", { ascending: true })
    .order("due_at",   { ascending: true, nullsFirst: false })
    .limit(8)

  if (error) throw new Error(`getUserNextActions: ${error.message}`)
  return (data ?? []) as NextAction[]
}

// ─── Status mutations ─────────────────────────────────────────────────────────

export async function markNextActionDone(actionId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("user_next_actions")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", userId === "" ? actionId : actionId)
    .eq("user_id", userId)
  if (error) throw new Error(`markNextActionDone: ${error.message}`)
}

export async function dismissNextAction(actionId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("user_next_actions")
    .update({ status: "dismissed" })
    .eq("id", actionId)
    .eq("user_id", userId)
  if (error) throw new Error(`dismissNextAction: ${error.message}`)
}

export async function snoozeNextAction(
  actionId: string,
  userId: string,
  hours = 24
): Promise<void> {
  const supabase = await createClient()
  const until = new Date(Date.now() + hours * 3_600_000).toISOString()
  const { error } = await supabase
    .from("user_next_actions")
    .update({ status: "snoozed", snoozed_until: until })
    .eq("id", actionId)
    .eq("user_id", userId)
  if (error) throw new Error(`snoozeNextAction: ${error.message}`)
}

// ─── Generator ────────────────────────────────────────────────────────────────
// Clears stale pending actions and regenerates from current state.
// Called after: onboarding, eligibility recompute, plan generation, profile update.

export async function generateNextActions(userId: string): Promise<NextAction[]> {
  const supabase = await createClient()
  const now = new Date()

  // ── 1. Gather signals in parallel ─────────────────────────────────────────
  const [profileRes, educationRes, prefsRes, eligRes, planRes, logsRes, alertsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("onboarding_completed, dob, category, domicile_state, target_exam")
        .eq("id", userId)
        .single(),

      supabase
        .from("aspirant_education")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_completed", true),

      supabase
        .from("aspirant_preferences")
        .select("target_exams")
        .eq("user_id", userId)
        .maybeSingle(),

      // Eligible/conditional recruitments with upcoming deadlines
      supabase
        .from("eligibility_results")
        .select(`
          recruitment_id, is_eligible, is_conditional,
          recruitments ( name, apply_end_date, status )
        `)
        .eq("user_id", userId)
        .or("is_eligible.eq.true,is_conditional.eq.true")
        .limit(20),

      // Active study plan
      supabase
        .from("study_plans")
        .select("id, exam_name, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("generated_at", { ascending: false })
        .limit(1),

      // Today's study log
      supabase
        .from("study_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("logged_date", now.toISOString().split("T")[0])
        .limit(1),

      // Unread notifications count
      supabase
        .from("notification_alerts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
    ])

  const profile  = profileRes.data
  const hasEduc  = (educationRes.count ?? 0) > 0
  const prefs    = prefsRes.data
  const eligible = (eligRes.data ?? []) as Array<{
    recruitment_id: string
    is_eligible: boolean
    is_conditional: boolean
    recruitments: { name: string; apply_end_date: string | null; status: string } | null
  }>
  const activePlan   = planRes.data?.[0] ?? null
  const studiedToday = (logsRes.data ?? []).length > 0
  const unreadAlerts = alertsRes.count ?? 0

  // ── 2. Build candidate actions ─────────────────────────────────────────────
  const candidates: Omit<NextAction, "id" | "user_id" | "created_at">[] = []

  // A) Deadline-based apply_now / deadline_alert
  for (const row of eligible) {
    const rec = row.recruitments
    if (!rec || !rec.apply_end_date) continue
    if (!["active", "open"].includes(rec.status ?? "")) continue

    const deadline  = new Date(rec.apply_end_date)
    const daysLeft  = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
    if (daysLeft < 0) continue  // already closed

    let priority: number
    let action_type: NextActionType
    let title: string
    let description: string

    if (daysLeft <= 1) {
      priority    = 1
      action_type = "apply_now"
      title       = `Last day to apply — ${rec.name}`
      description = "Application closes today. Complete it before midnight."
    } else if (daysLeft <= 3) {
      priority    = 2
      action_type = "apply_now"
      title       = `Apply now — ${rec.name}`
      description = `${daysLeft} days left to apply. Don't miss this deadline.`
    } else if (daysLeft <= 7) {
      priority    = 3
      action_type = "deadline_alert"
      title       = `${rec.name} closes in ${daysLeft} days`
      description = "Gather your documents and fee payment before the deadline."
    } else {
      priority    = 5
      action_type = "deadline_alert"
      title       = `${rec.name} — apply by ${deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
      description = row.is_conditional
        ? "You may be conditionally eligible. Complete your profile to confirm."
        : "You are eligible. Bookmark this and apply before the deadline."
    }

    candidates.push({
      action_type,
      title,
      description,
      cta_label:   "View recruitment",
      cta_url:     `/dashboard/recruitments/${row.recruitment_id}`,
      source_type: "recruitment",
      source_id:   row.recruitment_id,
      priority,
      due_at:      rec.apply_end_date,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  rec.apply_end_date,
    })
  }

  // B) Profile gap: missing dob
  if (!profile?.dob) {
    candidates.push({
      action_type: "complete_profile",
      title:       "Add your date of birth",
      description: "Required for age-based eligibility rules. Unlocks matches for age-restricted exams.",
      cta_label:   "Update profile",
      cta_url:     "/dashboard/profile",
      source_type: "profile",
      source_id:   "dob",
      priority:    4,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // C) Profile gap: missing category
  if (!profile?.category) {
    candidates.push({
      action_type: "complete_profile",
      title:       "Set your reservation category",
      description: "General / OBC / SC / ST / EWS — required for correct relaxation calculations.",
      cta_label:   "Update profile",
      cta_url:     "/dashboard/profile",
      source_type: "profile",
      source_id:   "category",
      priority:    4,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // D) Profile gap: missing education
  if (!hasEduc) {
    candidates.push({
      action_type: "complete_profile",
      title:       "Add your highest qualification",
      description: "Education records are required to match you with eligible exam posts.",
      cta_label:   "Add education",
      cta_url:     "/dashboard/profile",
      source_type: "profile",
      source_id:   "education",
      priority:    4,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // E) Profile gap: missing domicile
  if (!profile?.domicile_state) {
    candidates.push({
      action_type: "complete_profile",
      title:       "Add your domicile state",
      description: "Required for state-level and domicile-restricted exams.",
      cta_label:   "Update profile",
      cta_url:     "/dashboard/profile",
      source_type: "profile",
      source_id:   "domicile_state",
      priority:    4,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // F) No target exams set
  const hasTargetExams = Array.isArray(prefs?.target_exams) &&
    (prefs.target_exams as unknown[]).length > 0
  if (!hasTargetExams && profile?.onboarding_completed) {
    candidates.push({
      action_type: "complete_profile",
      title:       "Select your target exams",
      description: "Helps Career Copilot prioritise the most relevant opportunities for you.",
      cta_label:   "Set preferences",
      cta_url:     "/dashboard/profile",
      source_type: "profile",
      source_id:   "target_exams",
      priority:    5,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // G) Study today — active plan but no session logged today
  if (activePlan && !studiedToday) {
    candidates.push({
      action_type: "study_today",
      title:       `Study session due — ${activePlan.exam_name}`,
      description: "You haven't logged any study time today. Keep your streak going.",
      cta_label:   "Open study plan",
      cta_url:     `/dashboard/study-plan/${activePlan.id}`,
      source_type: "study_plan",
      source_id:   activePlan.id,
      priority:    6,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
    })
  }

  // H) No active plan — suggest creating one
  if (!activePlan && profile?.onboarding_completed) {
    const targetExam = profile.target_exam ?? "your target exam"
    candidates.push({
      action_type: "setup_plan",
      title:       "Create a study plan",
      description: `Generate a personalised preparation plan for ${targetExam}.`,
      cta_label:   "Create plan",
      cta_url:     "/dashboard/study-plan/new",
      source_type: "study_plan",
      source_id:   null,
      priority:    7,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  // I) Unread notifications
  if (unreadAlerts > 0) {
    candidates.push({
      action_type: "check_notifications",
      title:       `${unreadAlerts} unread notification${unreadAlerts > 1 ? "s" : ""}`,
      description: "You have unread exam alerts. Review them to stay on top of deadlines.",
      cta_label:   "View notifications",
      cta_url:     "/dashboard/notifications",
      source_type: "notification",
      source_id:   null,
      priority:    8,
      due_at:      null,
      status:      "pending",
      snoozed_until: null,
      completed_at:  null,
      expires_at:  null,
    })
  }

  if (candidates.length === 0) return []

  // ── 3. Deduplicate by source_id + action_type keeping highest-priority ──────
  // Sort by priority ascending (lowest number = most urgent)
  candidates.sort((a, b) => a.priority - b.priority)

  // ── 4. Delete stale pending actions and upsert new set ────────────────────
  // We regenerate the full set so the panel always reflects current state.
  await supabase
    .from("user_next_actions")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending")

  const rows = candidates.slice(0, 8).map(c => ({
    user_id:      userId,
    ...c,
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from("user_next_actions")
    .insert(rows)
    .select("*")

  if (insertErr) throw new Error(`generateNextActions insert: ${insertErr.message}`)
  return (inserted ?? []) as NextAction[]
}

// ─── Get-or-generate ─────────────────────────────────────────────────────────
// Returns cached actions if generated in the last 30 min, otherwise regenerates.

export async function getOrGenerateNextActions(userId: string): Promise<NextAction[]> {
  const supabase = await createClient()

  // Check if we have recent pending actions (generated in last 30 min)
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
  const { data: recent } = await supabase
    .from("user_next_actions")
    .select("created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("created_at", cutoff)
    .limit(1)

  if ((recent ?? []).length > 0) {
    // Return cached set
    return getUserNextActions(userId)
  }

  // Regenerate
  return generateNextActions(userId)
}

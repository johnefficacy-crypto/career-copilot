/**
 * lib/db/study-tasks.ts
 * Career Copilot — Study Tasks DB layer
 *
 * Manages study_tasks: daily execution units derived from study_weeks.
 * Also manages study_sessions (focus timer records).
 *
 * Architecture:
 *  - study_plans → study_weeks → study_tasks (granular daily work)
 *  - study_sessions → linked to task / subject / topic for time analytics
 */

import { createClient } from "@/utils/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType    = "study" | "practice" | "revise" | "mock" | "read" | "watch"
export type TaskStatus  = "pending" | "in_progress" | "done" | "skipped"

export interface StudyTask {
  id:            string
  user_id:       string
  plan_id:       string
  week_id:       string | null
  day_label:     string
  subject:       string | null
  topic:         string | null
  microtopic:    string | null
  task_type:     TaskType
  title:         string
  description:   string | null
  duration_mins: number | null
  resources:     Array<{ title: string; url?: string; type?: string }> | null
  status:        TaskStatus
  completed_at:  string | null
  notes:         string | null
  created_at:    string
}

export interface StudySession {
  id:            string
  user_id:       string
  plan_id:       string | null
  task_id:       string | null
  exam_name:     string | null
  subject:       string | null
  topic:         string | null
  session_type:  "focus" | "pomodoro" | "review" | "mock"
  started_at:    string
  ended_at:      string | null
  duration_mins: number | null
  notes:         string | null
  created_at:    string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTodaysTasks(userId: string, planId: string): Promise<StudyTask[]> {
  const supabase   = await createClient()
  const todayLabel = new Date().toISOString().split("T")[0]
  const dayName    = new Date().toLocaleDateString("en-US", { weekday: "long" })

  // Match on ISO date OR weekday name — tasks may be stored either way
  const { data, error } = await supabase
    .from("study_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .or(`day_label.eq.${todayLabel},day_label.eq.${dayName}`)
    .order("created_at", { ascending: true })

  if (error) throw new Error(`getTodaysTasks: ${error.message}`)
  return (data ?? []) as StudyTask[]
}

export async function getTasksByWeek(
  userId: string,
  weekId: string
): Promise<StudyTask[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("study_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .order("day_label", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(`getTasksByWeek: ${error.message}`)
  return (data ?? []) as StudyTask[]
}

export async function getPendingTasksCount(userId: string, planId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("study_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "pending")

  if (error) throw new Error(`getPendingTasksCount: ${error.message}`)
  return count ?? 0
}

export async function updateTaskStatus(
  taskId: string,
  userId: string,
  status: TaskStatus,
  notes?: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("study_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      ...(notes !== undefined ? { notes } : {}),
    })
    .eq("id", taskId)
    .eq("user_id", userId)

  if (error) throw new Error(`updateTaskStatus: ${error.message}`)
}

// ─── Task generation from weekly plan ─────────────────────────────────────────
// Converts a study_weeks.daily_tasks JSONB array into study_tasks rows.
// Called when a plan week is activated or when the user opens a week for the first time.

export async function generateTasksFromWeek(
  userId: string,
  planId: string,
  weekId: string
): Promise<StudyTask[]> {
  const supabase = await createClient()

  // Check if tasks already exist for this week
  const { count: existing } = await supabase
    .from("study_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("week_id", weekId)

  if ((existing ?? 0) > 0) {
    return getTasksByWeek(userId, weekId)
  }

  // Load week data
  const { data: week, error: weekErr } = await supabase
    .from("study_weeks")
    .select("week_number, title, focus_area, topics, daily_tasks, description")
    .eq("id", weekId)
    .single()

  if (weekErr || !week) throw new Error(`generateTasksFromWeek: week not found ${weekId}`)

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  // daily_tasks is a JSONB array; each element may be a string or object
  const rawTasks = Array.isArray(week.daily_tasks)
    ? (week.daily_tasks as (string | Record<string, unknown>)[])
    : []

  const taskRows: Omit<StudyTask, "id" | "created_at">[] = []

  if (rawTasks.length > 0) {
    // Map each AI-generated task to a study_tasks row
    rawTasks.forEach((task, idx) => {
      const dayLabel = days[idx % 7]
      if (typeof task === "string") {
        taskRows.push({
          user_id:       userId,
          plan_id:       planId,
          week_id:       weekId,
          day_label:     dayLabel,
          subject:       week.focus_area ?? null,
          topic:         null,
          microtopic:    null,
          task_type:     "study",
          title:         task,
          description:   null,
          duration_mins: 60,
          resources:     null,
          status:        "pending",
          completed_at:  null,
          notes:         null,
        })
      } else {
        taskRows.push({
          user_id:       userId,
          plan_id:       planId,
          week_id:       weekId,
          day_label:     (task.day as string) ?? dayLabel,
          subject:       (task.subject as string) ?? week.focus_area ?? null,
          topic:         (task.topic as string)   ?? null,
          microtopic:    (task.microtopic as string) ?? null,
          task_type:     (task.type as TaskType) ?? "study",
          title:         (task.title as string)  ?? `Study: ${week.focus_area}`,
          description:   (task.description as string) ?? null,
          duration_mins: (task.duration_mins as number) ?? 60,
          resources:     (task.resources as StudyTask["resources"]) ?? null,
          status:        "pending",
          completed_at:  null,
          notes:         null,
        })
      }
    })
  } else {
    // Fallback: generate one generic task per day based on topics
    const topics = Array.isArray(week.topics)
      ? (week.topics as string[])
      : []

    days.slice(0, 5).forEach((day, idx) => {
      const topic = topics[idx % Math.max(topics.length, 1)] ?? week.focus_area ?? "Study"
      taskRows.push({
        user_id:       userId,
        plan_id:       planId,
        week_id:       weekId,
        day_label:     day,
        subject:       week.focus_area ?? null,
        topic:         topic,
        microtopic:    null,
        task_type:     "study",
        title:         `${topic} — study session`,
        description:   week.description ?? null,
        duration_mins: 90,
        resources:     null,
        status:        "pending",
        completed_at:  null,
        notes:         null,
      })
    })
  }

  if (taskRows.length === 0) return []

  const { data: inserted, error: insertErr } = await supabase
    .from("study_tasks")
    .insert(taskRows)
    .select("*")

  if (insertErr) throw new Error(`generateTasksFromWeek insert: ${insertErr.message}`)
  return (inserted ?? []) as StudyTask[]
}

// ─── Study sessions (focus timer) ─────────────────────────────────────────────

export async function startStudySession(
  userId: string,
  input: {
    plan_id?:      string
    task_id?:      string
    exam_name?:    string
    subject?:      string
    topic?:        string
    session_type?: StudySession["session_type"]
  }
): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id:      userId,
      plan_id:      input.plan_id      ?? null,
      task_id:      input.task_id      ?? null,
      exam_name:    input.exam_name    ?? null,
      subject:      input.subject      ?? null,
      topic:        input.topic        ?? null,
      session_type: input.session_type ?? "focus",
      started_at:   new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(`startStudySession: ${error?.message}`)
  return data.id
}

export async function endStudySession(
  sessionId: string,
  userId: string,
  notes?: string
): Promise<void> {
  const supabase    = await createClient()
  const endedAt     = new Date()

  // Compute duration from started_at
  const { data: session } = await supabase
    .from("study_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single()

  const durationMins = session?.started_at
    ? Math.round((endedAt.getTime() - new Date(session.started_at).getTime()) / 60_000)
    : null

  const { error } = await supabase
    .from("study_sessions")
    .update({
      ended_at:      endedAt.toISOString(),
      duration_mins: durationMins,
      ...(notes ? { notes } : {}),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (error) throw new Error(`endStudySession: ${error.message}`)
}

export async function getRecentSessions(
  userId: string,
  limit = 10
): Promise<StudySession[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentSessions: ${error.message}`)
  return (data ?? []) as StudySession[]
}

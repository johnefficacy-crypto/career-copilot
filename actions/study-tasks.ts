"use server"

import { revalidatePath }      from "next/cache"
import { createClient }        from "@/utils/supabase/server"
import {
  updateTaskStatus,
  generateTasksFromWeek,
  startStudySession,
  endStudySession,
} from "@/lib/db/study-tasks"

export async function completeTask(taskId: string, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  await updateTaskStatus(taskId, user.id, "done", notes)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/study-plan", "layout")
  return { ok: true }
}

export async function skipTask(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  await updateTaskStatus(taskId, user.id, "skipped")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function setTaskInProgress(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  await updateTaskStatus(taskId, user.id, "in_progress")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function generateWeekTasks(planId: string, weekId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated", tasks: [] }

  const tasks = await generateTasksFromWeek(user.id, planId, weekId)
  revalidatePath("/dashboard/study-plan", "layout")
  return { ok: true, tasks }
}

export async function beginFocusSession(input: {
  plan_id?:   string
  task_id?:   string
  exam_name?: string
  subject?:   string
  topic?:     string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated", sessionId: null }

  const sessionId = await startStudySession(user.id, input)
  return { ok: true, sessionId }
}

export async function finishFocusSession(sessionId: string, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthenticated" }

  await endStudySession(sessionId, user.id, notes)
  revalidatePath("/dashboard")
  return { ok: true }
}

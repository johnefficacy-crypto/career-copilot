"use server"

import { revalidatePath }   from "next/cache"
import { createClient }     from "@/utils/supabase/server"
import { markNextActionDone, dismissNextAction, snoozeNextAction } from "@/lib/db/next-actions"

export async function markActionDone(actionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await markNextActionDone(actionId, user.id)
  revalidatePath("/dashboard")
}

export async function dismissAction(actionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await dismissNextAction(actionId, user.id)
  revalidatePath("/dashboard")
}

export async function snoozeAction(actionId: string, hours = 24) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await snoozeNextAction(actionId, user.id, hours)
  revalidatePath("/dashboard")
}

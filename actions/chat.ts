"use server"

/**
 * actions/chat.ts
 * Server Actions for AI Career Chat.
 * Delete is here; create/append live in the API route (streaming requirement).
 */

import { redirect }      from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient }  from "@/utils/supabase/server"
import { deleteChatSession, updateSessionTitle } from "@/lib/db/chat"

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  return user
}

// ─── Delete session ───────────────────────────────────────────────────────────

export async function deleteChatSessionAction(formData: FormData) {
  const user      = await requireUser()
  const sessionId = formData.get("session_id") as string | null

  if (!sessionId?.trim()) redirect("/dashboard/chat")

  await deleteChatSession(sessionId, user.id)

  revalidatePath("/dashboard/chat")
  redirect("/dashboard/chat")
}

// ─── Rename session ───────────────────────────────────────────────────────────

export async function renameChatSessionAction(formData: FormData) {
  const user      = await requireUser()
  const sessionId = formData.get("session_id") as string | null
  const title     = (formData.get("title") as string | null)?.trim()

  if (!sessionId?.trim() || !title) return

  await updateSessionTitle(sessionId, user.id, title.slice(0, 80))
  revalidatePath("/dashboard/chat")
}
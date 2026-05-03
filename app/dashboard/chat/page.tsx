/**
 * app/dashboard/chat/page.tsx
 * Server Component — bootstraps AI Career Chat page.
 *
 * Responsibilities:
 *  1. Auth guard
 *  2. Plan gate (free users see upgrade wall)
 *  3. Fetch session list for sidebar
 *  4. Load active session messages from ?session=<id>
 *  5. Hand off to ChatShell (client boundary)
 */

import { redirect }  from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getUserChatSessions, getChatSession } from "@/lib/db/chat"
import { ChatShell } from "@/components/chat/ChatShell"
import type { ChatMessage } from "@/types/chat"

export const metadata = { title: "AI Career Chat — Career Copilot" }
export const dynamic  = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ session?: string }>
}

export default async function ChatPage({ searchParams }: PageProps) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // ── Plan check ────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id, full_name")
    .eq("id", user.id)
    .single()

  const isPaid = profile?.plan_id === "pro" || profile?.plan_id === "elite"

  if (!isPaid) {
    return (
      <ChatShell
        isPaid={false}
        sessions={[]}
        activeSessionId={null}
        initialMessages={[]}
        userName={profile?.full_name ?? null}
      />
    )
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  const sessions = await getUserChatSessions(user.id, 40)

  // ── Active session ────────────────────────────────────────────────────────
  const params         = await searchParams
  const sessionIdParam = params.session ?? null
  let   initialMessages: ChatMessage[] = []
  let   activeSessionId: string | null = null

  if (sessionIdParam) {
    const session = await getChatSession(sessionIdParam, user.id)
    if (session) {
      activeSessionId = session.id
      initialMessages = session.messages
    }
  }

  return (
    <ChatShell
      isPaid={true}
      sessions={sessions}
      activeSessionId={activeSessionId}
      initialMessages={initialMessages}
      userName={profile?.full_name ?? null}
    />
  )
}
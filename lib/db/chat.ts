/**
 * lib/db/chat.ts
 * All Supabase queries for the AI Career Chat feature.
 *
 * FIX: Supabase's generated types represent jsonb columns as the `Json` union
 * type, which does not accept plain `object[]`. We cast via `as Json` (imported
 * from the generated types) so TypeScript is satisfied without losing safety.
 */

import { createClient } from "@/utils/supabase/server"
import type { Json }    from "@/types/supabase"          // ← generated DB types
import type {
  ChatSession,
  ChatSessionSummary,
  ChatMessage,
  StoredMessages,
  ChatUserContext,
} from "@/types/chat"

// ─── Type guard ───────────────────────────────────────────────────────────────

function parseMessages(raw: unknown): StoredMessages {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is ChatMessage =>
      typeof item === "object" &&
      item !== null &&
      "role" in item &&
      "content" in item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
  )
}

/** Safely cast ChatMessage[] → Json so Supabase insert/update accepts it. */
function toJson(messages: ChatMessage[]): Json {
  return messages as unknown as Json
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createChatSession(
  userId: string,
  title: string,
  firstMessages: ChatMessage[]
): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id:  userId,
      title,
      messages: toJson(firstMessages),
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`createChatSession: ${error?.message ?? "no data returned"}`)
  }
  return data.id
}

// ─── Read — single ────────────────────────────────────────────────────────────

export async function getChatSession(
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, user_id, title, messages, created_at, updated_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return null

  return {
    id:         data.id,
    user_id:    data.user_id,
    title:      data.title,
    messages:   parseMessages(data.messages),
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ─── Read — list ──────────────────────────────────────────────────────────────

export async function getUserChatSessions(
  userId: string,
  limit = 30
): Promise<ChatSessionSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, messages, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getUserChatSessions: ${error.message}`)

  return (data ?? []).map((row) => {
    const msgs    = parseMessages(row.messages)
    const lastMsg = msgs.at(-1)
    const preview = lastMsg?.content
      ? lastMsg.content.slice(0, 90) + (lastMsg.content.length > 90 ? "…" : "")
      : null

    return {
      id:         row.id,
      title:      row.title,
      updated_at: row.updated_at,
      preview,
    }
  })
}

// ─── Update — append messages ─────────────────────────────────────────────────

export async function appendMessages(
  sessionId: string,
  userId: string,
  newMessages: ChatMessage[]
): Promise<void> {
  const supabase = await createClient()

  const { data, error: readError } = await supabase
    .from("chat_sessions")
    .select("messages")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single()

  if (readError || !data) {
    throw new Error(`appendMessages read: ${readError?.message ?? "session not found"}`)
  }

  const existing = parseMessages(data.messages)
  const updated  = [...existing, ...newMessages]

  const { error: writeError } = await supabase
    .from("chat_sessions")
    .update({ messages: toJson(updated) })
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (writeError) throw new Error(`appendMessages write: ${writeError.message}`)
}

// ─── Update — title ───────────────────────────────────────────────────────────

export async function updateSessionTitle(
  sessionId: string,
  userId: string,
  title: string
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId)
    .eq("user_id", userId)
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteChatSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId)

  if (error) throw new Error(`deleteChatSession: ${error.message}`)
}

// ─── User context for system prompt ──────────────────────────────────────────

export async function getChatUserContext(userId: string): Promise<ChatUserContext> {
  const supabase = await createClient()

  const [profileRes, eduRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, career_stage, target_exam, category, dob, domicile_state, career_goal")
      .eq("id", userId)
      .single(),
    supabase
      .from("aspirant_education")
      .select("level, degree, stream, graduation_year")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .order("graduation_year", { ascending: false })
      .limit(1),
  ])

  const profile = profileRes.data
  const edu     = eduRes.data?.[0]

  let educationSummary: string | null = null
  if (edu) {
    const parts = [edu.level]
    if (edu.degree)          parts.push(edu.degree)
    if (edu.stream)          parts.push(`(${edu.stream})`)
    if (edu.graduation_year) parts.push(String(edu.graduation_year))
    educationSummary = parts.join(" — ")
  }

  return {
    full_name:         profile?.full_name      ?? null,
    career_stage:      profile?.career_stage   ?? null,
    target_exam:       profile?.target_exam    ?? null,
    category:          profile?.category       ?? null,
    dob:               profile?.dob            ?? null,
    domicile_state:    profile?.domicile_state ?? null,
    education_summary: educationSummary,
    career_goal:       (profile as { career_goal?: string | null })?.career_goal ?? null,
  }
}
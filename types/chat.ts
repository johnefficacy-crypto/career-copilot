/**
 * types/chat.ts
 * Phase 8 — AI Career Chat
 * Zero `any`. All shapes align with chat_sessions schema.
 */

export type MessageRole = "user" | "assistant"

export type ChatMessage = {
  role:    MessageRole
  content: string
}

export type ChatSession = {
  id:         string
  user_id:    string
  title:      string
  messages:   ChatMessage[]
  created_at: string
  updated_at: string
}

export type StoredMessages = ChatMessage[]

export type ChatRequest = {
  session_id:   string | null
  user_message: string
}

export type ChatSessionSummary = {
  id:         string
  title:      string
  updated_at: string
  preview:    string | null
}

export type ChatUserContext = {
  full_name:         string | null
  career_stage:      string | null
  target_exam:       string | null
  category:          string | null
  dob:               string | null
  domicile_state:    string | null
  education_summary: string | null
  /** Free-text career ambition the aspirant wrote during onboarding. */
  career_goal:       string | null
}
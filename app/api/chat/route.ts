/**
 * app/api/chat/route.ts
 * POST /api/chat
 *
 * Streaming API route for AI Career Chat.
 * Uses Node.js runtime (required for TransformStream + streaming bodies).
 *
 * Flow:
 *  1. Authenticate via Supabase SSR cookies
 *  2. Feature gate: Pro or Elite only
 *  3. Parse { session_id, user_message }
 *  4. Load or create chat session
 *  5. Build personalised system prompt
 *  6. Persist user message
 *  7. Stream Anthropic SSE → browser via TransformStream
 *  8. After stream ends → persist full assistant message
 *  9. Return X-Session-Id header so client can track new sessions
 */

export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/utils/supabase/server"
import {
  streamChatResponse,
  buildSystemPrompt,
  generateSessionTitle,
} from "@/lib/ai/career-chat"
import {
  getChatSession,
  createChatSession,
  appendMessages,
  getChatUserContext,
} from "@/lib/db/chat"
import type { ChatMessage, ChatRequest } from "@/types/chat"

// ─── Helper ───────────────────────────────────────────────────────────────────

function isPaidPlan(planId: string | null | undefined): boolean {
  return planId === "pro" || planId === "elite"
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  // ── 2. Feature gate ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", user.id)
    .single()

  if (!isPaidPlan(profile?.plan_id)) {
    return NextResponse.json(
      { error: "AI career chat requires a Pro or Elite subscription.", upgrade: true },
      { status: 403 }
    )
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────────
  let body: ChatRequest
  try {
    body = (await req.json()) as ChatRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 })
  }

  const { session_id, user_message } = body

  if (!user_message?.trim()) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
  }

  const trimmedMessage = user_message.trim()

  // ── 4. Load / init conversation ──────────────────────────────────────────────
  let sessionId:    string
  let history:      ChatMessage[]
  let isNewSession: boolean

  if (session_id) {
    const session = await getChatSession(session_id, user.id)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    sessionId    = session.id
    history      = session.messages
    isNewSession = false
  } else {
    history      = []
    sessionId    = ""
    isNewSession = true
  }

  const userMsg: ChatMessage          = { role: "user", content: trimmedMessage }
  const messagesToSend: ChatMessage[] = [...history, userMsg]

  // ── 5. System prompt ─────────────────────────────────────────────────────────
  const userContext  = await getChatUserContext(user.id)
  const systemPrompt = buildSystemPrompt(userContext)

  // ── 6. Persist user message ──────────────────────────────────────────────────
  if (isNewSession) {
    const title = await generateSessionTitle(trimmedMessage)
    sessionId   = await createChatSession(user.id, title, [userMsg])
  } else {
    await appendMessages(sessionId, user.id, [userMsg])
  }

  // ── 7. Stream from Anthropic ─────────────────────────────────────────────────
  let upstreamResponse: Response
  try {
    upstreamResponse = await streamChatResponse(messagesToSend, systemPrompt)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI service error"
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // ── 8. Pipe + accumulate + persist ───────────────────────────────────────────
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer  = writable.getWriter()
  const decoder = new TextDecoder()

  let fullAssistantText = ""
  const upstream = upstreamResponse.body

  if (!upstream) {
    await writer.close()
  } else {
    const reader = upstream.getReader()

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue
            const jsonStr = line.slice(6)
            if (jsonStr === "[DONE]") continue
            try {
              const event = JSON.parse(jsonStr) as {
                type:   string
                delta?: { type: string; text: string }
              }
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                event.delta.text
              ) {
                fullAssistantText += event.delta.text
              }
            } catch { /* malformed SSE line — skip */ }
          }

          await writer.write(value)
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("[api/chat] Stream pump error:", err)
        }
      } finally {
        try { await writer.close() } catch { /* already closed */ }

        if (fullAssistantText.trim()) {
          const assistantMsg: ChatMessage = {
            role:    "assistant",
            content: fullAssistantText,
          }
          try {
            await appendMessages(sessionId, user.id, [assistantMsg])
          } catch (persistErr) {
            console.error("[api/chat] Failed to persist assistant message:", persistErr)
          }
        }
      }
    }

    pump().catch((err) => {
      console.error("[api/chat] Unhandled pump error:", err)
      writer.close().catch(() => undefined)
    })
  }

  // ── 9. Return streaming response ─────────────────────────────────────────────
  return new Response(readable, {
    headers: {
      "Content-Type":                  "text/event-stream",
      "Cache-Control":                 "no-cache, no-store",
      "X-Session-Id":                  sessionId,
      "Access-Control-Expose-Headers": "X-Session-Id",
    },
  })
}
"use client"

/**
 * components/chat/ChatWindow.tsx
 *
 * FIX: The previous version called multiple setState()s directly inside a
 * useEffect body, which triggers the React lint rule
 * "Avoid calling setState() directly within an effect".
 *
 * The correct pattern when you need to reset derived state from a prop change
 * is to use a `key` prop on the component at the call-site so React tears down
 * and remounts instead of running an effect. ChatShell already passes
 * `key={activeId ?? "new"}` on <ChatWindow>, which means every session switch
 * produces a fresh mount — making the sync effect entirely unnecessary.
 *
 * This version removes the problematic useEffect and relies on React's key-based
 * remount for session switches. Initial state is derived directly from props at
 * mount time, which is idiomatic React and has zero linting issues.
 *
 * Other changes in this file:
 *  - Retry button re-sends last message
 *  - Stop commits partial streamed text rather than discarding it
 *  - Copy-to-clipboard on assistant messages
 *  - Character count warning (1600+)
 *  - "Thinking…" dots before first token
 */

import { useState, useRef, useEffect, useCallback } from "react"
import type { ChatMessage } from "@/types/chat"
import { MessageBubble }    from "./MessageBubble"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sessionId:        string | null
  initialMessages:  ChatMessage[]
  onSessionCreated: (id: string, title: string) => void
  onNewChat:        () => void
}

type Status = "idle" | "streaming" | "error"

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  { icon: "🎯", text: "Which exam should I target with my current profile?" },
  { icon: "📅", text: "Am I still eligible by age for UPSC CSE?" },
  { icon: "📚", text: "Give me a 6-month study plan for RBI Grade B" },
  { icon: "⚖️",  text: "Compare SEBI Grade A vs NABARD Grade A" },
  { icon: "🏛️", text: "What are the best state PSCs for OBC candidates?" },
  { icon: "📊", text: "How does the SSC CGL Tier 2 work post-2023?" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatWindow({
  sessionId: externalSessionId,
  initialMessages,
  onSessionCreated,
  onNewChat,
}: Props) {
  // ── Derive initial state directly from props at mount ──────────────────────
  // This is safe because ChatShell passes key={activeId ?? "new"}, so every
  // session switch produces a fresh mount rather than a re-render. No sync
  // effect needed — avoids the "setState inside effect" lint error entirely.
  const [messages,      setMessages]      = useState<ChatMessage[]>(initialMessages)
  const [sessionId,     setSessionId]     = useState<string | null>(externalSessionId)
  const [input,         setInput]         = useState("")
  const [status,        setStatus]        = useState<Status>("idle")
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)
  const [isUpgradeErr,  setIsUpgradeErr]  = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [copiedIdx,     setCopiedIdx]     = useState<number | null>(null)

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const lastInputRef = useRef("")
  // Keep a ref to streamingText so the abort handler can read it without
  // needing it in the useCallback dependency array.
  const streamingRef = useRef("")

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  // Keep streamingRef in sync
  useEffect(() => {
    streamingRef.current = streamingText
  }, [streamingText])

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || status === "streaming") return

    lastInputRef.current = trimmed
    setInput("")
    setErrorMsg(null)
    setIsUpgradeErr(false)
    setStatus("streaming")
    setStreamingText("")
    streamingRef.current = ""

    const userMsg: ChatMessage = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  ctrl.signal,
        body:    JSON.stringify({ session_id: sessionId, user_message: trimmed }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; upgrade?: boolean }
        setIsUpgradeErr(!!data.upgrade)
        setErrorMsg(
          data.upgrade
            ? "AI career chat requires a Pro or Elite plan."
            : (data.error ?? "Something went wrong. Please try again.")
        )
        setMessages((prev) => prev.slice(0, -1))
        setStatus("error")
        return
      }

      // Read new session ID for new conversations
      const newSessionId = res.headers.get("X-Session-Id")
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId)
        onSessionCreated(newSessionId, "Career chat")
      }

      // Stream response
      const reader  = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""

      if (reader) {
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
                assistantText += event.delta.text
                setStreamingText(assistantText)
                streamingRef.current = assistantText
              }
            } catch { /* malformed SSE line — skip */ }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText },
      ])
      setStreamingText("")
      streamingRef.current = ""
      setStatus("idle")

    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User clicked Stop — commit whatever text arrived so far
        const partial = streamingRef.current
        if (partial.trim()) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: partial },
          ])
        }
        setStreamingText("")
        streamingRef.current = ""
        setStatus("idle")
        return
      }
      setErrorMsg("Connection lost. Please check your network and try again.")
      setMessages((prev) => prev.slice(0, -1))
      setStreamingText("")
      streamingRef.current = ""
      setStatus("error")
    }
  }, [sessionId, status, onSessionCreated])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  async function copyMessage(text: string, idx: number) {
    await navigator.clipboard.writeText(text).catch(() => undefined)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const isEmpty   = messages.length === 0 && !streamingText
  const charCount = input.length
  const charWarn  = charCount > 1800

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", position: "relative" }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          height:         "3.5rem",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 1.25rem",
          borderBottom:   "1px solid var(--border, rgba(255,255,255,0.08))",
          flexShrink:     0,
          background:     "var(--bg-app, #0a0a0a)",
          zIndex:         10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <button
            type="button"
            onClick={onNewChat}
            className="md:hidden"
            style={{
              background: "none", border: "none",
              color: "var(--text-dim, rgba(255,255,255,0.35))",
              cursor: "pointer", padding: "0.25rem", fontSize: "1rem",
            }}
            aria-label="Back"
          >
            ←
          </button>

          <span
            style={{
              fontFamily:   "var(--font-serif, Georgia)",
              fontSize:     "0.9375rem",
              fontWeight:   500,
              color:        "rgba(255,255,255,0.92)",
              letterSpacing: "-0.01em",
            }}
          >
            AI Career Advisor
          </span>

          <span
            style={{
              fontSize: "0.6rem", padding: "0.125rem 0.5rem",
              borderRadius: "9999px",
              background: "rgba(232,213,163,0.08)",
              border: "1px solid rgba(232,213,163,0.25)",
              color: "rgba(232,213,163,0.6)",
              fontWeight: 500, letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
            }}
          >
            Beta
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {status === "streaming" && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "rgba(232,213,163,0.6)" }}>
              <span
                style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: "var(--gold, #e8d5a3)",
                  animation: "cc-pulse 1.4s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              Thinking…
            </span>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={onNewChat}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0.5rem", color: "rgba(255,255,255,0.4)",
                cursor: "pointer", fontSize: "0.7rem",
                padding: "0.25rem 0.625rem", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(232,213,163,0.3)"
                e.currentTarget.style.color = "rgba(232,213,163,0.7)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                e.currentTarget.style.color = "rgba(255,255,255,0.4)"
              }}
            >
              + New chat
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "1.5rem 1rem 1rem",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {isEmpty ? (
          <EmptyState onPromptSelect={sendMessage} />
        ) : (
          <div style={{ maxWidth: "48rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ position: "relative" }}>
                <MessageBubble message={msg} />
                {msg.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => copyMessage(msg.content, i)}
                    title="Copy response"
                    className="copy-btn"
                    style={{
                      position: "absolute", bottom: "-0.125rem", left: "2.5rem",
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "0.65rem",
                      color: copiedIdx === i ? "rgba(232,213,163,0.8)" : "rgba(255,255,255,0.2)",
                      padding: "0.125rem 0.375rem", borderRadius: "0.25rem",
                      transition: "color 0.15s",
                      opacity: copiedIdx === i ? 1 : 0,
                    }}
                  >
                    {copiedIdx === i ? "✓ copied" : "copy"}
                  </button>
                )}
              </div>
            ))}

            {/* Live streaming bubble */}
            {streamingText && (
              <MessageBubble
                message={{ role: "assistant", content: streamingText }}
                streaming
              />
            )}

            {/* Thinking dots (before first token) */}
            {status === "streaming" && !streamingText && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "1.875rem", height: "1.875rem", borderRadius: "50%",
                    background: "linear-gradient(135deg,rgba(232,213,163,0.18),rgba(232,213,163,0.08))",
                    border: "1px solid rgba(232,213,163,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6rem", color: "var(--gold,#e8d5a3)", fontWeight: 600,
                  }}
                >
                  AI
                </div>
                <div
                  style={{
                    display: "flex", gap: "0.25rem", padding: "0.75rem 1rem",
                    background: "var(--bg-surface,#111)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "0.25rem 1rem 1rem 1rem",
                  }}
                >
                  {[0, 1, 2].map((j) => (
                    <span
                      key={j}
                      style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: "rgba(232,213,163,0.6)",
                        animation: "cc-bounce 1.2s ease-in-out infinite",
                        animationDelay: `${j * 0.18}s`,
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div
                style={{
                  padding: "0.875rem 1rem", borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "rgba(252,165,165,0.9)",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem", flexWrap: "wrap" as const,
                }}
              >
                <span>{errorMsg}</span>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  {isUpgradeErr ? (
                    <a
                      href="/pricing"
                      style={{
                        fontSize: "0.8rem", fontWeight: 500,
                        padding: "0.25rem 0.75rem", borderRadius: "0.5rem",
                        background: "rgba(232,213,163,0.12)",
                        border: "1px solid rgba(232,213,163,0.3)",
                        color: "var(--gold,#e8d5a3)", textDecoration: "none",
                      }}
                    >
                      Upgrade →
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendMessage(lastInputRef.current)}
                      style={{
                        fontSize: "0.8rem", fontWeight: 500,
                        padding: "0.25rem 0.75rem", borderRadius: "0.5rem",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.6)", cursor: "pointer",
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid var(--border,rgba(255,255,255,0.08))",
          padding: "0.875rem 1rem 1rem", flexShrink: 0,
          background: "var(--bg-app,#0a0a0a)",
        }}
      >
        <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
          <div
            style={{
              display: "flex", alignItems: "flex-end", gap: "0.625rem",
              borderRadius: "0.875rem", padding: "0.625rem 0.75rem",
              background: "var(--bg-surface,#111)",
              border: `1px solid ${charWarn ? "rgba(251,146,60,0.4)" : "rgba(255,255,255,0.1)"}`,
              transition: "border-color 0.2s",
            }}
            onFocusCapture={(e) => {
              if (!charWarn)(e.currentTarget as HTMLDivElement).style.borderColor = "rgba(232,213,163,0.3)"
            }}
            onBlurCapture={(e) => {
              if (!charWarn)(e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)"
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about exams, eligibility, study plans…"
              rows={1}
              disabled={status === "streaming"}
              maxLength={2000}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                resize: "none", fontSize: "0.875rem", color: "rgba(255,255,255,0.88)",
                lineHeight: "1.55", maxHeight: "160px",
                caretColor: "var(--gold,#e8d5a3)",
                fontFamily: "var(--font-sans,system-ui)",
              }}
            />

            {status === "streaming" ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                style={{
                  flexShrink: 0, fontSize: "0.75rem", fontWeight: 500,
                  padding: "0.375rem 0.75rem", borderRadius: "0.625rem",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "rgba(252,165,165,0.9)", cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                }}
              >
                ■ Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                style={{
                  flexShrink: 0, fontSize: "0.875rem", fontWeight: 500,
                  padding: "0.5rem 1rem", borderRadius: "0.625rem",
                  background: input.trim() ? "var(--gold,#e8d5a3)" : "rgba(255,255,255,0.06)",
                  color: input.trim() ? "#0c0c0c" : "rgba(255,255,255,0.2)",
                  border: "none",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.15s", whiteSpace: "nowrap" as const,
                }}
              >
                Send ↑
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.375rem", padding: "0 0.25rem" }}>
            <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", margin: 0 }}>
              Enter to send · Shift+Enter for new line
            </p>
            {charCount > 1600 && (
              <p style={{ fontSize: "0.68rem", margin: 0, color: charWarn ? "rgba(251,146,60,0.7)" : "rgba(255,255,255,0.25)" }}>
                {charCount}/2000
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cc-bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes cc-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
        div:hover > .copy-btn { opacity:1 !important; }
        textarea::placeholder { color:rgba(255,255,255,0.22); }
      `}</style>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onPromptSelect }: { onPromptSelect: (p: string) => void }) {
  return (
    <div
      style={{
        maxWidth: "38rem", margin: "0 auto",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: "calc(100vh - 12rem)",
        textAlign: "center", padding: "2rem 0",
      }}
    >
      <div
        style={{
          width: "4.5rem", height: "4.5rem", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.75rem", marginBottom: "1.5rem",
          background: "radial-gradient(circle,rgba(232,213,163,0.12),rgba(232,213,163,0.04))",
          border: "1px solid rgba(232,213,163,0.25)",
          boxShadow: "0 0 40px rgba(232,213,163,0.06)",
        }}
      >
        🎯
      </div>
      <h2 style={{ fontFamily: "var(--font-serif,Georgia)", fontSize: "1.375rem", fontWeight: 500, color: "rgba(255,255,255,0.92)", marginBottom: "0.625rem", letterSpacing: "-0.02em" }}>
        Your AI career advisor
      </h2>
      <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.38)", marginBottom: "2.25rem", maxWidth: "26rem", lineHeight: 1.65 }}>
        Ask anything about government exams, eligibility rules, cut-offs, or study
        strategy. I know your profile and tailor every answer to you.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(14rem,1fr))", gap: "0.5rem", width: "100%" }}>
        {STARTER_PROMPTS.map(({ icon, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onPromptSelect(text)}
            style={{
              display: "flex", alignItems: "flex-start", gap: "0.5rem",
              textAlign: "left", fontSize: "0.8125rem",
              padding: "0.75rem 0.875rem", borderRadius: "0.75rem",
              background: "var(--bg-surface,#111)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.55)", cursor: "pointer",
              transition: "all 0.15s", lineHeight: 1.45,
              fontFamily: "var(--font-sans,system-ui)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(232,213,163,0.3)"
              e.currentTarget.style.background  = "rgba(232,213,163,0.05)"
              e.currentTarget.style.color       = "rgba(255,255,255,0.78)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"
              e.currentTarget.style.background  = "var(--bg-surface,#111)"
              e.currentTarget.style.color       = "rgba(255,255,255,0.55)"
            }}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.05rem" }}>{icon}</span>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
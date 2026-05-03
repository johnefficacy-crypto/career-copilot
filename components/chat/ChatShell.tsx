"use client"

/**
 * components/chat/ChatShell.tsx
 *
 * FIX: The `position` CSS property on the sidebar used `"relative" as any`
 * to satisfy TypeScript's CSSProperties union, which triggers
 * `@typescript-eslint/no-explicit-any`. The fix is to extract the two
 * possible position values into a typed variable so TypeScript can narrow
 * them to the `React.CSSProperties["position"]` literal union.
 *
 * Other features:
 *  - Session rename (double-click title), delete, date grouping
 *  - Mobile overlay sidebar with ☰ toggle
 *  - key={activeId ?? "new"} on ChatWindow for clean remount on session switch
 */

import { useState, useRef, useEffect } from "react"
import Link          from "next/link"
import { useRouter } from "next/navigation"
import { ChatWindow } from "./ChatWindow"
import { deleteChatSessionAction, renameChatSessionAction } from "@/actions/chat"
import type { ChatSessionSummary, ChatMessage } from "@/types/chat"

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isPaid:          boolean
  sessions:        ChatSessionSummary[]
  activeSessionId: string | null
  initialMessages: ChatMessage[]
  userName:        string | null
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function getGroup(dateStr: string): string {
  const d       = new Date(dateStr)
  const now     = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays <= 7)  return "This week"
  if (diffDays <= 30) return "This month"
  return "Older"
}

const GROUP_ORDER = ["Today", "Yesterday", "This week", "This month", "Older"] as const

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatShell({
  isPaid,
  sessions,
  activeSessionId: initialActiveId,
  initialMessages,
  userName,
}: Props) {
  const router = useRouter()
  const [activeId,    setActiveId]    = useState<string | null>(initialActiveId)
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>(sessions)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  function handleSessionCreated(id: string, title: string) {
    setActiveId(id)
    setSessionList((prev) => [
      { id, title, updated_at: new Date().toISOString(), preview: null },
      ...prev,
    ])
    router.replace(`/dashboard/chat?session=${id}`, { scroll: false })
  }

  function handleNewChat() {
    setActiveId(null)
    setSidebarOpen(false)
    router.replace("/dashboard/chat", { scroll: false })
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id)
    setRenameValue(currentTitle)
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    const fd = new FormData()
    fd.set("session_id", id)
    fd.set("title",      renameValue.trim().slice(0, 80))
    await renameChatSessionAction(fd)
    setSessionList((prev) =>
      prev.map((s) => s.id === id ? { ...s, title: renameValue.trim().slice(0, 80) } : s)
    )
    setRenamingId(null)
  }

  // ── Gate screen ─────────────────────────────────────────────────────────────
  if (!isPaid) {
    return (
      <div
        style={{
          minHeight: "100svh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "1.5rem", background: "var(--bg-app,#0a0a0a)",
          position: "relative", overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "fixed", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 600px 400px at 50% 35%,rgba(232,213,163,0.035) 0%,transparent 70%)",
          }}
        />
        <div
          style={{
            position: "relative", maxWidth: "26rem", width: "100%",
            borderRadius: "1.25rem", padding: "2.25rem", textAlign: "center",
            background: "var(--bg-surface,#111)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "1.25rem" }}>🔒</div>
          <h1 style={{ fontFamily: "var(--font-serif,Georgia)", fontSize: "1.5rem", fontWeight: 500, color: "rgba(255,255,255,0.92)", marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
            AI Career Chat
          </h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.4)", marginBottom: "1.75rem", lineHeight: 1.65 }}>
            Get personalised career guidance, study strategy, and exam advice from
            an AI advisor that knows your complete profile. Available on Pro and Elite plans.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            <Link
              href="/pricing"
              style={{
                display: "block", padding: "0.75rem", borderRadius: "0.75rem",
                background: "var(--gold,#e8d5a3)", color: "#0c0c0c",
                fontWeight: 600, fontSize: "0.875rem",
                textDecoration: "none", textAlign: "center",
              }}
            >
              Upgrade to Pro — ₹199/mo →
            </Link>
            <Link href="/dashboard" style={{ display: "block", padding: "0.5rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", textDecoration: "none", textAlign: "center" }}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Group sessions ──────────────────────────────────────────────────────────
  const groups: Record<string, ChatSessionSummary[]> = {}
  for (const s of sessionList) {
    const g = getGroup(s.updated_at)
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  }

  // ── FIX: typed position values — no "as any" needed ────────────────────────
  // React.CSSProperties["position"] is the correct type for the `position` prop.
  // We narrow it explicitly so TypeScript accepts both branches without `any`.
  const sidebarPosition: React.CSSProperties["position"] = sidebarOpen ? "fixed" : "relative"

  // ── Full chat layout ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100svh", display: "flex", background: "var(--bg-app,#0a0a0a)", position: "relative" }}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)", zIndex: 40,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={sidebarOpen ? undefined : "hidden md:flex"}
        style={{
          width: "15.5rem", flexShrink: 0, display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border,rgba(255,255,255,0.08))",
          // FIX: typed as React.CSSProperties["position"], not "as any"
          position:   sidebarPosition,
          top:        sidebarOpen ? 0         : undefined,
          left:       sidebarOpen ? 0         : undefined,
          bottom:     sidebarOpen ? 0         : undefined,
          zIndex:     sidebarOpen ? 50        : undefined,
          background: "var(--bg-app,#0a0a0a)",
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            height: "3.5rem", display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 0.875rem",
            borderBottom: "1px solid var(--border,rgba(255,255,255,0.08))",
            flexShrink: 0,
          }}
        >
          <Link
            href="/dashboard"
            style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            onClick={handleNewChat}
            style={{
              fontSize: "0.7rem", padding: "0.25rem 0.625rem",
              borderRadius: "0.5rem",
              background: "rgba(232,213,163,0.08)",
              border: "1px solid rgba(232,213,163,0.2)",
              color: "rgba(232,213,163,0.7)",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(232,213,163,0.14)"; e.currentTarget.style.color = "var(--gold,#e8d5a3)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(232,213,163,0.08)"; e.currentTarget.style.color = "rgba(232,213,163,0.7)" }}
          >
            + New
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          {sessionList.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
              <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
                No conversations yet.<br />Start a new chat to begin.
              </p>
            </div>
          ) : (
            GROUP_ORDER.filter((g) => groups[g]?.length).map((groupName) => (
              <div key={groupName}>
                <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.2)", padding: "0.5rem 0.875rem 0.25rem", margin: 0 }}>
                  {groupName}
                </p>
                {groups[groupName].map((session) => {
                  const isActive = activeId === session.id
                  return (
                    <div
                      key={session.id}
                      style={{
                        display: "flex", alignItems: "flex-start",
                        padding: "0.5rem 0.5rem 0.5rem 0.75rem",
                        margin: "0 0.375rem 0.125rem",
                        borderRadius: "0.625rem", cursor: "pointer",
                        background: isActive ? "rgba(232,213,163,0.07)" : "transparent",
                        border: `1px solid ${isActive ? "rgba(232,213,163,0.2)" : "transparent"}`,
                        transition: "all 0.12s",
                      }}
                      onClick={() => {
                        if (renamingId === session.id) return
                        setActiveId(session.id)
                        setSidebarOpen(false)
                        router.replace(`/dashboard/chat?session=${session.id}`, { scroll: false })
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)" }
                        const a = e.currentTarget.querySelector<HTMLElement>(".row-actions")
                        if (a) a.style.opacity = "1"
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent" }
                        const a = e.currentTarget.querySelector<HTMLElement>(".row-actions")
                        if (a) a.style.opacity = "0"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingId === session.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => submitRename(session.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRename(session.id)
                              if (e.key === "Escape") setRenamingId(null)
                              e.stopPropagation()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: "100%", background: "rgba(255,255,255,0.07)",
                              border: "1px solid rgba(232,213,163,0.3)",
                              borderRadius: "0.25rem", padding: "0.125rem 0.375rem",
                              fontSize: "0.8rem", color: "white", outline: "none",
                              fontFamily: "var(--font-sans,system-ui)",
                            }}
                          />
                        ) : (
                          <p
                            style={{
                              fontSize: "0.8rem", fontWeight: isActive ? 500 : 400,
                              color: isActive ? "rgba(232,213,163,0.9)" : "rgba(255,255,255,0.6)",
                              overflow: "hidden", textOverflow: "ellipsis",
                              whiteSpace: "nowrap", margin: 0,
                            }}
                            onDoubleClick={(e) => { e.stopPropagation(); startRename(session.id, session.title) }}
                            title="Double-click to rename"
                          >
                            {session.title}
                          </p>
                        )}
                        {session.preview && renamingId !== session.id && (
                          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.25)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0.1rem 0 0" }}>
                            {session.preview}
                          </p>
                        )}
                      </div>

                      {/* Row actions */}
                      <div
                        className="row-actions"
                        style={{ display: "flex", gap: "0.125rem", flexShrink: 0, marginLeft: "0.25rem", opacity: 0, transition: "opacity 0.12s" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          title="Rename"
                          onClick={(e) => { e.stopPropagation(); startRename(session.id, session.title) }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "0.125rem 0.25rem", borderRadius: "0.25rem", fontSize: "0.7rem", lineHeight: 1 }}
                        >
                          ✎
                        </button>
                        <form action={deleteChatSessionAction}>
                          <input type="hidden" name="session_id" value={session.id} />
                          <button
                            type="submit"
                            title="Delete"
                            onClick={(e) => { if (!confirm("Delete this conversation?")) e.preventDefault() }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.5)", padding: "0.125rem 0.25rem", borderRadius: "0.25rem", fontSize: "0.7rem", lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border,rgba(255,255,255,0.08))", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.625rem", borderRadius: "0.625rem", background: "rgba(232,213,163,0.04)", border: "1px solid rgba(232,213,163,0.1)" }}>
            <div style={{ width: "1.75rem", height: "1.75rem", borderRadius: "50%", background: "rgba(232,213,163,0.1)", border: "1px solid rgba(232,213,163,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 600, color: "var(--gold,#e8d5a3)", flexShrink: 0 }}>
              {(userName ?? "A")[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                {userName ?? "Aspirant"}
              </p>
              <p style={{ fontSize: "0.68rem", color: "rgba(232,213,163,0.5)", margin: 0 }}>AI Career Chat ✓</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="md:hidden"
        style={{
          position: "fixed", bottom: "5.5rem", left: "0.875rem", zIndex: 30,
          width: "2.25rem", height: "2.25rem", borderRadius: "50%",
          background: "var(--bg-surface,#111)",
          border: "1px solid rgba(232,213,163,0.25)",
          color: "var(--gold,#e8d5a3)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.85rem", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
        aria-label="Open sessions"
      >
        ☰
      </button>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* key={activeId ?? "new"} forces a clean remount on session switch,
            which is what makes ChatWindow's initial useState values stay
            correct without needing a sync useEffect. */}
        <ChatWindow
          key={activeId ?? "new"}
          sessionId={activeId}
          initialMessages={initialMessages}
          onSessionCreated={handleSessionCreated}
          onNewChat={handleNewChat}
        />
      </div>

      <style>{`
        @media (min-width:768px){
          .hidden.md\\:flex{display:flex !important;}
          .md\\:hidden{display:none !important;}
        }
      `}</style>
    </div>
  )
}
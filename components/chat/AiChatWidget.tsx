/**
 * components/chat/AiChatWidget.tsx
 *
 * Dashboard widget for AI Career Chat. Server Component.
 *
 * Three states:
 *  1. Free user → upgrade prompt
 *  2. Paid user with sessions → continue + new chat
 *  3. Paid user, no sessions → start CTA
 */

import Link from "next/link"

interface Props {
  isPaid:        boolean
  sessionCount:  number
  lastSessionId: string | null
}

export function AiChatWidget({ isPaid, sessionCount, lastSessionId }: Props) {

  // ── Free user ──────────────────────────────────────────────────────────────
  if (!isPaid) {
    return (
      <div
        style={{
          borderRadius: "1rem",
          padding:      "1.25rem",
          position:     "relative",
          overflow:     "hidden",
          background:   "var(--bg-surface)",
          border:       "1px solid var(--border)",
        }}
      >
        <div
          style={{
            position:        "absolute",
            inset:           0,
            backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(232,213,163,0.06) 0%, transparent 65%)",
            pointerEvents:   "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <p
            style={{
              fontSize:      "0.65rem",
              fontWeight:    600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color:         "rgba(232,213,163,0.5)",
              marginBottom:  "0.625rem",
            }}
          >
            AI Career Advisor
          </p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.375rem" }}>
            Get personalised guidance
          </p>
          <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: "1rem" }}>
            Ask about exam strategy, eligibility, study plans, and career paths.
            Available on Pro and Elite plans.
          </p>
          <Link
            href="/pricing"
            style={{
              display:        "block",
              width:          "100%",
              padding:        "0.625rem",
              borderRadius:   "0.75rem",
              fontSize:       "0.8125rem",
              fontWeight:     500,
              textAlign:      "center",
              textDecoration: "none",
              background:     "rgba(232,213,163,0.08)",
              border:         "1px solid rgba(232,213,163,0.25)",
              color:          "var(--gold, #e8d5a3)",
              transition:     "all 0.15s",
            }}
          >
            Upgrade to unlock →
          </Link>
        </div>
      </div>
    )
  }

  // ── Paid + existing sessions ────────────────────────────────────────────────
  if (lastSessionId) {
    return (
      <div
        style={{
          borderRadius: "1rem",
          padding:      "1.25rem",
          background:   "var(--bg-surface)",
          border:       "1px solid rgba(232,213,163,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <p
            style={{
              fontSize:      "0.65rem",
              fontWeight:    600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color:         "rgba(232,213,163,0.5)",
              margin:        0,
            }}
          >
            AI Career Advisor
          </p>
          <span
            style={{
              fontSize:     "0.65rem",
              padding:      "0.125rem 0.5rem",
              borderRadius: "9999px",
              background:   "rgba(232,213,163,0.08)",
              border:       "1px solid rgba(232,213,163,0.2)",
              color:        "rgba(232,213,163,0.65)",
            }}
          >
            {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          </span>
        </div>

        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "1rem", lineHeight: 1.55 }}>
          Continue your last conversation or start a fresh one.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Link
            href={`/dashboard/chat?session=${lastSessionId}`}
            style={{
              display:        "block",
              width:          "100%",
              padding:        "0.625rem",
              borderRadius:   "0.75rem",
              fontSize:       "0.8125rem",
              fontWeight:     600,
              textAlign:      "center",
              textDecoration: "none",
              background:     "var(--gold, #e8d5a3)",
              color:          "#0c0c0c",
            }}
          >
            Continue chat →
          </Link>
          <Link
            href="/dashboard/chat"
            style={{
              display:        "block",
              width:          "100%",
              padding:        "0.5rem",
              fontSize:       "0.75rem",
              textAlign:      "center",
              textDecoration: "none",
              color:          "rgba(255,255,255,0.28)",
            }}
          >
            New conversation
          </Link>
        </div>
      </div>
    )
  }

  // ── Paid + no sessions ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        borderRadius: "1rem",
        padding:      "1.25rem",
        background:   "var(--bg-surface)",
        border:       "1px solid rgba(232,213,163,0.2)",
      }}
    >
      <p
        style={{
          fontSize:      "0.65rem",
          fontWeight:    600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color:         "rgba(232,213,163,0.5)",
          marginBottom:  "0.625rem",
        }}
      >
        AI Career Advisor
      </p>
      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.375rem" }}>
        Your personal exam strategist
      </p>
      <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: "1rem" }}>
        Ask about cut-offs, study timelines, eligibility, and which exams suit your profile.
      </p>
      <Link
        href="/dashboard/chat"
        style={{
          display:        "block",
          width:          "100%",
          padding:        "0.625rem",
          borderRadius:   "0.75rem",
          fontSize:       "0.8125rem",
          fontWeight:     600,
          textAlign:      "center",
          textDecoration: "none",
          background:     "var(--gold, #e8d5a3)",
          color:          "#0c0c0c",
        }}
      >
        Start a conversation →
      </Link>
    </div>
  )
}
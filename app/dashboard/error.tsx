"use client"

import { useEffect } from "react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[dashboard] error boundary caught:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
      <div className="cc-card" style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: "2.5rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "0.5rem" }}>
          Something went wrong
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          {error.message || "An unexpected error occurred loading your dashboard."}
        </p>
        {error.digest && (
          <p style={{ color: "var(--text-ghost)", fontSize: "0.75rem", marginBottom: "1.5rem", fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={reset} className="cc-btn-primary" style={{ width: "auto" }}>
            Try again
          </button>
          <a href="/dashboard" className="cc-btn-ghost">
            Reload dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

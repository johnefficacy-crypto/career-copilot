"use client"

import { useEffect } from "react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin] error boundary caught:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
      <div className="cc-card" style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "2.5rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🛠️</div>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "0.5rem" }}>
          Admin panel error
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error.message || "An unexpected error occurred in the admin panel."}
        </p>
        <div className="cc-alert-warning" style={{ textAlign: "left", marginBottom: "1.5rem", fontSize: "0.8125rem" }}>
          If this is a database timeout, try refreshing — the dev proxy can add latency on first load.
        </div>
        {error.digest && (
          <p style={{ color: "var(--text-ghost)", fontSize: "0.75rem", marginBottom: "1.5rem", fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={reset} className="cc-btn-primary" style={{ width: "auto" }}>
            Try again
          </button>
          <a href="/admin/scrape" className="cc-btn-ghost">
            Back to scrape
          </a>
        </div>
      </div>
    </div>
  )
}

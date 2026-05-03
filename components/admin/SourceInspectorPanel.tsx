"use client"

/**
 * components/admin/SourceInspectorPanel.tsx
 *
 * Slide-out inspector panel embedded in /admin/sources.
 * Replaces the standalone /admin/sources/inspect page.
 * Opens as a side drawer triggered by "Inspect URL" button in the header.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { inspectSource, type InspectionResult, type ProbeStatus } from "@/actions/inspect-source"

const STATUS_ICON: Record<ProbeStatus, string> = {
  pass: "✓", fail: "✗", warn: "⚠", skip: "–", running: "…",
}
const STATUS_COLOR: Record<ProbeStatus, string> = {
  pass: "var(--success)", fail: "var(--danger)", warn: "var(--warning)", skip: "var(--text-ghost)", running: "var(--gold)",
}

export function SourceInspectorPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [url, setUrl]       = useState("")
  const [result, setResult] = useState<InspectionResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  function handleInspect() {
    if (!url.trim()) return
    setError(null)
    setResult(null)
    start(async () => {
      const res = await inspectSource(url.trim())
      if (!res.success || !res.data) { setError(res.error ?? "Inspection failed"); return }
      setResult(res.data)
    })
  }

  function handleAddSource() {
    if (!result) return
    const s = result.suggested
    const p = new URLSearchParams({
      prefill_url:        result.url,
      prefill_adapter:    s.adapter_type,
      prefill_risk:       s.anti_bot_risk,
      prefill_trust:      String(s.trust_score),
      prefill_interval:   String(s.scrape_interval_hours),
      prefill_playwright: String(s.requires_playwright),
      prefill_captcha:    String(s.has_captcha),
      prefill_pdfonly:    String(s.pdf_only),
      prefill_active:     String(s.is_active),
      ...(s.rss_url ? { prefill_rss: s.rss_url } : {}),
      ...(s.api_url ? { prefill_api: s.api_url } : {}),
    })
    onClose()
    router.push(`/admin/sources?${p.toString()}`)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col overflow-hidden"
        style={{ background: "#0d1626", borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 40px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-base)" }}>Source Inspector</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
              Probe a URL to auto-detect adapter, risk, and other fields
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-ghost)", border: "1px solid var(--border)" }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* URL input */}
          <div className="flex gap-2">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInspect()}
              placeholder="https://upsc.gov.in/examinations/active-examinations"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-base)" }}
            />
            <button type="button" onClick={handleInspect}
              disabled={isPending || !url.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: "rgba(232,213,163,0.12)",
                color: "var(--gold)",
                border: "1px solid rgba(232,213,163,0.30)",
                opacity: isPending ? 0.7 : 1,
              }}>
              {isPending ? "Probing…" : "Inspect"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}>
              ✗ {error}
            </div>
          )}

          {/* Loading state */}
          {isPending && (
            <div className="space-y-2">
              {["SSL check", "JSON probe", "RSS discovery", "HTML analysis", "Anti-bot assessment"].map(label => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--gold)" }}>…</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary + suggested fields */}
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{result.summary}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-ghost)" }}>{result.url}</p>
                  </div>
                  <button type="button" onClick={handleAddSource}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: "rgba(232,213,163,0.12)", color: "var(--gold)", border: "1px solid rgba(232,213,163,0.25)" }}>
                    Add Source →
                  </button>
                </div>

                {/* Suggested field grid */}
                <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    ["adapter_type",          result.suggested.adapter_type],
                    ["anti_bot_risk",         result.suggested.anti_bot_risk],
                    ["trust_score",           result.suggested.trust_score.toFixed(2)],
                    ["interval",              result.suggested.scrape_interval_hours + "h"],
                    ["requires_playwright",   String(result.suggested.requires_playwright)],
                    ["has_captcha",           String(result.suggested.has_captcha)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg px-3 py-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{k}</p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: "var(--gold)" }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual probe results */}
              {result.probes.map(probe => (
                <div key={probe.id} className="rounded-xl p-3"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold mt-0.5 w-4 text-center shrink-0"
                      style={{ color: STATUS_COLOR[probe.status] }}>
                      {STATUS_ICON[probe.status]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{probe.label}</p>
                        {probe.durationMs !== undefined && (
                          <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{probe.durationMs}ms</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{probe.detail}</p>
                      {probe.raw && (
                        <pre className="mt-2 text-xs p-2 rounded-lg overflow-x-auto"
                          style={{ background: "rgba(0,0,0,0.25)", color: "var(--text-ghost)", fontFamily: "monospace", fontSize: "11px" }}>
                          {probe.raw}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
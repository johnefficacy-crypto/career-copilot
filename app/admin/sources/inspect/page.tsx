"use client"

/**
 * app/admin/sources/inspect/page.tsx
 * Career Copilot — Source URL Inspector
 *
 * Client component that calls the inspectSource server action,
 * shows 10 probe results, and pre-fills /admin/sources add-source drawer
 * via URL query params.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { inspectSource, type InspectionResult, type ProbeStatus } from "@/actions/inspect-source"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ProbeStatus, string> = {
  pass:    "✓",
  fail:    "✗",
  warn:    "⚠",
  skip:    "–",
  running: "…",
}

const STATUS_COLOR: Record<ProbeStatus, string> = {
  pass:    "var(--success)",
  fail:    "var(--danger)",
  warn:    "var(--warning)",
  skip:    "var(--text-ghost)",
  running: "var(--gold)",
}

const css = {
  gold:    "var(--gold)",
  surface: "var(--bg-surface)",
  border:  "var(--border)",
  text:    "var(--text-base)",
  muted:   "var(--text-muted)",
  ghost:   "var(--text-ghost)",
}

export default function InspectPage() {
  const router = useRouter()
  const [url, setUrl]         = useState("")
  const [result, setResult]   = useState<InspectionResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInspect() {
    if (!url.trim()) return
    setError(null)
    setResult(null)
    startTransition(async () => {
      const res = await inspectSource(url.trim())
      if (!res.success || !res.data) {
        setError(res.error ?? "Inspection failed")
        return
      }
      setResult(res.data)
    })
  }

  function handleAddSource() {
    if (!result) return
    const s = result.suggested
    const params = new URLSearchParams({
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
    router.push(`/admin/sources?${params.toString()}`)
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: css.text, fontFamily: "'Playfair Display', Georgia, serif" }}>
          Source Inspector
        </h1>
        <p className="text-sm mt-1" style={{ color: css.muted }}>
          Probe a URL to auto-detect adapter_type, anti_bot_risk, and other source_registry fields.
          Probes run from this server — results reflect server-side fetch behavior.
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleInspect()}
          placeholder="https://upsc.gov.in/examinations/active-examinations"
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: css.surface, border: `1px solid ${css.border}`, color: css.text }}
        />
        <button
          type="button"
          onClick={handleInspect}
          disabled={isPending || !url.trim()}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{
            background: isPending ? "rgba(201,153,42,0.08)" : "rgba(201,153,42,0.15)",
            color:      css.gold,
            border:     "1px solid rgba(201,153,42,0.30)",
            opacity:    isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Inspecting…" : "Inspect"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}>
          ✗ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="rounded-2xl p-5 space-y-3"
            style={{ background: css.surface, border: `1px solid ${css.border}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: css.text }}>{result.summary}</p>
                <p className="text-xs mt-1 truncate" style={{ color: css.ghost }}>{result.url}</p>
              </div>
              <button type="button" onClick={handleAddSource}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "rgba(201,153,42,0.12)", color: css.gold, border: "1px solid rgba(201,153,42,0.25)" }}>
                Add Source →
              </button>
            </div>

            {/* Suggested fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2" style={{ borderTop: `1px solid ${css.border}` }}>
              {[
                ["adapter_type",          result.suggested.adapter_type],
                ["anti_bot_risk",         result.suggested.anti_bot_risk],
                ["trust_score",           result.suggested.trust_score.toFixed(2)],
                ["scrape_interval_hours", String(result.suggested.scrape_interval_hours) + "h"],
                ["requires_playwright",   String(result.suggested.requires_playwright)],
                ["has_captcha",           String(result.suggested.has_captcha)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${css.border}` }}>
                  <p className="text-xs" style={{ color: css.ghost }}>{k}</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: css.gold }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Probe results */}
          <div className="space-y-2">
            {result.probes.map(probe => (
              <div key={probe.id} className="rounded-xl p-4"
                style={{ background: css.surface, border: `1px solid ${css.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold w-4 text-center"
                    style={{ color: STATUS_COLOR[probe.status] }}>
                    {STATUS_ICON[probe.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: css.text }}>{probe.label}</p>
                      {probe.durationMs !== undefined && (
                        <span className="text-xs" style={{ color: css.ghost }}>{probe.durationMs}ms</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: css.muted }}>{probe.detail}</p>
                    {probe.raw && (
                      <pre className="mt-2 text-xs p-2 rounded-lg overflow-x-auto"
                        style={{ background: "rgba(0,0,0,0.25)", color: css.ghost, fontFamily: "monospace" }}>
                        {probe.raw}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
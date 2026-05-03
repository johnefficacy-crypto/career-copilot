"use client"

/**
 * components/admin/AdminScrapeDashboard.tsx
 * Career Copilot — Admin Scrape Dashboard (Phase 2, cleaned)
 *
 * FIXES:
 *  - Removed ~550 lines of dead commented-out v1 code
 *  - Added Link to /admin/sources for full CRUD on the registry tab
 *  - StatTile sub-text for sources registered shows active count
 *  - handleToggleRegistry optimistically updates state before server call
 *  - confBar helper complete and correct
 *  - All imports are live (no unused or missing imports)
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  adminTriggerScraper,
  adminTriggerDeadlineSweep,
  adminApproveQueueItem,
  adminRejectQueueItem,
  adminToggleScrapeSource,
  adminResetSourceFails,
  adminSetExtractionStatus,
  adminReviewEvidenceField,
  adminGetEvidenceForItem,
} from "@/actions/notifications"
import type {
  ScrapeRun,
  ScraperStats,
  QueueReviewItem,
  FieldEvidence,
  SourceHealthSnapshot,
} from "@/types/notifications"
import type { SourceRegistryEntry } from "@/lib/db/source-registry"
import type { PaginatedResult } from "@/lib/db/notifications"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, string> = {
  1: "T1 Official", 2: "T2 Important", 3: "T3 Secondary", 4: "T4 Aggregator"
}
const TIER_COLORS: Record<number, string> = {
  1: "var(--gold)", 2: "rgba(255,255,255,0.65)", 3: "rgba(255,255,255,0.40)", 4: "rgba(255,255,255,0.25)"
}
const CAT_LABELS: Record<string, string> = {
  central_govt: "Central Govt", banking: "Banking", regulatory: "Regulatory",
  insurance: "Insurance", psu: "PSU", state_psc: "State PSC",
  state_subordinate: "State Boards", university: "University", cet: "CET",
  defence: "Defence", courts: "Courts", municipal: "Municipal",
  boards: "Boards", commissions: "Commissions",
}

function badge(text: string, color: string, bg: string) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color, background: bg, border: `1px solid ${color}30` }}>
      {text}
    </span>
  )
}

function statusBadge(status: string) {
  const map: Record<string, [string, string]> = {
    completed: ["var(--success)",    "rgba(34,197,94,0.10)"],
    partial:   ["var(--warning)",    "rgba(245,158,11,0.10)"],
    failed:    ["var(--danger)",     "rgba(239,68,68,0.10)"],
    running:   ["var(--gold)",       "rgba(232,213,163,0.10)"],
    pending:   ["var(--text-muted)", "rgba(255,255,255,0.04)"],
    approved:  ["var(--success)",    "rgba(34,197,94,0.10)"],
    rejected:  ["var(--danger)",     "rgba(239,68,68,0.10)"],
    duplicate: ["var(--text-ghost)", "rgba(255,255,255,0.04)"],
  }
  const [color, bg] = map[status] ?? map.pending
  return badge(status, color, bg)
}

function confBar(score: number) {
  const pct   = Math.round((score ?? 0) * 100)
  const color = score >= 0.90
    ? "var(--success)"
    : score >= 0.70
      ? "var(--warning)"
      : "var(--danger)"
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color, minWidth: "32px" }}>{pct}%</span>
    </div>
  )
}

// Data quality bar — 0-100 completeness score
// ≥80 green (approve freely), 50-79 amber (review), <50 red (needs enrichment)
function qualityBar(score: number | null) {
  if (score == null) return <span className="text-xs" style={{ color: "var(--text-ghost)" }}>—</span>
  const color = score >= 80
    ? "var(--success)"
    : score >= 50
      ? "var(--warning)"
      : "var(--danger)"
  const label = score >= 80 ? "Complete" : score >= 50 ? "Partial" : "Sparse"
  return (
    <div className="flex flex-col gap-0.5">
      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] tabular-nums text-center" style={{ color }}>{score} · {label}</span>
    </div>
  )
}

function extractionStatusBadge(status: string | null) {
  const map: Record<string, [string, string]> = {
    unverified:    ["var(--text-muted)",  "rgba(255,255,255,0.04)"],
    needs_review:  ["var(--warning)",     "rgba(245,158,11,0.10)"],
    verified:      ["var(--success)",     "rgba(34,197,94,0.10)"],
    rejected:      ["var(--danger)",      "rgba(239,68,68,0.10)"],
    stale:         ["var(--text-ghost)",  "rgba(255,255,255,0.04)"],
    duplicate:     ["var(--text-ghost)",  "rgba(255,255,255,0.04)"],
  }
  if (!status) return null
  const [color, bg] = map[status] ?? map.unverified
  return badge(status, color, bg)
}

function evidenceBar(total: number | null, verified: number | null) {
  if (total == null || total === 0) return null
  const v = verified ?? 0
  const pct = Math.round((v / total) * 100)
  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)"
  return (
    <div className="flex items-center gap-1.5" title={`${v}/${total} evidence verified`}>
      <div className="h-1.5 w-16 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] tabular-nums" style={{ color }}>{v}/{total}</span>
    </div>
  )
}

// ─── Pagination control ───────────────────────────────────────────────────────

function Paginator({ page, totalPages, tab, baseUrl = "/admin/scrape" }: {
  page:       number
  totalPages: number
  tab:        string
  baseUrl?:   string
}) {
  if (totalPages <= 1) return null
  const prev = page > 1         ? `${baseUrl}?tab=${tab}&page=${page - 1}` : null
  const next = page < totalPages ? `${baseUrl}?tab=${tab}&page=${page + 1}` : null
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {prev
          ? <Link href={prev} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--bg-surface)", color: "rgba(255,255,255,0.60)", border: "1px solid var(--border)" }}>
              ← Prev
            </Link>
          : <span className="text-xs px-3 py-1.5 rounded-lg opacity-30 cursor-not-allowed"
              style={{ background: "var(--bg-surface)", color: "rgba(255,255,255,0.60)", border: "1px solid var(--border)" }}>
              ← Prev
            </span>
        }
        {next
          ? <Link href={next} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--bg-surface)", color: "rgba(255,255,255,0.60)", border: "1px solid var(--border)" }}>
              Next →
            </Link>
          : <span className="text-xs px-3 py-1.5 rounded-lg opacity-30 cursor-not-allowed"
              style={{ background: "var(--bg-surface)", color: "rgba(255,255,255,0.60)", border: "1px solid var(--border)" }}>
              Next →
            </span>
        }
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: color ?? "rgba(255,255,255,0.85)" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{sub}</p>}
    </div>
  )
}

function Tab({ label, active, count, onClick }: {
  label: string; active: boolean; count?: number; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
      style={{
        background:  active ? "var(--bg-surface-md)" : "transparent",
        color:       active ? "rgba(255,255,255,0.85)" : "var(--text-ghost)",
        border:      "1px solid",
        borderColor: active ? "var(--border-md)" : "transparent",
      }}>
      {label}
      {count !== undefined && count > 0 && (
        <span className="text-xs px-1.5 py-px rounded-full"
          style={{ background: "var(--gold-faint)", color: "var(--gold)" }}>
          {count}
        </span>
      )}
    </button>
  )
}

function QueueRow({ item, onApprove, onReject, disabled }: {
  item: QueueReviewItem; onApprove: (id: string) => void
  onReject: (id: string) => void; disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.80)" }}>
          {item.title ?? "Unknown title"}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>
          {item.org_name ?? "—"} · {item.source_name}
          {item.apply_end_date ? ` · Apply by ${item.apply_end_date}` : ""}
        </p>
        {item.canonical_name && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
            Matched: {item.canonical_name}
          </p>
        )}
      </div>
      <div className="w-24 shrink-0" title="Claude confidence score">{confBar(item.confidence_score ?? 0)}</div>
      <div className="w-24 shrink-0" title="Data completeness (title+org+dates+posts+criteria)">{qualityBar(item.data_quality_score ?? null)}</div>
      <div className="shrink-0">{statusBadge(item.status)}</div>
      {item.status === "pending" ? (
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => onApprove(item.id)} disabled={disabled}
            className="text-xs px-3 py-1 rounded-lg font-medium"
            style={{ background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" }}>
            Approve
          </button>
          <button type="button" onClick={() => onReject(item.id)} disabled={disabled}
            className="text-xs px-3 py-1 rounded-lg font-medium"
            style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.20)" }}>
            Reject
          </button>
        </div>
      ) : <div className="w-32 shrink-0" />}
    </div>
  )
}

function SourceHealthRow({ snap, onToggle, onReset, disabled }: {
  snap: SourceHealthSnapshot; onToggle: (id: string, active: boolean) => void
  onReset: (id: string) => void; disabled: boolean
}) {
  const healthy    = snap.consecutive_fails < 5
  const lastScrape = snap.last_scraped_at
    ? new Date(snap.last_scraped_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
    : "Never"

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--bg-surface)",
        border:     `1px solid ${snap.is_active && healthy ? "var(--border)" : "rgba(239,68,68,0.25)"}`,
        opacity:    snap.is_active ? 1 : 0.5,
      }}>
      <span className="w-2 h-2 rounded-full shrink-0"
        style={{ background: !snap.is_active ? "var(--text-ghost)" : healthy ? "var(--success)" : "var(--danger)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.80)" }}>
            {snap.name}
          </p>
          <span className="text-xs px-1.5 py-px rounded font-medium"
            style={{
              color:      TIER_COLORS[snap.tier ?? 2],
              background: `${TIER_COLORS[snap.tier ?? 2]}15`,
              border:     `1px solid ${TIER_COLORS[snap.tier ?? 2]}25`,
            }}>
            {TIER_LABELS[snap.tier ?? 2]}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
          Last: {lastScrape}
          {snap.consecutive_fails > 0 ? ` · ${snap.consecutive_fails} fails` : ""}
          {snap.avg_confidence != null ? ` · Avg: ${Math.round((snap.avg_confidence) * 100)}%` : ""}
          {` · ${snap.items_7d} items/7d`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {snap.consecutive_fails > 0 && (
          <button type="button" onClick={() => onReset(snap.source_id)} disabled={disabled}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "rgba(232,213,163,0.08)", color: "var(--gold)", border: "1px solid var(--gold-border)" }}>
            Reset
          </button>
        )}
        <button type="button" onClick={() => onToggle(snap.source_id, snap.is_active)} disabled={disabled}
          className="text-xs px-3 py-1 rounded-lg"
          style={{
            background: snap.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
            color:      snap.is_active ? "var(--danger)" : "var(--success)",
            border:     `1px solid ${snap.is_active ? "rgba(239,68,68,0.20)" : "rgba(34,197,94,0.20)"}`,
          }}>
          {snap.is_active ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  )
}

function RegistryRow({ src, onToggle, disabled }: {
  src: SourceRegistryEntry; onToggle: (id: string, active: boolean) => void; disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--bg-surface)",
        border:     "1px solid var(--border)",
        opacity:    src.is_active ? 1 : 0.5,
      }}>
      <span className="w-2 h-2 rounded-full shrink-0"
        style={{ background: src.is_active ? (src.consecutive_fails < 5 ? "var(--success)" : "var(--danger)") : "var(--text-ghost)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.80)" }}>
            {src.source_name}
            {src.short_code && (
              <span className="ml-1 text-xs" style={{ color: "var(--text-ghost)" }}>
                ({src.short_code})
              </span>
            )}
          </p>
          <span className="text-xs px-1.5 py-px rounded font-medium"
            style={{ color: TIER_COLORS[src.tier], background: `${TIER_COLORS[src.tier]}15` }}>
            {TIER_LABELS[src.tier]}
          </span>
          <span className="text-xs px-1.5 py-px rounded"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}>
            {CAT_LABELS[src.category] ?? src.category}
          </span>
          <span className="text-xs px-1.5 py-px rounded"
            style={{ color: "var(--text-ghost)", background: "rgba(255,255,255,0.03)" }}>
            {src.adapter_type}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-ghost)" }}>
          {src.notification_url ?? src.official_url}
          {src.consecutive_fails > 0 ? ` · ⚠ ${src.consecutive_fails} fails` : ""}
          {src.last_error ? ` · ${src.last_error.slice(0, 60)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {src.is_verified && (
          <span className="text-xs mr-1" style={{ color: "var(--success)" }}>✓</span>
        )}
        <button type="button" onClick={() => onToggle(src.id, src.is_active)} disabled={disabled}
          className="text-xs px-3 py-1 rounded-lg"
          style={{
            background: src.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
            color:      src.is_active ? "var(--danger)" : "var(--success)",
            border:     `1px solid ${src.is_active ? "rgba(239,68,68,0.20)" : "rgba(34,197,94,0.20)"}`,
          }}>
          {src.is_active ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  stats:          ScraperStats
  pendingQueue:   PaginatedResult<QueueReviewItem>
  runsPage:       PaginatedResult<ScrapeRun>
  sourceHealth:   SourceHealthSnapshot[]
  sourceRegistry: SourceRegistryEntry[]
  errorMessage?:  string
  activeTab:      string
}

export function AdminScrapeDashboard({
  stats,
  pendingQueue:   initialQueuePage,
  runsPage:       initialRunsPage,
  sourceHealth,
  sourceRegistry: initialRegistry,
  errorMessage,
  activeTab: initialTab,
}: Props) {
  const router                        = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab]                = useState(initialTab)
  const [queue, setQueue]            = useState(initialQueuePage.rows)
  const [registry, setRegistry]      = useState(initialRegistry)
  const [catFilter, setCatFilter]    = useState<string>("all")
  const [runMsg, setRunMsg]          = useState<string | null>(null)
  const [runErr, setRunErr]          = useState<string | null>(errorMessage ?? null)
  // Evidence review state
  const [selectedItemId, setSelectedItemId]  = useState<string | null>(null)
  const [evidenceRows, setEvidenceRows]       = useState<FieldEvidence[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceErr, setEvidenceErr]         = useState<string | null>(null)

  const pendingCount    = queue.filter(q => q.status === "pending").length
  const categories      = [...new Set(registry.map(s => s.category))].sort()
  const filteredRegistry = catFilter === "all"
    ? registry
    : registry.filter(s => s.category === catFilter)

  function handleTrigger() {
    setRunMsg(null); setRunErr(null)
    startTransition(async () => {
      const r = await adminTriggerScraper()
      if (r.success) setRunMsg(r.message)
      else setRunErr(r.message)
      // Re-fetch server data so queue tab shows newly scraped items
      // without requiring a manual browser refresh
      router.refresh()
    })
  }

  function handleDeadlines() {
    setRunMsg(null)
    startTransition(async () => {
      const r = await adminTriggerDeadlineSweep()
      setRunMsg(r.message)
    })
  }

  function handleApprove(id: string) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "approved" as const } : q))
    const fd = new FormData(); fd.set("item_id", id)
    startTransition(() => adminApproveQueueItem(fd))
  }

  function handleReject(id: string) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "rejected" as const } : q))
    const fd = new FormData(); fd.set("item_id", id)
    startTransition(() => adminRejectQueueItem(fd))
  }

  function handleToggleRegistry(id: string, isActive: boolean) {
    // Optimistic update
    setRegistry(prev => prev.map(s => s.id === id ? { ...s, is_active: !isActive } : s))
    const fd = new FormData()
    fd.set("source_id", id)
    fd.set("active", String(!isActive))
    startTransition(() => adminToggleScrapeSource(fd))
  }

  function handleToggleHealth(id: string, isActive: boolean) {
    const fd = new FormData()
    fd.set("source_id", id)
    fd.set("active", String(!isActive))
    startTransition(() => adminToggleScrapeSource(fd))
  }

  function handleReset(id: string) {
    startTransition(async () => {
      await adminResetSourceFails(id)
    })
  }

  async function handleSelectItem(id: string) {
    if (selectedItemId === id) {
      setSelectedItemId(null)
      setEvidenceRows([])
      return
    }
    setSelectedItemId(id)
    setEvidenceLoading(true)
    setEvidenceErr(null)
    setEvidenceRows([])
    const result = await adminGetEvidenceForItem(id)
    setEvidenceLoading(false)
    if (result.success) setEvidenceRows(result.data ?? [])
    else setEvidenceErr(result.error ?? "Failed to load evidence")
  }

  function handleVerifyEvidence(evidenceId: string) {
    setEvidenceRows(prev => prev.map(e => e.id === evidenceId ? { ...e, reviewer_status: "verified" as const } : e))
    startTransition(async () => {
      await adminReviewEvidenceField(evidenceId, "verified", selectedItemId ?? undefined)
    })
  }

  function handleRejectEvidence(evidenceId: string) {
    setEvidenceRows(prev => prev.map(e => e.id === evidenceId ? { ...e, reviewer_status: "rejected" as const } : e))
    startTransition(async () => {
      await adminReviewEvidenceField(evidenceId, "rejected", selectedItemId ?? undefined)
    })
  }

  function handleMarkVerified(itemId: string) {
    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, extraction_status: "verified" } : q))
    startTransition(async () => {
      await adminSetExtractionStatus(itemId, "verified")
    })
  }

  function handleMarkNeedsReview(itemId: string) {
    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, extraction_status: "needs_review" } : q))
    startTransition(async () => {
      await adminSetExtractionStatus(itemId, "needs_review")
    })
  }

  const needsReviewCount = queue.filter(q =>
    q.extraction_status === "needs_review" ||
    (q.extraction_status === "unverified" && q.evidence_required)
  ).length

  const lastRun = stats.lastRun

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.90)" }}>
            Scrape Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Phase 2 — {registry.length} sources registered · {registry.filter(s => s.is_active).length} active
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={handleDeadlines} disabled={isPending}
            className="text-sm px-4 py-2 rounded-xl font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.70)", border: "1px solid var(--border)" }}>
            Deadline Sweep
          </button>
          <button type="button" onClick={handleTrigger} disabled={isPending}
            className="text-sm px-4 py-2 rounded-xl font-medium transition-colors"
            style={{
              background: isPending ? "rgba(232,213,163,0.08)" : "rgba(232,213,163,0.15)",
              color: "var(--gold)",
              border: "1px solid var(--gold-border)",
              opacity: isPending ? 0.7 : 1,
            }}>
            {isPending ? "Running…" : "▶ Run Scraper"}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {runMsg && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "var(--success)" }}>
          ✓ {runMsg}
        </div>
      )}
      {runErr && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}>
          ✗ {runErr}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Pending Review"
          value={stats.pendingReview}
          sub="Need admin approval"
          color={stats.pendingReview > 0 ? "var(--gold)" : undefined}
        />
        <StatTile
          label="Healthy Sources"
          value={stats.healthySources}
          sub={`${stats.failedSources} failing`}
          color={stats.failedSources > 0 ? "var(--warning)" : "var(--success)"}
        />
        <StatTile
          label="Registered Sources"
          value={registry.length}
          sub={`${registry.filter(s => s.is_active).length} active · ${registry.filter(s => s.is_verified).length} verified`}
        />
        <StatTile
          label="Last Run"
          value={lastRun?.status ?? "—"}
          color={lastRun?.status === "completed" ? "var(--success)" : "var(--warning)"}
          sub={lastRun ? `${lastRun.items_new} new · ${lastRun.items_duplicate} dup` : "No runs yet"}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tab label="Queue Review"   active={tab === "queue"}    count={pendingCount}      onClick={() => setTab("queue")} />
        <Tab label="Evidence Review" active={tab === "evidence"} count={needsReviewCount}  onClick={() => setTab("evidence")} />
        <Tab label="Source Registry" active={tab === "registry"} count={registry.length}   onClick={() => setTab("registry")} />
        <Tab label="Source Health"  active={tab === "health"}   onClick={() => setTab("health")} />
        <Tab label="Run History"    active={tab === "runs"}     onClick={() => setTab("runs")} />
      </div>

      {/* ── Queue Tab ──────────────────────────────────────────────────────────── */}
      {tab === "queue" && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            {initialQueuePage.total} items awaiting review
            {initialQueuePage.totalPages > 1 && ` · page ${initialQueuePage.page}/${initialQueuePage.totalPages}`}
          </p>
          {queue.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>Queue is empty</p>
            </div>
          ) : queue.map(item => (
            <QueueRow
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              disabled={isPending}
            />
          ))}
          <Paginator
            page={initialQueuePage.page}
            totalPages={initialQueuePage.totalPages}
            tab="queue"
          />
        </div>
      )}

      {/* ── Evidence Review Tab ───────────────────────────────────────────────── */}
      {tab === "evidence" && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {needsReviewCount} items need evidence review · click a row to inspect field evidence
          </p>
          {queue.filter(q => q.extraction_status === "needs_review" || q.extraction_status === "unverified" || q.evidence_total_count != null).length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>No items with evidence data</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>
                Evidence rows are generated when the scraper runs with migration 017 applied.
              </p>
            </div>
          ) : queue.filter(q => q.extraction_status !== null || q.evidence_total_count != null).map(item => (
            <div key={item.id}>
              {/* Evidence row header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectItem(item.id)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectItem(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 12,
                  background: selectedItemId === item.id ? "var(--bg-surface-md)" : "var(--bg-surface)",
                  border: `1px solid ${selectedItemId === item.id ? "var(--border-md)" : "var(--border)"}`,
                  cursor: "pointer",
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.80)" }}>
                      {item.title ?? "Unknown title"}
                    </span>
                    {extractionStatusBadge(item.extraction_status)}
                    {item.extraction_provider && (
                      <span className="text-xs px-1.5 py-px rounded"
                        style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-ghost)" }}>
                        {item.extraction_provider}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
                    {item.org_name ?? "—"} · {item.source_name}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  {evidenceBar(item.evidence_total_count, item.evidence_verified_count)}
                  {statusBadge(item.status)}
                  {item.extraction_status !== "verified" && item.extraction_status !== "rejected" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={isPending}
                        onClick={(e) => { e.stopPropagation(); handleMarkVerified(item.id) }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: "rgba(34,197,94,0.10)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.20)" }}>
                        Mark Verified
                      </button>
                      <button type="button" disabled={isPending}
                        onClick={(e) => { e.stopPropagation(); handleMarkNeedsReview(item.id) }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: "rgba(245,158,11,0.08)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.20)" }}>
                        Needs Review
                      </button>
                    </div>
                  )}
                  <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                    {selectedItemId === item.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded evidence detail */}
              {selectedItemId === item.id && (
                <div className="rounded-xl p-4 mt-1 space-y-3"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {evidenceLoading && (
                    <p className="text-xs text-center py-4" style={{ color: "var(--text-ghost)" }}>
                      Loading evidence…
                    </p>
                  )}
                  {evidenceErr && (
                    <p className="text-xs py-2" style={{ color: "var(--danger)" }}>
                      {evidenceErr}
                    </p>
                  )}
                  {!evidenceLoading && !evidenceErr && evidenceRows.length === 0 && (
                    <p className="text-xs py-2 text-center" style={{ color: "var(--text-ghost)" }}>
                      No evidence rows found for this item.
                    </p>
                  )}
                  {!evidenceLoading && evidenceRows.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {evidenceRows.length} evidence fields · verify or reject each field
                      </p>
                      {evidenceRows.map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                          style={{
                            background: ev.reviewer_status === "verified"
                              ? "rgba(34,197,94,0.04)"
                              : ev.reviewer_status === "rejected"
                                ? "rgba(239,68,68,0.04)"
                                : "var(--bg-surface)",
                            border: `1px solid ${
                              ev.reviewer_status === "verified" ? "rgba(34,197,94,0.15)"
                              : ev.reviewer_status === "rejected" ? "rgba(239,68,68,0.15)"
                              : "var(--border)"
                            }`,
                          }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="text-xs font-mono font-medium"
                                style={{ color: "var(--gold)", minWidth: 140 }}>
                                {ev.field_name}
                              </span>
                              <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.70)" }}>
                                {ev.field_value ?? "—"}
                              </span>
                            </div>
                            {ev.evidence_text && (
                              <p className="text-xs mt-1 italic"
                                style={{ color: "var(--text-ghost)", fontFamily: "monospace" }}>
                                &ldquo;{ev.evidence_text.slice(0, 120)}{ev.evidence_text.length > 120 ? "…" : ""}&rdquo;
                              </p>
                            )}
                            {ev.confidence != null && (
                              <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-ghost)" }}>
                                confidence: {Math.round(ev.confidence * 100)}%
                                {ev.provider ? ` · ${ev.provider}` : ""}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {ev.reviewer_status !== "verified" && (
                              <button type="button" disabled={isPending}
                                onClick={() => handleVerifyEvidence(ev.id)}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: "rgba(34,197,94,0.10)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.20)" }}>
                                ✓
                              </button>
                            )}
                            {ev.reviewer_status !== "rejected" && (
                              <button type="button" disabled={isPending}
                                onClick={() => handleRejectEvidence(ev.id)}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.20)" }}>
                                ✗
                              </button>
                            )}
                            <span className="text-xs px-1.5 py-1 rounded"
                              style={{
                                color: ev.reviewer_status === "verified" ? "var(--success)"
                                  : ev.reviewer_status === "rejected" ? "var(--danger)"
                                  : "var(--text-ghost)",
                                background: "transparent",
                              }}>
                              {ev.reviewer_status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Source Registry Tab ────────────────────────────────────────────────── */}
      {tab === "registry" && (
        <div className="space-y-3">
          {/* Header with link to full CRUD page */}
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {filteredRegistry.length} of {registry.length} sources
            </p>
            <Link href="/admin/sources"
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: "rgba(201,153,42,0.12)", color: "var(--gold)", border: "1px solid rgba(201,153,42,0.25)" }}>
              Full CRUD Editor →
            </Link>
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ value: "all", label: `All (${registry.length})` },
              ...categories.map(cat => ({
                value: cat,
                label: `${CAT_LABELS[cat] ?? cat} (${registry.filter(s => s.category === cat).length})`
              }))
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setCatFilter(opt.value)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{
                  background:  catFilter === opt.value ? "var(--bg-surface-md)" : "transparent",
                  color:       catFilter === opt.value ? "rgba(255,255,255,0.80)" : "var(--text-ghost)",
                  border:      "1px solid var(--border)",
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredRegistry.length === 0 ? (
              <div className="rounded-xl px-4 py-8 text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>No sources in this category</p>
              </div>
            ) : filteredRegistry.map(src => (
              <RegistryRow
                key={src.id}
                src={src}
                onToggle={handleToggleRegistry}
                disabled={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Source Health Tab ──────────────────────────────────────────────────── */}
      {tab === "health" && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            {sourceHealth.length} sources monitored
          </p>
          {sourceHealth.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>No health data yet</p>
            </div>
          ) : sourceHealth.map(snap => (
            <SourceHealthRow
              key={snap.source_id}
              snap={snap}
              onToggle={handleToggleHealth}
              onReset={handleReset}
              disabled={isPending}
            />
          ))}
        </div>
      )}

      {/* ── Run History Tab ────────────────────────────────────────────────────── */}
      {tab === "runs" && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            {initialRunsPage.total} total runs
            {initialRunsPage.totalPages > 1 && ` · page ${initialRunsPage.page}/${initialRunsPage.totalPages}`}
          </p>
          {initialRunsPage.rows.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>No runs yet — trigger the scraper above</p>
            </div>
          ) : initialRunsPage.rows.map(run => (
            <div key={run.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(run.status)}
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
                    {new Date(run.started_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                    by {run.triggered_by}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
                  {run.sources_checked} sources · {run.items_found} found · {run.items_new} new · {run.items_duplicate} dup
                </p>
              </div>
              {run.finished_at && (
                <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-ghost)" }}>
                  {Math.round(
                    (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
                  )}s
                </span>
              )}
            </div>
          ))}
          <Paginator
            page={initialRunsPage.page}
            totalPages={initialRunsPage.totalPages}
            tab="runs"
          />
        </div>
      )}
    </div>
  )
}
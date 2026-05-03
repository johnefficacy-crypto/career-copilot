"use client"

/**
 * components/admin/SourceRegistryManager.tsx
 * Career Copilot — Source Registry CRUD Manager
 *
 * ALL FIXES APPLIED:
 *  1. useRef + useEffect for prefill drawer auto-open (was Promise.resolve().then → React warning)
 *  2. key={editSource?.id ?? "new"} on SourceDrawer (forces remount on source switch)
 *  3. handleSaved updates source in-place (edit) or prepends (create)
 *  4. SourceInspectorPanel embedded as side drawer (replaces /admin/sources/inspect page)
 *  5. requires_login field included in sourceToForm (was missing)
 */

import { useState, useTransition, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import {
  SOURCE_CATEGORIES,
  SOURCE_TYPES,
  ADAPTER_TYPES,
  ANTI_BOT_RISKS,
  TIERS,
  TIER_LABELS,
  JURISDICTIONS,
  ALL_STATES_AND_UTS,
  SCRAPE_INTERVALS,
  SOURCE_FORM_DEFAULTS,
} from "@/lib/constants/source-registry"
import {
  createSource,
  updateSource,
  deleteSource,
  toggleSourceActive,
  markSourceVerified,
  resetSourceFails,
  bulkToggleSources,
  bulkDeleteSources,
  type SourceFormData,
} from "@/actions/sources"
import { SourceInspectorPanel } from "@/components/admin/SourceInspectorPanel"
import type { SourceRegistryRow } from "@/lib/constants/source-registry"

// ─── Source type ──────────────────────────────────────────────────────────────

type Source = Pick<SourceRegistryRow,
  | "id" | "source_name" | "short_code" | "source_type" | "category"
  | "jurisdiction" | "state" | "parent_org" | "official_url" | "notification_url"
  | "rss_url" | "api_url" | "pdf_bulletin_url" | "adapter_type"
  | "scrape_interval_hours" | "tier" | "trust_score" | "anti_bot_risk"
  | "requires_playwright" | "requires_login"
  | "has_captcha" | "pdf_only" | "is_active" | "is_verified"
  | "consecutive_fails" | "last_scraped_at" | "last_success_at" | "last_changed_at"
  | "last_error" | "notes" | "added_by" | "parser_config"
  | "created_at" | "updated_at"
>

// ─── Prefill data (from Source Inspector) ────────────────────────────────────

export type PrefillData = {
  official_url?:          string
  notification_url?:      string
  rss_url?:               string
  api_url?:               string
  adapter_type?:          string
  anti_bot_risk?:         string
  trust_score?:           number
  requires_playwright?:   boolean
  has_captcha?:           boolean
  pdf_only?:              boolean
  is_active?:             boolean
  scrape_interval_hours?: number
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sources:         Source[]
  initialSearch:   string
  initialCategory: string
  initialTier:     string
  initialStatus:   string
  prefill?:        PrefillData
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const css = {
  surface:    "#111827",
  surfaceMd:  "#1a2535",
  border:     "#1f2937",
  borderMd:   "#374151",
  textBase:   "rgba(255,255,255,0.85)",
  textMuted:  "rgba(255,255,255,0.50)",
  textGhost:  "rgba(255,255,255,0.28)",
  gold:       "#C9992A",
  goldFaint:  "rgba(201,153,42,0.12)",
  success:    "#22c55e",
  danger:     "#ef4444",
  warning:    "#f59e0b",
  teal:       "#0e9f6e",
}

const EMPTY_FORM: Omit<SourceFormData, "id"> = { ...SOURCE_FORM_DEFAULTS }
const CATEGORIES = SOURCE_CATEGORIES

// ─── UI primitives ────────────────────────────────────────────────────────────

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ color, background: bg, border: `1px solid ${color}28` }}>
      {text}
    </span>
  )
}

function IconBtn({ onClick, title, children, danger = false, disabled = false }: {
  onClick: () => void; title: string; children: React.ReactNode
  danger?: boolean; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs"
      style={{
        background: danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
        color:      danger ? css.danger : css.textMuted,
        border:     `1px solid ${danger ? "rgba(239,68,68,0.20)" : css.border}`,
        opacity:    disabled ? 0.4 : 1,
        cursor:     disabled ? "not-allowed" : "pointer",
      }}>
      {children}
    </button>
  )
}

function Input({ label, value, onChange, placeholder = "", type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: css.textGhost }}>
        {label}{required && <span style={{ color: css.danger }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: css.surfaceMd, border: `1px solid ${css.border}`, color: css.textBase }}
      />
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: css.textGhost }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
        style={{ background: css.surfaceMd, border: `1px solid ${css.border}`, color: css.textBase }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm" style={{ color: css.textMuted }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: css.textGhost }}>{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
        style={{ background: checked ? css.gold : css.borderMd, border: `1px solid ${checked ? css.gold : css.borderMd}` }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{ background: "#fff", left: checked ? "22px" : "2px" }} />
      </button>
    </div>
  )
}

// ─── Pure helper ─────────────────────────────────────────────────────────────

function sourceToForm(s: Source): Omit<SourceFormData, "id"> {
  return {
    source_name:           s.source_name,
    short_code:            s.short_code          ?? "",
    source_type:           s.source_type,
    category:              s.category,
    jurisdiction:          s.jurisdiction        ?? "central",
    state:                 s.state               ?? "",
    parent_org:            s.parent_org          ?? "",
    official_url:          s.official_url,
    notification_url:      s.notification_url    ?? "",
    rss_url:               s.rss_url             ?? "",
    api_url:               s.api_url             ?? "",
    pdf_bulletin_url:      s.pdf_bulletin_url    ?? "",
    adapter_type:          s.adapter_type,
    scrape_interval_hours: s.scrape_interval_hours,
    tier:                  s.tier,
    trust_score:           s.trust_score,
    anti_bot_risk:         s.anti_bot_risk,
    requires_playwright:   s.requires_playwright,
    requires_login:        s.requires_login,
    has_captcha:           s.has_captcha,
    pdf_only:              s.pdf_only,
    is_active:             s.is_active,
    is_verified:           s.is_verified,
    notes:                 s.notes               ?? "",
  }
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ source, onConfirm, onCancel, isPending }: {
  source: Source; onConfirm: () => void; onCancel: () => void; isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative rounded-2xl p-6 w-full max-w-sm space-y-4"
        style={{ background: css.surfaceMd, border: `1px solid ${css.borderMd}` }}>
        <h3 className="text-base font-semibold" style={{ color: css.textBase }}>Delete source?</h3>
        <p className="text-sm" style={{ color: css.textMuted }}>
          This will permanently remove <strong style={{ color: css.textBase }}>{source.source_name}</strong>{" "}
          and clear its ETag cache and health metrics. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm"
            style={{ background: css.surfaceMd, color: css.textMuted, border: `1px solid ${css.border}` }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.15)", color: css.danger, border: "1px solid rgba(239,68,68,0.30)" }}>
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Source row ───────────────────────────────────────────────────────────────

function SourceRow({
  source, selected, onSelect, onEdit, onDelete, onToggle, onVerify, onReset, disabled,
}: {
  source: Source; selected: boolean; disabled: boolean
  onSelect: () => void; onEdit: () => void; onDelete: () => void
  onToggle: () => void; onVerify: () => void; onReset: () => void
}) {
  const isHealthy  = source.consecutive_fails < 5
  const lastScrape = source.last_scraped_at
    ? new Date(source.last_scraped_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "Never"

  const adapterColor: Record<string, string> = {
    rss: css.success, json: css.teal, html: css.textMuted, pdf: "#a78bfa", playwright: css.warning, manual: css.textGhost,
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl group transition-colors"
      style={{
        background: selected ? "rgba(201,153,42,0.06)" : css.surface,
        border:     `1px solid ${selected ? "rgba(201,153,42,0.25)" : !isHealthy && source.is_active ? "rgba(239,68,68,0.20)" : css.border}`,
        opacity:    source.is_active ? 1 : 0.55,
      }}>

      <input type="checkbox" checked={selected} onChange={onSelect}
        className="w-3.5 h-3.5 rounded shrink-0 cursor-pointer accent-yellow-500" />

      <span className="w-2 h-2 rounded-full shrink-0"
        style={{ background: !source.is_active ? css.textGhost : isHealthy ? css.success : css.danger }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: css.textBase }}>{source.source_name}</span>
          {source.short_code && (
            <span className="text-xs font-mono px-1.5 py-px rounded"
              style={{ color: css.textGhost, background: "rgba(255,255,255,0.04)", border: `1px solid ${css.border}` }}>
              {source.short_code}
            </span>
          )}
          <Pill
            text={TIER_LABELS[source.tier] ?? `T${source.tier}`}
            color={source.tier === 1 ? css.gold : source.tier === 2 ? "rgba(255,255,255,0.65)" : css.textGhost}
            bg={source.tier === 1 ? css.goldFaint : "rgba(255,255,255,0.05)"}
          />
          <span className="text-xs px-1.5 py-px rounded"
            style={{ color: adapterColor[source.adapter_type] ?? css.textGhost, background: "rgba(255,255,255,0.04)" }}>
            {source.adapter_type}
          </span>
          {source.is_verified && (
            <span className="text-xs" style={{ color: css.teal }}>✓ verified</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs truncate max-w-xs" style={{ color: css.textGhost }}>
            {source.notification_url ?? source.official_url}
          </span>
          <span className="text-xs" style={{ color: css.textGhost }}>·</span>
          <span className="text-xs" style={{ color: css.textGhost }}>last: {lastScrape}</span>
          {source.consecutive_fails > 0 && (
            <>
              <span className="text-xs" style={{ color: css.textGhost }}>·</span>
              <span className="text-xs" style={{ color: source.consecutive_fails >= 5 ? css.danger : css.warning }}>
                ⚠ {source.consecutive_fails} fails
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions (visible on hover or always on mobile) */}
      <div className="flex items-center gap-1 shrink-0">
        {source.consecutive_fails > 0 && (
          <IconBtn onClick={onReset} title="Reset fails + re-enable" disabled={disabled}>↺</IconBtn>
        )}
        <IconBtn onClick={onVerify} title={source.is_verified ? "Unverify" : "Mark verified"} disabled={disabled}>
          {source.is_verified ? "✓" : "○"}
        </IconBtn>
        <IconBtn onClick={onToggle} title={source.is_active ? "Disable" : "Enable"} disabled={disabled}>
          {source.is_active ? "⏸" : "▶"}
        </IconBtn>
        <IconBtn onClick={onEdit} title="Edit source" disabled={disabled}>✎</IconBtn>
        <IconBtn onClick={onDelete} title="Delete source" danger disabled={disabled}>✕</IconBtn>
      </div>
    </div>
  )
}

// ─── Source drawer ────────────────────────────────────────────────────────────

function SourceDrawer({
  open, onClose, editSource, prefillData, onSaved,
}: {
  open: boolean; onClose: () => void; editSource: Source | null
  prefillData?: PrefillData; onSaved: (src: Source) => void
}) {
  const isEdit = editSource !== null

  const [form, setForm] = useState<Omit<SourceFormData, "id">>(() => {
    if (editSource) return sourceToForm(editSource)
    if (prefillData) return {
      ...EMPTY_FORM,
      official_url:          prefillData.official_url         ?? EMPTY_FORM.official_url,
      notification_url:      prefillData.notification_url     ?? EMPTY_FORM.notification_url,
      rss_url:               prefillData.rss_url              ?? EMPTY_FORM.rss_url,
      api_url:               prefillData.api_url              ?? EMPTY_FORM.api_url,
      adapter_type:          prefillData.adapter_type         ?? EMPTY_FORM.adapter_type,
      anti_bot_risk:         prefillData.anti_bot_risk        ?? EMPTY_FORM.anti_bot_risk,
      trust_score:           prefillData.trust_score          ?? EMPTY_FORM.trust_score,
      requires_playwright:   prefillData.requires_playwright  ?? EMPTY_FORM.requires_playwright,
      has_captcha:           prefillData.has_captcha          ?? EMPTY_FORM.has_captcha,
      pdf_only:              prefillData.pdf_only             ?? EMPTY_FORM.pdf_only,
      is_active:             prefillData.is_active            ?? EMPTY_FORM.is_active,
      scrape_interval_hours: prefillData.scrape_interval_hours ?? EMPTY_FORM.scrape_interval_hours,
    }
    return { ...EMPTY_FORM }
  })

  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  const set = (key: keyof typeof form) => (value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateSource(editSource!.id, form)
        : await createSource(form)

      if (!result.success) {
        setError(result.error ?? "Unknown error")
        return
      }

      const saved: Source = isEdit
        ? { ...editSource!, ...form, updated_at: new Date().toISOString() }
        : {
            id:                result.id!,
            consecutive_fails: 0,
            last_scraped_at:   null,
            last_success_at:   null,
            last_error:        null,
            last_changed_at:   null,
            created_at:        new Date().toISOString(),
            updated_at:        new Date().toISOString(),
            added_by:          "admin",
            parser_config:     {},
            ...form,
            short_code:        form.short_code       || null,
            state:             form.state            || null,
            parent_org:        form.parent_org       || null,
            notification_url:  form.notification_url || null,
            rss_url:           form.rss_url          || null,
            api_url:           form.api_url          || null,
            pdf_bulletin_url:  form.pdf_bulletin_url || null,
            notes:             form.notes            || null,
          }

      onSaved(saved)
      onClose()
    })
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col"
        style={{ background: "#0d1626", borderLeft: `1px solid ${css.borderMd}`, boxShadow: "-8px 0 40px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${css.border}` }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: css.textBase }}>
              {isEdit ? "Edit Source" : "Add New Source"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: css.textGhost }}>
              {isEdit ? `Editing: ${editSource?.source_name}` : "Add a new source to the scraping registry"}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: "rgba(255,255,255,0.04)", color: css.textGhost, border: `1px solid ${css.border}` }}>
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {error && (
            <div className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", color: css.danger }}>
              ✗ {error}
            </div>
          )}

          {/* Identity */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Source Name" value={form.source_name} onChange={set("source_name")}
                  placeholder="e.g. UPSC Official Notifications" required />
              </div>
              <Input label="Short Code" value={form.short_code} onChange={set("short_code")} placeholder="e.g. UPSC" />
              <Select label="Category" value={form.category} onChange={set("category")}
                options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))} />
              <Select label="Source Type" value={form.source_type} onChange={set("source_type")}
                options={SOURCE_TYPES.map(t => ({ value: t.value, label: t.label }))} />
              <Select label="Jurisdiction" value={form.jurisdiction} onChange={set("jurisdiction")}
                options={JURISDICTIONS.map(j => ({ value: j.value, label: j.label }))} />
              {(form.jurisdiction === "state" || form.jurisdiction === "ut") && (
                <div className="col-span-2">
                  <Select label="State / UT" value={form.state} onChange={set("state")}
                    options={[{ value: "", label: "— Select —" }, ...ALL_STATES_AND_UTS.map(s => ({ value: s, label: s }))]} />
                </div>
              )}
              <div className="col-span-2">
                <Input label="Parent Organisation (optional)" value={form.parent_org} onChange={set("parent_org")}
                  placeholder="e.g. Ministry of Finance" />
              </div>
            </div>
          </div>

          {/* URLs */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>URLs</p>
            <div className="grid gap-3">
              <Input label="Official URL *" value={form.official_url} onChange={set("official_url")}
                placeholder="https://upsc.gov.in" required />
              <Input label="Notification / Listing URL" value={form.notification_url} onChange={set("notification_url")}
                placeholder="https://upsc.gov.in/examinations/active-examinations" />
              <Input label="RSS Feed URL" value={form.rss_url} onChange={set("rss_url")}
                placeholder="https://upsc.gov.in/feed.xml" />
              <Input label="JSON API URL" value={form.api_url} onChange={set("api_url")}
                placeholder="https://upsc.gov.in/wp-json/wp/v2/posts" />
              <Input label="PDF Bulletin URL" value={form.pdf_bulletin_url} onChange={set("pdf_bulletin_url")}
                placeholder="https://upsc.gov.in/notifications.pdf" />
            </div>
          </div>

          {/* Adapter Config */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>Adapter Config</p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Adapter Type" value={form.adapter_type} onChange={set("adapter_type")}
                options={ADAPTER_TYPES.map(a => ({ value: a.value, label: `${a.label} — ${a.desc.slice(0, 30)}` }))} />
              <Select label="Anti-Bot Risk" value={form.anti_bot_risk} onChange={set("anti_bot_risk")}
                options={ANTI_BOT_RISKS.map(r => ({ value: r.value, label: `${r.label} — ${r.desc.slice(0, 28)}` }))} />
            </div>
          </div>

          {/* Scrape Settings */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>Scrape Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tier" value={String(form.tier)} onChange={v => set("tier")(Number(v))}
                options={TIERS.map(t => ({ value: String(t.value), label: t.label }))} />
              <Select label="Scrape Interval" value={String(form.scrape_interval_hours)}
                onChange={v => set("scrape_interval_hours")(Number(v))}
                options={SCRAPE_INTERVALS.map(i => ({ value: String(i.value), label: i.label }))} />
              <div>
                <label className="block text-xs mb-1.5" style={{ color: css.textGhost }}>Trust Score (0–1)</label>
                <input type="number" min="0" max="1" step="0.05" value={form.trust_score}
                  onChange={e => set("trust_score")(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: css.surfaceMd, border: `1px solid ${css.border}`, color: css.textBase }} />
              </div>
            </div>
          </div>

          {/* Flags */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>Flags</p>
            <div className="space-y-3 rounded-xl p-4" style={{ background: css.surfaceMd, border: `1px solid ${css.border}` }}>
              <Toggle label="Active" checked={form.is_active} onChange={set("is_active")}
                hint="Inactive sources are skipped by the scraper" />
              <Toggle label="Verified" checked={form.is_verified} onChange={set("is_verified")}
                hint="Mark after confirming the URL actually returns notifications" />
              <Toggle label="Requires Playwright" checked={form.requires_playwright} onChange={set("requires_playwright")}
                hint="JS-rendered SPA — needs headless browser (not yet implemented in Edge Function)" />
              <Toggle label="Requires Login" checked={form.requires_login} onChange={set("requires_login")}
                hint="Content behind authentication — cannot be auto-scraped" />
              <Toggle label="Has CAPTCHA" checked={form.has_captcha} onChange={set("has_captcha")}
                hint="CAPTCHA on the listings page itself (not just login)" />
              <Toggle label="PDF Only" checked={form.pdf_only} onChange={set("pdf_only")}
                hint="All notifications are PDFs — use pdf adapter" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: css.gold }}>Notes</p>
            <textarea value={form.notes} onChange={e => set("notes")(e.target.value)}
              rows={3} placeholder="Any notes about this source — URL changes, known issues, etc."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: css.surfaceMd, border: `1px solid ${css.border}`, color: css.textBase }} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 flex gap-3" style={{ borderTop: `1px solid ${css.border}` }}>
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: css.surfaceMd, color: css.textMuted, border: `1px solid ${css.border}` }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: isPending ? css.goldFaint : "rgba(201,153,42,0.20)", color: css.gold, border: "1px solid rgba(201,153,42,0.35)", opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Source"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SourceRegistryManager({
  sources: initialSources,
  initialSearch,
  initialCategory,
  initialTier,
  initialStatus,
  prefill,
}: Props) {
  const [sources, setSources]           = useState<Source[]>(initialSources)
  const [search, setSearch]             = useState(initialSearch)
  const [catFilter, setCatFilter]       = useState(initialCategory)
  const [tierFilter, setTierFilter]     = useState(initialTier)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [editSource, setEditSource]     = useState<Source | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Source | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  // FIX: useRef + useEffect instead of Promise.resolve().then()
  // Promise.resolve fires as a microtask before mount — React warns about
  // state updates on unmounted components. useEffect fires after mount.
  const prefillAppliedRef = useRef(false)
  useEffect(() => {
    if (prefill && !prefillAppliedRef.current) {
      prefillAppliedRef.current = true
      setEditSource(null)
      setDrawerOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function openEdit(src: Source) { setEditSource(src); setDrawerOpen(true) }
  function openNew()              { setEditSource(null); setDrawerOpen(true) }
  function closeDrawer() {
    setDrawerOpen(false)
    setTimeout(() => setEditSource(null), 200)
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return sources.filter(s => {
      const q = search.toLowerCase()
      if (q && !s.source_name.toLowerCase().includes(q) &&
               !s.official_url.toLowerCase().includes(q) &&
               !(s.short_code?.toLowerCase().includes(q))) return false
      if (catFilter !== "all" && s.category !== catFilter) return false
      if (tierFilter !== "all" && String(s.tier) !== tierFilter) return false
      if (statusFilter === "active"     && !s.is_active)             return false
      if (statusFilter === "inactive"   && s.is_active)              return false
      if (statusFilter === "failing"    && s.consecutive_fails < 5)  return false
      if (statusFilter === "unverified" && s.is_verified)            return false
      return true
    })
  }, [sources, search, catFilter, tierFilter, statusFilter])

  const stats = useMemo(() => ({
    total:    sources.length,
    active:   sources.filter(s => s.is_active).length,
    verified: sources.filter(s => s.is_verified).length,
    failing:  sources.filter(s => s.consecutive_fails >= 5).length,
    tier1:    sources.filter(s => s.tier === 1).length,
  }), [sources])

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) setSelected(new Set(filtered.map(s => s.id)))
    else setSelected(new Set())
  }

  // FIX: handleSaved correctly replaces in-place (edit) or prepends (create)
  function handleSaved(saved: Source) {
    setSources(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
    showToast(editSource ? `Updated "${saved.source_name}"` : `Added "${saved.source_name}"`)
  }

  function handleToggle(src: Source) {
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_active: !s.is_active } : s))
    startTransition(async () => {
      const r = await toggleSourceActive(src.id, !src.is_active)
      if (!r.success) {
        setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_active: src.is_active } : s))
        showToast(r.error ?? "Toggle failed", false)
      }
    })
  }

  function handleVerify(src: Source) {
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_verified: !s.is_verified } : s))
    startTransition(async () => {
      const r = await markSourceVerified(src.id, !src.is_verified)
      if (!r.success) showToast(r.error ?? "Verify failed", false)
    })
  }

  function handleReset(src: Source) {
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, consecutive_fails: 0, is_active: true, last_error: null } : s))
    startTransition(async () => {
      const r = await resetSourceFails(src.id)
      if (!r.success) showToast(r.error ?? "Reset failed", false)
      else showToast(`Reset fails for "${src.source_name}"`)
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setSources(prev => prev.filter(s => s.id !== target.id))
    setDeleteTarget(null)
    startTransition(async () => {
      const r = await deleteSource(target.id)
      if (!r.success) {
        setSources(prev => [target, ...prev])
        showToast(r.error ?? "Delete failed", false)
      } else {
        showToast(`Deleted "${target.source_name}"`)
      }
    })
  }

  function handleBulkEnable() {
    const ids = Array.from(selected)
    setSources(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_active: true } : s))
    setSelected(new Set())
    startTransition(async () => {
      const r = await bulkToggleSources(ids, true)
      if (!r.success) showToast(r.error ?? "Bulk enable failed", false)
      else showToast(`Enabled ${ids.length} source(s)`)
    })
  }

  function handleBulkDisable() {
    const ids = Array.from(selected)
    setSources(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_active: false } : s))
    setSelected(new Set())
    startTransition(async () => {
      const r = await bulkToggleSources(ids, false)
      if (!r.success) showToast(r.error ?? "Bulk disable failed", false)
      else showToast(`Disabled ${ids.length} source(s)`)
    })
  }

  function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} source(s)? This cannot be undone.`)) return
    const ids    = Array.from(selected)
    const backup = sources.filter(s => ids.includes(s.id))
    setSources(prev => prev.filter(s => !ids.includes(s.id)))
    setSelected(new Set())
    startTransition(async () => {
      const r = await bulkDeleteSources(ids)
      if (!r.success) {
        setSources(prev => [...backup, ...prev])
        showToast(r.error ?? "Bulk delete failed", false)
      } else {
        showToast(`Deleted ${ids.length} source(s)`)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-xl"
          style={{
            background: toast.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border:     `1px solid ${toast.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
            color:      toast.ok ? css.success : css.danger,
          }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: css.textBase }}>Source Registry</h1>
          <p className="text-sm mt-0.5" style={{ color: css.textMuted }}>
            Manage all scraping sources — add, edit, verify, or remove URLs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/sources/guide"
            className="px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(255,255,255,0.04)", color: css.textGhost, border: `1px solid ${css.border}` }}>
            📖 Field Guide
          </Link>
          {/* FIX: Opens side panel instead of navigating to separate page */}
          <button type="button" onClick={() => setInspectorOpen(true)}
            className="px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(255,255,255,0.04)", color: css.textGhost, border: `1px solid ${css.border}` }}>
            🔍 Inspect URL
          </button>
          <button type="button" onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(201,153,42,0.18)", color: css.gold, border: "1px solid rgba(201,153,42,0.35)" }}>
            + Add Source
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",    value: stats.total,    color: css.textBase },
          { label: "Active",   value: stats.active,   color: css.success  },
          { label: "Verified", value: stats.verified, color: css.teal     },
          { label: "Failing",  value: stats.failing,  color: stats.failing > 0 ? css.danger : css.textMuted },
          { label: "Tier 1",   value: stats.tier1,    color: css.gold     },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-4 py-3"
            style={{ background: css.surface, border: `1px solid ${css.border}` }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: css.textGhost }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, URL, or code…"
          className="flex-1 min-w-48 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: css.surface, border: `1px solid ${css.border}`, color: css.textBase }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={{ background: css.surface, border: `1px solid ${css.border}`, color: css.textMuted }}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={{ background: css.surface, border: `1px solid ${css.border}`, color: css.textMuted }}>
          <option value="all">All tiers</option>
          {[1, 2, 3, 4].map(t => <option key={t} value={String(t)}>T{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={{ background: css.surface, border: `1px solid ${css.border}`, color: css.textMuted }}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="failing">Failing (≥5 fails)</option>
          <option value="unverified">Unverified</option>
        </select>
        <span className="px-3 py-2 text-xs self-center" style={{ color: css.textGhost }}>
          {filtered.length} of {sources.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(201,153,42,0.08)", border: "1px solid rgba(201,153,42,0.25)" }}>
          <span className="text-sm font-medium" style={{ color: css.gold }}>{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={handleBulkEnable}
              className="text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: "rgba(34,197,94,0.10)", color: css.success, border: "1px solid rgba(34,197,94,0.25)" }}>
              Enable all
            </button>
            <button type="button" onClick={handleBulkDisable}
              className="text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: "rgba(245,158,11,0.10)", color: css.warning, border: "1px solid rgba(245,158,11,0.25)" }}>
              Disable all
            </button>
            <button type="button" onClick={handleBulkDelete}
              className="text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: "rgba(239,68,68,0.10)", color: css.danger, border: "1px solid rgba(239,68,68,0.25)" }}>
              Delete all
            </button>
            <button type="button" onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: css.surfaceMd, color: css.textGhost, border: `1px solid ${css.border}` }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Select all */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-4">
          <input type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={handleSelectAll}
            className="w-3.5 h-3.5 cursor-pointer accent-yellow-500" />
          <span className="text-xs" style={{ color: css.textGhost }}>Select all {filtered.length}</span>
        </div>
      )}

      {/* Source list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl px-6 py-12 text-center"
          style={{ background: css.surface, border: `1px solid ${css.border}` }}>
          <p className="text-3xl mb-3 opacity-20">🔍</p>
          <p className="text-sm" style={{ color: css.textMuted }}>
            {sources.length === 0 ? "No sources yet. Add your first source." : "No sources match your filters."}
          </p>
          {sources.length === 0 && (
            <button type="button" onClick={openNew}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: css.goldFaint, color: css.gold, border: "1px solid rgba(201,153,42,0.25)" }}>
              + Add First Source
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(src => (
            <SourceRow
              key={src.id}
              source={src}
              selected={selected.has(src.id)}
              disabled={isPending}
              onSelect={() => setSelected(prev => {
                const n = new Set(prev)
                if (n.has(src.id)) n.delete(src.id); else n.add(src.id)
                return n
              })}
              onEdit={()   => openEdit(src)}
              onDelete={()  => setDeleteTarget(src)}
              onToggle={()  => handleToggle(src)}
              onVerify={()  => handleVerify(src)}
              onReset={()   => handleReset(src)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit drawer — key forces full remount when switching sources */}
      <SourceDrawer
        key={editSource?.id ?? "new"}
        open={drawerOpen}
        onClose={closeDrawer}
        editSource={editSource}
        prefillData={editSource ? undefined : prefill}
        onSaved={handleSaved}
      />

      {/* Inspector side panel */}
      <SourceInspectorPanel
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteModal
          source={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={isPending}
        />
      )}
    </div>
  )
}
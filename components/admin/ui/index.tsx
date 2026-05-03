/**
 * components/admin/ui/index.tsx
 * Shared admin UI primitives — consistent styling across all admin forms.
 * Import from "@/components/admin/ui" everywhere in admin pages.
 */

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react"

// ─── Base tokens ──────────────────────────────────────────────────────────────

const inputBase =
  "w-full rounded-xl px-3.5 py-2.5 text-sm text-white/85 bg-white/[0.04] border border-white/[0.10] " +
  "placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 focus:bg-white/[0.06] transition-colors"

const labelBase = "block text-xs font-medium text-white/40 mb-1.5"

// ─── AdminInput ───────────────────────────────────────────────────────────────

interface AdminInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?:  string
  error?: string
}

export function AdminInput({ label, hint, error, className = "", ...rest }: AdminInputProps) {
  return (
    <div className="space-y-1">
      {label && <label className={labelBase}>{label}</label>}
      <input
        className={`${inputBase} ${error ? "border-red-500/40 focus:border-red-500/60" : ""} ${className}`}
        {...rest}
      />
      {hint  && !error && <p className="text-white/25 text-xs">{hint}</p>}
      {error && <p className="text-red-400/70 text-xs">{error}</p>}
    </div>
  )
}

// ─── AdminSelect ─────────────────────────────────────────────────────────────

interface AdminSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:    string
  hint?:     string
  error?:    string
  options:   { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}

export function AdminSelect({
  label, hint, error, options, placeholder, className = "", ...rest
}: AdminSelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className={labelBase}>{label}</label>}
      <select
        className={`${inputBase} ${error ? "border-red-500/40" : ""} ${className}`}
        style={{ colorScheme: "dark" }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {hint  && !error && <p className="text-white/25 text-xs">{hint}</p>}
      {error && <p className="text-red-400/70 text-xs">{error}</p>}
    </div>
  )
}

// ─── AdminTextarea ────────────────────────────────────────────────────────────

interface AdminTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?:  string
  error?: string
}

export function AdminTextarea({ label, hint, error, className = "", ...rest }: AdminTextareaProps) {
  return (
    <div className="space-y-1">
      {label && <label className={labelBase}>{label}</label>}
      <textarea
        className={`${inputBase} resize-none ${error ? "border-red-500/40" : ""} ${className}`}
        rows={rest.rows ?? 4}
        {...rest}
      />
      {hint  && !error && <p className="text-white/25 text-xs">{hint}</p>}
      {error && <p className="text-red-400/70 text-xs">{error}</p>}
    </div>
  )
}

// ─── AdminSection ─────────────────────────────────────────────────────────────

interface AdminSectionProps {
  title:       string
  description?: string
  children:    ReactNode
}

export function AdminSection({ title, description, children }: AdminSectionProps) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {description && <p className="text-xs text-white/35 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

// ─── AdminArrayField ──────────────────────────────────────────────────────────
// Editable list of string values (e.g. tags, states, categories)

interface AdminArrayFieldProps {
  label?:    string
  hint?:     string
  values:    string[]
  onChange:  (values: string[]) => void
  placeholder?: string
}

export function AdminArrayField({ label, hint, values, onChange, placeholder }: AdminArrayFieldProps) {
  function add() { onChange([...values, ""]) }
  function update(i: number, v: string) {
    const next = [...values]; next[i] = v; onChange(next)
  }
  function remove(i: number) { onChange(values.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-2">
      {label && <label className={labelBase}>{label}</label>}
      {values.map((v, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={v}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className={`${inputBase} flex-1`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-white/25 hover:text-red-400/70 text-lg leading-none transition-colors"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        + Add item
      </button>
      {hint && <p className="text-white/25 text-xs">{hint}</p>}
    </div>
  )
}

// ─── AdminFormFooter ──────────────────────────────────────────────────────────

interface AdminFormFooterProps {
  pending?:    boolean
  submitLabel?: string
  onCancel?:   () => void
  error?:      string
  success?:    string
}

export function AdminFormFooter({
  pending = false,
  submitLabel = "Save",
  onCancel,
  error,
  success,
}: AdminFormFooterProps) {
  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <div className="flex-1">
        {error   && <p className="text-red-400/80 text-xs">{error}</p>}
        {success && <p className="text-emerald-400/80 text-xs">{success}</p>}
      </div>
      <div className="flex items-center gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "rgba(232,213,163,0.15)", color: "#e8d5a3", border: "1px solid rgba(232,213,163,0.25)" }}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  )
}

// ─── AdminStatusPill ──────────────────────────────────────────────────────────

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral"

const STATUS_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20",
  warning: "bg-amber-500/10  text-amber-400/80  border-amber-500/20",
  error:   "bg-red-500/10    text-red-400/80    border-red-500/20",
  info:    "bg-blue-500/10   text-blue-400/80   border-blue-500/20",
  neutral: "bg-white/[0.04]  text-white/40      border-white/[0.10]",
}

interface AdminStatusPillProps {
  label:    string
  variant?: StatusVariant
}

export function AdminStatusPill({ label, variant = "neutral" }: AdminStatusPillProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLES[variant]}`}>
      {label}
    </span>
  )
}

// ─── AdminConfirmModal ────────────────────────────────────────────────────────

interface AdminConfirmModalProps {
  open:      boolean
  title:     string
  message:   string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      "danger" | "default"
  onConfirm: () => void
  onCancel:  () => void
}

export function AdminConfirmModal({
  open, title, message,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "default",
  onConfirm, onCancel,
}: AdminConfirmModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative rounded-2xl border border-white/[0.10] bg-[#181818] p-6 w-full max-w-sm mx-4 space-y-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
        <p className="text-xs text-white/45 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/60 border border-white/[0.08] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              variant === "danger"
                ? "bg-red-500/15 text-red-400/90 border border-red-500/30 hover:bg-red-500/20"
                : "border border-[#e8d5a3]/25 hover:bg-[#e8d5a3]/10"
            }`}
            style={variant !== "danger" ? { color: "#e8d5a3", background: "rgba(232,213,163,0.12)" } : {}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

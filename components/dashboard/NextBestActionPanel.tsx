"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import type { NextAction, NextActionType } from "@/lib/db/next-actions"
import { markActionDone, dismissAction, snoozeAction } from "@/actions/next-actions"

// ─── Icons & labels ───────────────────────────────────────────────────────────

const ACTION_ICON: Record<NextActionType, string> = {
  apply_now:           "🔴",
  deadline_alert:      "⏰",
  complete_profile:    "👤",
  study_today:         "📖",
  setup_plan:          "🗺️",
  check_eligibility:   "✅",
  check_notifications: "🔔",
  mock_test:           "📝",
}

const ACTION_ACCENT: Record<NextActionType, string> = {
  apply_now:           "rgba(239,68,68,0.12)",
  deadline_alert:      "rgba(251,191,36,0.10)",
  complete_profile:    "rgba(99,102,241,0.10)",
  study_today:         "rgba(16,185,129,0.10)",
  setup_plan:          "rgba(232,213,163,0.08)",
  check_eligibility:   "rgba(16,185,129,0.08)",
  check_notifications: "rgba(232,213,163,0.08)",
  mock_test:           "rgba(139,92,246,0.10)",
}

const ACTION_BORDER: Record<NextActionType, string> = {
  apply_now:           "rgba(239,68,68,0.25)",
  deadline_alert:      "rgba(251,191,36,0.20)",
  complete_profile:    "rgba(99,102,241,0.20)",
  study_today:         "rgba(16,185,129,0.20)",
  setup_plan:          "rgba(232,213,163,0.15)",
  check_eligibility:   "rgba(16,185,129,0.15)",
  check_notifications: "rgba(232,213,163,0.15)",
  mock_test:           "rgba(139,92,246,0.20)",
}

// ─── Single action card ───────────────────────────────────────────────────────

function ActionCard({ action, onDone, onDismiss, onSnooze, busy }: {
  action:    NextAction
  onDone:    (id: string) => void
  onDismiss: (id: string) => void
  onSnooze:  (id: string) => void
  busy:      boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="relative flex items-start gap-4 rounded-2xl px-4 py-4 transition-colors"
      style={{
        background: ACTION_ACCENT[action.action_type],
        border:     `1px solid ${ACTION_BORDER[action.action_type]}`,
      }}
    >
      {/* Icon */}
      <span className="text-xl shrink-0 mt-0.5 select-none">
        {ACTION_ICON[action.action_type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 leading-snug truncate">
          {action.title}
        </p>
        {action.description && (
          <p className="text-xs text-white/45 mt-0.5 leading-relaxed line-clamp-2">
            {action.description}
          </p>
        )}
        {action.due_at && (
          <p className="text-xs mt-1.5" style={{ color: "rgba(251,191,36,0.70)" }}>
            Due {new Date(action.due_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          </p>
        )}
        {action.cta_url && action.cta_label && (
          <Link
            href={action.cta_url}
            className="inline-block mt-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "rgba(232,213,163,0.80)" }}
          >
            {action.cta_label} →
          </Link>
        )}
      </div>

      {/* Actions menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen(v => !v)}
          disabled={busy}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          aria-label="Action options"
        >
          ···
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-8 z-20 rounded-xl border border-white/[0.10] bg-[#1c1c1c] shadow-2xl overflow-hidden min-w-[140px]"
            >
              <button
                onClick={() => { setMenuOpen(false); onDone(action.id) }}
                className="w-full text-left px-4 py-2.5 text-xs text-white/60 hover:bg-white/[0.05] hover:text-emerald-400/80 transition-colors"
              >
                ✓ Mark done
              </button>
              <button
                onClick={() => { setMenuOpen(false); onSnooze(action.id) }}
                className="w-full text-left px-4 py-2.5 text-xs text-white/60 hover:bg-white/[0.05] transition-colors"
              >
                ⏸ Snooze 24h
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDismiss(action.id) }}
                className="w-full text-left px-4 py-2.5 text-xs text-white/40 hover:bg-white/[0.05] transition-colors"
              >
                ✕ Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  actions: NextAction[]
}

export function NextBestActionPanel({ actions }: Props) {
  const [items, setItems] = useState(actions)
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    setItems(prev => prev.filter(a => a.id !== id))
  }

  function handleDone(id: string) {
    remove(id)
    startTransition(async () => { await markActionDone(id) })
  }

  function handleDismiss(id: string) {
    remove(id)
    startTransition(async () => { await dismissAction(id) })
  }

  function handleSnooze(id: string) {
    remove(id)
    startTransition(async () => { await snoozeAction(id) })
  }

  if (items.length === 0) return null

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
          What to do next
        </h2>
        {items.length > 3 && (
          <span className="text-xs text-white/25">{items.length} actions</span>
        )}
      </div>

      {/* Action cards — show top 4 max */}
      <div className="space-y-2.5">
        {items.slice(0, 4).map(action => (
          <ActionCard
            key={action.id}
            action={action}
            onDone={handleDone}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
            busy={pending}
          />
        ))}
      </div>

      {/* Overflow hint */}
      {items.length > 4 && (
        <p className="text-xs text-white/20 mt-2 text-right">
          +{items.length - 4} more action{items.length - 4 > 1 ? "s" : ""}
        </p>
      )}
    </section>
  )
}

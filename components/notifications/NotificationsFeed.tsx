"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { NotificationAlert } from "@/types/notifications"
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alertTypeLabel(type: string): string {
  switch (type) {
    case "new_match":    return "New match"
    case "deadline_3day": return "3 days left"
    case "deadline_1day": return "Last day"
    case "status_change": return "Status change"
    default:             return "Notification"
  }
}

function alertTypeDot(type: string): string {
  switch (type) {
    case "deadline_3day":
    case "deadline_1day": return "var(--danger)"
    case "new_match":     return "var(--gold)"
    default:              return "var(--text-muted)"
  }
}

function deadlineLabel(days: number | null): string | null {
  if (days === null) return null
  if (days < 0)  return "Closed"
  if (days === 0) return "Today"
  if (days === 1) return "1 day left"
  return `${days}d left`
}

function deadlineColor(days: number | null): string {
  if (days === null) return "var(--text-muted)"
  if (days <= 1)  return "var(--danger)"
  if (days <= 7)  return "var(--warning)"
  return "var(--success)"
}

function urgencyBg(days: number | null): string {
  if (days === null) return "transparent"
  if (days <= 3) return "rgba(239,68,68,0.06)"
  return "transparent"
}

// ─── Row component ────────────────────────────────────────────────────────────

function NotificationRow({
  alert,
  onRead,
}: {
  alert: NotificationAlert
  onRead: (id: string) => void
}) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{
        background: alert.is_read ? "transparent" : urgencyBg(alert.days_to_deadline) || "rgba(232,213,163,0.04)",
        border: "1px solid",
        borderColor: alert.is_read ? "var(--border)" : "rgba(232,213,163,0.12)",
      }}
    >
      {/* Unread dot */}
      <div className="pt-1 shrink-0">
        {!alert.is_read ? (
          <span
            className="block w-2 h-2 rounded-full"
            style={{ background: alertTypeDot(alert.alert_type) }}
          />
        ) : (
          <span className="block w-2 h-2 rounded-full opacity-0" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm font-medium truncate"
            style={{ color: alert.is_read ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.85)" }}
          >
            {alert.recruitment_name}
          </p>
          {alert.days_to_deadline !== null && (
            <span
              className="text-xs shrink-0 px-2 py-0.5 rounded-full"
              style={{
                color:      deadlineColor(alert.days_to_deadline),
                background: "rgba(255,255,255,0.05)",
                border:     `1px solid ${deadlineColor(alert.days_to_deadline)}33`,
              }}
            >
              {deadlineLabel(alert.days_to_deadline)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
            {alert.org_name ?? ""}
          </span>
          {alert.org_type && (
            <>
              <span style={{ color: "var(--text-ghost)" }}>·</span>
              <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                {alert.org_type}
              </span>
            </>
          )}
          <span style={{ color: "var(--text-ghost)" }}>·</span>
          <span
            className="text-xs px-1.5 py-px rounded"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-dim)",
            }}
          >
            {alertTypeLabel(alert.alert_type)}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          {alert.apply_end_date && (
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Apply by {new Date(alert.apply_end_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          )}
          {!alert.is_read && (
            <button
              type="button"
              onClick={() => onRead(alert.id)}
              className="text-xs transition-colors"
              style={{ color: "var(--text-ghost)" }}
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main feed ────────────────────────────────────────────────────────────────

interface Props {
  alerts:      NotificationAlert[]
  unreadCount: number
  planId:      string
}

export function NotificationsFeed({ alerts, unreadCount, planId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [localAlerts, setLocalAlerts] = useState<NotificationAlert[]>(alerts)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const isFree = planId === "free"
  // Free plan: show 5 notifications max
  const visibleAlerts = isFree
    ? localAlerts.slice(0, 5)
    : localAlerts

  const displayed = filter === "unread"
    ? visibleAlerts.filter((a) => !a.is_read)
    : visibleAlerts

  function handleRead(id: string) {
    setLocalAlerts((prev) =>
      prev.map((a) => a.id === id ? { ...a, is_read: true, read_at: new Date().toISOString() } : a)
    )
    startTransition(() => void markNotificationRead(id))
  }

  function handleReadAll() {
    setLocalAlerts((prev) => prev.map((a) => ({ ...a, is_read: true, read_at: new Date().toISOString() })))
    startTransition(() => void markAllNotificationsRead())
  }

  const currentUnread = localAlerts.filter((a) => !a.is_read).length

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Notifications
          </p>
          {currentUnread > 0 && (
            <span
              className="text-xs px-1.5 py-px rounded-full font-medium"
              style={{
                background: "var(--gold-faint)",
                border: "1px solid var(--gold-border)",
                color: "var(--gold)",
              }}
            >
              {currentUnread}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex items-center gap-1">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="text-xs px-2 py-0.5 rounded-lg transition-colors capitalize"
                style={{
                  background: filter === f ? "var(--bg-surface-md)" : "transparent",
                  color: filter === f ? "rgba(255,255,255,0.70)" : "var(--text-ghost)",
                  border: "1px solid",
                  borderColor: filter === f ? "var(--border-md)" : "transparent",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {currentUnread > 0 && (
            <button
              type="button"
              onClick={handleReadAll}
              disabled={isPending}
              className="text-xs transition-colors"
              style={{ color: "var(--text-ghost)" }}
            >
              {isPending ? "…" : "Mark all read"}
            </button>
          )}

          <Link
            href="/dashboard/notifications"
            className="text-xs transition-colors"
            style={{ color: "rgba(232,213,163,0.60)" }}
          >
            View all →
          </Link>
        </div>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2 opacity-30">🔔</p>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet. Complete your profile to get matched exams."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((alert) => (
            <NotificationRow key={alert.id} alert={alert} onRead={handleRead} />
          ))}
        </div>
      )}

      {/* Free plan gate */}
      {isFree && localAlerts.length > 5 && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-center"
          style={{
            background: "rgba(232,213,163,0.04)",
            border: "1px solid rgba(232,213,163,0.12)",
          }}
        >
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {localAlerts.length - 5} more notifications hidden on Free plan
          </p>
          <Link
            href="/pricing"
            className="text-xs font-medium"
            style={{ color: "var(--gold)" }}
          >
            Upgrade to Pro to see all →
          </Link>
        </div>
      )}
    </div>
  )
}
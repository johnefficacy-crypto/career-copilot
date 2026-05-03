"use client"

/**
 * components/dashboard/NotificationsFeed.tsx
 * Career Copilot — Notification Engine v2
 *
 * Upgrades over v1:
 *  - Reads from v_notification_feed view (richer data)
 *  - Shows explanation tooltip ("Why you got this")
 *  - Priority-aware styling (critical = red border)
 *  - Tracks recruitments inline
 *  - Supabase Realtime subscription for live updates
 *  - Proper TypeScript against NotificationAlert type
 */

import { useState, useEffect, useTransition, useCallback } from "react"
import Link from "next/link"
import type { NotificationAlert } from "@/types/notifications"
import {
  markNotificationRead,
  markAllNotificationsRead,
  trackRecruitmentAction,
  untrackRecruitmentAction,
} from "@/actions/notifications"
import { createClient } from "@/utils/supabase/client"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eventTypeLabel(type: string | null, alertType: string): string {
  switch (type ?? alertType) {
    case "application_open":
    case "new_match":         return "New opening"
    case "deadline_approaching":
    case "deadline_3day":     return "Deadline soon"
    case "deadline_1day":     return "Last day!"
    case "deadline_changed":  return "Deadline changed"
    case "vacancy_changed":   return "Vacancies updated"
    case "status_changed":    return "Status change"
    case "result_released":   return "Result out"
    case "admit_card_released": return "Admit card"
    case "corrigendum":       return "Corrigendum"
    case "recruitment_withdrawn": return "Withdrawn"
    default:                  return "Update"
  }
}

function priorityBorderColor(priority: number): string {
  switch (priority) {
    case 1: return "rgba(239,68,68,0.40)"
    case 2: return "rgba(245,158,11,0.35)"
    case 3: return "rgba(232,213,163,0.18)"
    default: return "var(--border)"
  }
}

function priorityDotColor(priority: number, alertType: string): string {
  if (priority === 1) return "var(--danger)"
  if (alertType.includes("deadline")) return "var(--danger)"
  if (alertType === "new_match") return "var(--gold)"
  return "var(--text-muted)"
}

function deadlineLabel(days: number | null): string | null {
  if (days === null)  return null
  if (days < 0)       return "Closed"
  if (days === 0)     return "Today"
  if (days === 1)     return "1 day left"
  return `${days}d left`
}

function deadlineColor(days: number | null): string {
  if (days === null) return "var(--text-muted)"
  if (days <= 1)     return "var(--danger)"
  if (days <= 7)     return "var(--warning)"
  return "var(--success)"
}

// ─── Explanation tooltip ──────────────────────────────────────────────────────

function WhyTooltip({ explanation }: { explanation: NotificationAlert["explanation"] }) {
  const [show, setShow] = useState(false)
  if (!explanation) return null

  const reasons: string[] = []
  if (explanation.is_tracked)     reasons.push("You're tracking this")
  if (explanation.is_eligible)    reasons.push("You're eligible")
  if (explanation.matched_exam)   reasons.push("Matches your target exam")
  if (explanation.matched_sector) reasons.push("Matches preferred sector")
  if (explanation.matched_type)   reasons.push("Matches your target type")

  if (!reasons.length) return null

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-xs px-1 py-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: "var(--text-ghost)", fontSize: "10px" }}
      >
        Why?
      </button>
      {show && (
        <div
          className="absolute bottom-full left-0 mb-1 z-50 rounded-lg px-3 py-2 text-xs whitespace-nowrap"
          style={{
            background:  "var(--bg-surface-md)",
            border:      "1px solid var(--border-md)",
            color:       "rgba(255,255,255,0.75)",
            minWidth:    "160px",
            boxShadow:   "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {reasons.map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span style={{ color: "var(--gold)" }}>✓</span> {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotificationRow({
  alert,
  onRead,
  onTrackToggle,
}: {
  alert:          NotificationAlert
  onRead:         (id: string) => void
  onTrackToggle:  (recruitmentId: string, tracked: boolean) => void
}) {
  const priority = alert.priority ?? 3

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-200"
      style={{
        background: alert.is_read
          ? "transparent"
          : priority === 1
            ? "rgba(239,68,68,0.04)"
            : "rgba(232,213,163,0.04)",
        border:      "1px solid",
        borderColor: alert.is_read ? "var(--border)" : priorityBorderColor(priority),
      }}
    >
      {/* Priority dot */}
      <div className="pt-1.5 shrink-0">
        {!alert.is_read ? (
          <span
            className="block w-2 h-2 rounded-full"
            style={{ background: priorityDotColor(priority, alert.alert_type) }}
          />
        ) : (
          <span className="block w-2 h-2 rounded-full bg-transparent" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/recruitments/${alert.recruitment_id}`}
            className="text-sm font-medium truncate hover:underline transition-colors"
            style={{ color: alert.is_read ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)" }}
          >
            {alert.recruitment_name}
          </Link>
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

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {alert.org_name && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {alert.org_name}
            </span>
          )}
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
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-dim)" }}
          >
            {eventTypeLabel(alert.event_type, alert.alert_type)}
          </span>
          {alert.total_vacancies && (
            <>
              <span style={{ color: "var(--text-ghost)" }}>·</span>
              <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                {alert.total_vacancies.toLocaleString("en-IN")} vacancies
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {alert.apply_end_date && (
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Apply by {new Date(alert.apply_end_date).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          )}

          <WhyTooltip explanation={alert.explanation} />

          {!alert.is_read && (
            <button
              type="button"
              onClick={() => onRead(alert.id)}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--text-ghost)" }}
            >
              Mark read
            </button>
          )}

          <button
            type="button"
            onClick={() => onTrackToggle(alert.recruitment_id, alert.is_tracked)}
            className="text-xs transition-colors hover:opacity-80"
            style={{ color: alert.is_tracked ? "var(--gold)" : "var(--text-ghost)" }}
          >
            {alert.is_tracked ? "★ Tracking" : "☆ Track"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main feed ────────────────────────────────────────────────────────────────

interface Props {
  alerts?: NotificationAlert[]
  unreadCount: number
  planId: string
  userId: string
}

export function NotificationsFeed({
  alerts: initialAlerts = [],
  unreadCount,
  planId,
  userId,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [localAlerts, setLocalAlerts] = useState<NotificationAlert[]>(initialAlerts)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  // Keep localAlerts in sync when the server component re-renders with fresh
  // initialAlerts (e.g. after router.refresh() from track/untrack, or after
  // the user completes onboarding and new rows land). Previously this was
  // commented out, so the feed went stale on every server revalidation.
  useEffect(() => {
    setLocalAlerts(initialAlerts)
  }, [initialAlerts])

  const isFree = planId === "free"
  const maxVisible = isFree ? 5 : localAlerts.length

  // ── Supabase Realtime — live unread updates ──
  // Realtime fires on notification_alerts (the raw table). But the UI binds
  // against `NotificationAlert`, which is the enriched shape from
  // v_notification_feed (recruitment_name, org_name, days_to_deadline,
  // explanation, is_tracked, etc.). Casting the raw INSERT row to
  // NotificationAlert — as the previous version did — left most of those
  // fields undefined and rendered as a broken placeholder row.
  //
  // Fix: when an INSERT fires, take the row id and refetch that one row
  // from the view. We optimistically show a minimal placeholder in the
  // meantime so the feed doesn't flicker.
  useEffect(() => {
    const client = createClient()
    const channel = client
      .channel(`notif-feed-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_alerts",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const rawId = (payload.new as { id?: string } | null)?.id
          if (!rawId) return

          const { data, error } = await client
            .from("v_notification_feed")
            .select("*")
            .eq("id", rawId)
            .maybeSingle()

          if (error || !data) {
            // View-side row not ready yet (view is non-materialized so this
            // normally isn't an issue, but bail gracefully rather than show
            // a half-populated card).
            return
          }

          const enriched = data as unknown as NotificationAlert

          setLocalAlerts((prev) => {
            if (prev.some((a) => a.id === enriched.id)) return prev
            return [enriched, ...prev]
          })
        }
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [userId])

  const handleRead = useCallback((id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, is_read: true, read_at: new Date().toISOString() }
          : a
      )
    )
    startTransition(() => void markNotificationRead(id))
  }, [])

  const handleReadAll = useCallback(() => {
    setLocalAlerts((prev) =>
      prev.map((a) => ({ ...a, is_read: true, read_at: new Date().toISOString() }))
    )
    startTransition(() => void markAllNotificationsRead())
  }, [])

  const handleTrackToggle = useCallback((recruitmentId: string, isTracked: boolean) => {
    startTransition(() => {
      if (isTracked) {
        void untrackRecruitmentAction(recruitmentId)
      } else {
        void trackRecruitmentAction(recruitmentId)
      }
    })

    setLocalAlerts((prev) =>
      prev.map((a) =>
        a.recruitment_id === recruitmentId
          ? { ...a, is_tracked: !isTracked }
          : a
      )
    )
  }, [])

  const visible = localAlerts.slice(0, maxVisible)
  const displayed = filter === "unread" ? visible.filter((a) => !a.is_read) : visible
  const currentUnread = localAlerts.filter((a) => !a.is_read).length

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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

      {displayed.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-2xl mb-2 opacity-30">🔔</p>
          {filter === "unread" ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>All caught up!</p>
          ) : (
            <>
              <p className="text-sm mb-1" style={{ color: "var(--text-dim)" }}>
                No notifications yet
              </p>
              <p className="text-xs mb-3" style={{ color: "var(--text-ghost)" }}>
                Notifications are sent when new exams open that match your profile.
                The system runs every 6 hours.
              </p>
              <Link
                href="/dashboard/exams"
                className="inline-block px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{
                  background: "var(--gold-faint)",
                  border: "1px solid var(--gold-border)",
                  color: "var(--gold)",
                }}
              >
                Browse open exams →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((alert) => (
            <NotificationRow
              key={alert.id}
              alert={alert}
              onRead={handleRead}
              onTrackToggle={handleTrackToggle}
            />
          ))}
        </div>
      )}

      {isFree && localAlerts.length > 5 && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-center"
          style={{
            background: "rgba(232,213,163,0.04)",
            border: "1px solid rgba(232,213,163,0.12)",
          }}
        >
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {localAlerts.length - 5} more notifications on Pro
          </p>
          <Link
            href="/pricing"
            className="text-xs font-medium"
            style={{ color: "var(--gold)" }}
          >
            Upgrade to Pro →
          </Link>
        </div>
      )}
    </div>
  )
}
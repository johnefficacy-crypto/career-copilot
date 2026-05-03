// components/dashboard/NotificationBell.tsx
// Career Copilot — Phase 10
// Notification alerts bell shown in DashboardShell nav
// Shows unread count, clicking opens a dropdown of alerts.
// Uses a Server Component for data, Client Component for the dropdown.

"use client"

import { useState, useTransition } from "react"
import type { NotificationAlert } from "@/types/notifications"
import { markUserAlertsRead } from "@/actions/notifications"

function timeAgoSimple(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
import Link from "next/link"

interface NotificationBellProps {
  initialAlerts: NotificationAlert[]
  unreadCount: number
}

const ALERT_ICONS: Record<string, string> = {
  new_match:      "🎯",
  deadline_3day:  "⏰",
  deadline_1day:  "🔴",
  status_change:  "📋",
}

const ALERT_LABELS: Record<string, string> = {
  new_match:     "Confirmed match",
  deadline_3day: "Deadline in 3 days",
  deadline_1day: "Last day to apply",
  status_change: "Status changed",
}

export function NotificationBell({ initialAlerts, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState(initialAlerts)
  const [count, setCount] = useState(unreadCount)
  const [isPending, startTransition] = useTransition()

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open && count > 0) {
      // Mark all as read
      startTransition(async () => {
        await markUserAlertsRead()
        setCount(0)
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      })
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
        aria-label="Notifications"
      >
        <span className="text-white/40 hover:text-white/70 transition-colors">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#e8d5a3] text-[#0c0c0c] text-[9px] font-bold flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-white/[0.09] bg-[#141414] shadow-2xl overflow-hidden animate-fadeUp">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Notifications</p>
              <Link
                href="/dashboard/notifications"
                className="text-white/25 text-xs hover:text-[#e8d5a3]/60 transition-colors"
                onClick={() => setOpen(false)}
              >
                View all →
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-white/30 text-xs">No notifications yet.</p>
                <p className="text-white/20 text-xs mt-1">You&apos;ll be alerted when new matching exams appear.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
                {alerts.map(alert => {
                  return (
                    <Link
                      key={alert.id}
                      href={`/dashboard`}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors ${
                        !alert.is_read ? "bg-[#e8d5a3]/[0.03]" : ""
                      }`}
                    >
                      <span className="text-base shrink-0 mt-0.5">{ALERT_ICONS[alert.alert_type] ?? "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/60 text-xs font-medium mb-0.5">
                          {ALERT_LABELS[alert.alert_type]}
                        </p>
                        <p className="text-white/45 text-xs leading-snug truncate">
                          {alert.recruitment_name} — {alert.org_name ?? ""}
                        </p>
                        <p className="text-white/20 text-[10px] mt-1">
                          {timeAgoSimple(alert.sent_at)}
                        </p>
                      </div>
                      {!alert.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e8d5a3] shrink-0 mt-1.5" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
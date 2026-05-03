/**
 * app/dashboard/notifications/page.tsx
 * Career Copilot — All Notifications Page
 *
 * FIXES (from Technical Report Phase A):
 *  - Removed force-dynamic, replaced with revalidate = 30
 *    "Eliminates full Supabase round-trip on repeat loads for most users"
 *    Notifications don't change more frequently than every 30s for a given user.
 *    Real-time mark-as-read still works via server actions (mutations bypass cache).
 *  - Uses getUserNotifications() from lib/db/notifications (Phase 2 data layer)
 *    instead of legacy getUserAlerts() from lib/scraping/alerts (Phase 10 artifact)
 *  - Auth + data fetch done cleanly without legacy delete-scraping imports
 */

import Link          from "next/link"
import { redirect }  from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getGroupedUserNotifications, getNotificationReadiness } from "@/lib/db/notifications"
import type { GroupedNotification } from "@/types/notifications"
import type { NotificationReadiness } from "@/lib/db/notifications"
import { markAllNotificationsRead } from "@/actions/notifications"
import { submitRecruitmentFeedback } from "@/actions/feedback"

// Phase 2 report recommendation: revalidate=30 instead of force-dynamic
// Saves 1 full Supabase RTT (~1.3s from India) on every repeat page load
export const revalidate = 30
export const metadata = { title: "Notifications — Career Copilot" }

const ALERT_ICONS: Record<string, string> = {
  new_recruitment:      "🆕",
  application_open:     "📋",
  deadline_approaching: "⏰",
  deadline_changed:     "📅",
  vacancy_changed:      "👥",
  status_changed:       "🔄",
  admit_card_released:  "🎫",
  result_released:      "📊",
  new_match:            "🎯",
  deadline_3day:        "⏰",
  deadline_1day:        "🔴",
  status_change:        "📋",
}

const ALERT_LABELS: Record<string, string> = {
  new_recruitment:      "New recruitment",
  application_open:     "Applications open",
  deadline_approaching: "Deadline approaching",
  deadline_changed:     "Deadline changed",
  vacancy_changed:      "Vacancies updated",
  status_changed:       "Status changed",
  admit_card_released:  "Admit card released",
  result_released:      "Result released",
  new_match:            "Confirmed match",
  deadline_3day:        "Deadline in 3 days",
  deadline_1day:        "Last day to apply",
  status_change:        "Status changed",
}

function NotificationsEmptyState({ readiness }: { readiness: NotificationReadiness | null }) {
  if (!readiness) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-12 text-center">
        <p className="text-3xl mb-3 opacity-20">🔔</p>
        <p className="text-white/40 text-sm">No notifications yet.</p>
      </div>
    )
  }

  const { blockers, recommendedActions } = readiness

  // No blockers at all → eligibility is clean but no open matches
  if (blockers.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 text-center">
        <p className="text-3xl mb-3 opacity-20">✅</p>
        <p className="text-white/60 text-sm font-medium mb-1">Your profile is fully set up.</p>
        <p className="text-white/30 text-xs">
          Notifications will appear here as new official recruitments are verified and matched to your profile.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 space-y-5">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5 opacity-50">🔔</span>
        <div>
          <p className="text-white/70 text-sm font-medium mb-0.5">No notifications yet</p>
          <p className="text-white/30 text-xs">
            Here is why you are not receiving exam match alerts:
          </p>
        </div>
      </div>

      {/* Blockers */}
      <div className="space-y-2">
        {blockers.map((b, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <span className="text-red-400/70 text-sm mt-px shrink-0">✗</span>
            <p className="text-white/55 text-xs leading-relaxed">{b}</p>
          </div>
        ))}
      </div>

      {/* Recommended actions */}
      {recommendedActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/25 text-xs font-medium uppercase tracking-wider px-1">
            What to do
          </p>
          {recommendedActions.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ background: "rgba(232,213,163,0.04)", border: "1px solid rgba(232,213,163,0.12)" }}>
              <span className="text-[#e8d5a3]/50 text-sm mt-px shrink-0">→</span>
              <p className="text-white/50 text-xs leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      )}

      {/* Profile CTA if onboarding incomplete */}
      {!readiness.onboardingCompleted && (
        <Link href="/onboarding"
          className="inline-block px-4 py-2 rounded-xl text-sm mt-2"
          style={{ background: "rgba(232,213,163,0.12)", color: "#e8d5a3", border: "1px solid rgba(232,213,163,0.25)" }}>
          Complete profile →
        </Link>
      )}
      {readiness.onboardingCompleted && (
        <Link href="/dashboard"
          className="inline-block px-4 py-2 rounded-xl text-xs mt-2"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ← Back to dashboard
        </Link>
      )}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return "Just now"
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  // Auth — sequential (must confirm user before fetching their data)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [alerts, readiness] = await Promise.all([
    getGroupedUserNotifications(user.id, { limit: 50 }),
    getNotificationReadiness(user.id).catch(() => null),
  ])
  const unread = alerts.filter(a => a.unread_count > 0)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* Header */}
      <div className="border-b border-white/[0.06] sticky top-0 z-30 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard"
              className="text-white/30 text-sm hover:text-white/60 transition-colors">
              ← Dashboard
            </Link>
            <span className="text-white/10">/</span>
            <span className="text-white/60 text-sm font-medium">Notifications</span>
          </div>
          {unread.length > 0 && (
            <form action={markAllNotificationsRead}>
              <button type="submit"
                className="text-white/30 text-xs hover:text-white/60 transition-colors">
                Mark all read
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl text-white font-medium mb-1">Notifications</h1>
          <p className="text-white/35 text-sm">
            {unread.length > 0
              ? `${unread.length} unread · ${alerts.length} total`
              : `${alerts.length} notifications · all read`}
          </p>
        </div>

        {alerts.length === 0 ? (
          <NotificationsEmptyState readiness={readiness} />
        ) : (
          <div className="space-y-2">
            {alerts.map((alert: GroupedNotification) => (
              <div
                key={alert.recruitment_id}
                className="flex items-start gap-4 px-4 py-4 rounded-xl transition-colors"
                style={{
                  background: alert.unread_count === 0
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(232,213,163,0.04)",
                  border:     `1px solid ${alert.unread_count === 0 ? "rgba(255,255,255,0.06)" : "rgba(232,213,163,0.15)"}`,
                }}>

                {/* Icon */}
                <span className="text-xl shrink-0 mt-0.5">
                  {ALERT_ICONS[alert.latest_alert_type] ?? "🔔"}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ color: "rgba(232,213,163,0.70)", background: "rgba(232,213,163,0.08)" }}>
                      {ALERT_LABELS[alert.latest_alert_type] ?? alert.latest_alert_type}
                    </span>
                    {alert.unread_count > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e8d5a3] shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-white/85 truncate">
                    {alert.recruitment_name ?? "Recruitment notification"}
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5">Status: {alert.days_to_deadline == null ? "unknown" : alert.days_to_deadline <= 0 ? "closed" : alert.days_to_deadline <= 7 ? "closing_soon" : "open"}</p>
                  {alert.org_name && (
                    <p className="text-xs text-white/40 mt-0.5">
                      {alert.org_name}
                      {alert.days_to_deadline != null && (
                        <span className="ml-2 text-white/30">
                          · {alert.days_to_deadline <= 0 ? "Deadline passed" : `${alert.days_to_deadline}d left`}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <details className="mt-2">
                  <summary className="text-[11px] text-white/35 cursor-pointer hover:text-white/55">Report issue</summary>
                  <form action={submitRecruitmentFeedback} className="mt-2 space-y-2">
                    <input type="hidden" name="recruitment_id" value={alert.recruitment_id} />
                    <select name="feedback_type" className="w-full bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1 text-xs text-white" defaultValue="wrong_match">
                      <option value="wrong_match">Wrong match</option>
                      <option value="deadline_wrong">Deadline incorrect</option>
                      <option value="official_link_broken">Official link broken</option>
                      <option value="duplicate_notification">Duplicate notification</option>
                      <option value="not_interested">Not interested</option>
                      <option value="already_applied">Already applied</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea name="message" rows={2} className="w-full bg-white/[0.04] border border-white/[0.1] rounded px-2 py-1 text-xs text-white" placeholder="Optional details" />
                    <button type="submit" className="text-xs px-2 py-1 rounded border border-white/[0.15] text-white/70 hover:text-white">Submit report</button>
                  </form>
                </details>

                {/* Time */}
                <span className="text-xs text-white/25 shrink-0 mt-0.5">
                  {timeAgo(alert.latest_sent_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

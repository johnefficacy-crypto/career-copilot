/**
 * app/admin/notifications/page.tsx
 * Admin — Notification Governance
 *
 * - Send log: recent notification_alerts with status counts
 * - Emergency kill switch: pauses all outbound email/push via a flag in admin_settings
 * - Role-restricted: requires "notifications" permission
 */

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"
import Link from "next/link"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
export const metadata = { title: "Notification Governance — Admin" }

// ─── Kill switch action ───────────────────────────────────────────────────────

async function toggleKillSwitch(formData: FormData) {
  "use server"
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  let ctx
  try { ctx = await requireAdminRole("notifications") } catch { redirect("/dashboard") }

  const enable = formData.get("enable") === "true"

  await supabase
    .from("admin_settings")
    .upsert({ key: "notifications_paused", value: enable ? "true" : "false", updated_by: user.id })

  await logAdminAction({
    actorId:    ctx.userId,
    actorEmail: ctx.userEmail,
    action:     enable ? "pause_notifications" : "resume_notifications",
    entityType: "notifications",
    notes:      enable ? "Kill switch engaged — all outbound notifications paused" : "Kill switch cleared — notifications resumed",
  })

  revalidatePath("/admin/notifications")
  redirect(`/admin/notifications?success=Notifications+${enable ? "paused" : "resumed"}`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("notifications") } catch { redirect("/dashboard") }

  const params = await searchParams.catch(() => ({ success: undefined as string | undefined, error: undefined as string | undefined }))

  // Fetch notification stats + recent alerts + kill switch state in parallel
  const [statsRes, recentRes, killRes] = await Promise.allSettled([
    supabase
      .from("notification_alerts")
      .select("id", { count: "exact" })
      .limit(0),
    supabase
      .from("notification_alerts")
      .select("id, user_id, alert_type, is_read, sent_at")
      .order("sent_at", { ascending: false })
      .limit(50),
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "notifications_paused")
      .maybeSingle(),
  ])

  // Per-status counts via grouped query
  const [sentRes, pendingRes, unreadRes] = await Promise.allSettled([
    supabase.from("notification_alerts").select("id", { count: "exact" }).eq("email_sent", true).limit(0),
    supabase.from("notification_alerts").select("id", { count: "exact" }).eq("email_sent", false).limit(0),
    supabase.from("notification_alerts").select("id", { count: "exact" }).eq("is_read", false).limit(0),
  ])

  const totalAlerts  = statsRes.status === "fulfilled"  ? (statsRes.value.count ?? 0) : 0
  const sentCount    = sentRes.status === "fulfilled"   ? (sentRes.value.count ?? 0) : 0
  const pendingCount = pendingRes.status === "fulfilled" ? (pendingRes.value.count ?? 0) : 0
  const unreadCount  = unreadRes.status === "fulfilled"  ? (unreadRes.value.count ?? 0) : 0

  type AlertRow = { id: string; user_id: string; alert_type: string; is_read: boolean; sent_at: string | null }
  const recent: AlertRow[] = recentRes.status === "fulfilled" ? ((recentRes.value.data ?? []) as AlertRow[]) : []

  const isPaused = killRes.status === "fulfilled" && killRes.value.data?.value === "true"

  function fmt(d: string | null) {
    if (!d) return "—"
    return new Date(d).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Notification Governance
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          {totalAlerts.toLocaleString()} total alerts · send logs · emergency kill switch
        </p>
      </div>

      {params.success && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {decodeURIComponent(params.success)}
        </div>
      )}
      {params.error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(params.error)}
        </div>
      )}

      {/* Kill switch */}
      <div className={`rounded-xl border p-5 ${isPaused ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-white mb-1">
              Emergency kill switch
              {isPaused && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  ACTIVE
                </span>
              )}
            </h2>
            <p className="text-white/35 text-xs leading-relaxed max-w-lg">
              {isPaused
                ? "All outbound notifications are currently paused. The email dispatcher and push worker will skip sending until you resume."
                : "Pausing immediately stops the email dispatcher and push worker from sending any new outbound alerts. Existing queued alerts are preserved."}
            </p>
          </div>
          <form action={toggleKillSwitch} className="shrink-0">
            <input type="hidden" name="enable" value={isPaused ? "false" : "true"} />
            <button
              type="submit"
              className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              style={isPaused
                ? { background: "rgba(134,239,172,0.12)", color: "#86efac", border: "1px solid rgba(134,239,172,0.25)" }
                : { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}
            >
              {isPaused ? "Resume notifications" : "Pause all notifications"}
            </button>
          </form>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total alerts",  value: totalAlerts,   accent: false },
          { label: "Email sent",    value: sentCount,     accent: false },
          { label: "Email unsent",  value: pendingCount,  accent: pendingCount > 0 },
          { label: "Unread",        value: unreadCount,   accent: unreadCount > 0 },
        ].map(s => (
          <div key={s.label}
            className={`rounded-xl border px-4 py-3 ${s.accent ? "bg-amber-500/[0.04] border-amber-500/20" : "bg-white/[0.02] border-white/[0.07]"}`}>
            <p className="text-white/35 text-xs uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold leading-none ${s.accent ? "text-amber-400" : "text-white"}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Send log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Recent send log
          </h2>
          <Link href="/admin/audit?entity_type=notifications" className="text-xs text-[#e8d5a3]/40 hover:text-[#e8d5a3]/70 transition-colors">
            Full audit log →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-white/35 text-sm">No notification alerts found.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["User ID", "Alert type", "Read", "Sent at"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-white/30 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recent.map(row => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-white/40 truncate block max-w-[120px]" title={row.user_id}>
                        {row.user_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>
                        {row.alert_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: row.is_read ? "rgba(255,255,255,0.30)" : "#fde68a" }}>
                        {row.is_read ? "read" : "unread"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/35 whitespace-nowrap">
                      {fmt(row.sent_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Link href="/admin/audit?entity_type=notifications"
          className="text-xs text-[#e8d5a3]/40 hover:text-[#e8d5a3]/70 transition-colors">
          View notification audit history →
        </Link>
        <Link href="/admin/rbac"
          className="text-xs text-white/25 hover:text-white/50 transition-colors">
          Manage notification permissions →
        </Link>
      </div>
    </div>
  )
}

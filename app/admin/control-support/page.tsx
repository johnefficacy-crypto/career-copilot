import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"

export const dynamic = "force-dynamic"
export const metadata = { title: "Control Support — Admin" }

export default async function ControlSupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("audit") } catch { redirect("/dashboard") }

  const [
    pendingScrapeReviewRes,
    eligibilityFailedRes,
    eligibilityPendingRes,
    notificationUnsentRes,
    notificationUnreadRes,
    notificationsPausedRes,
  ] = await Promise.all([
    supabase.from("scrape_queue").select("id", { count: "exact" }).eq("status", "pending").limit(0),
    supabase.from("eligibility_recompute_queue").select("id", { count: "exact" }).eq("status", "failed").limit(0),
    supabase.from("eligibility_recompute_queue").select("id", { count: "exact" }).eq("status", "pending").limit(0),
    supabase.from("notification_alerts").select("id", { count: "exact" }).eq("email_sent", false).limit(0),
    supabase.from("notification_alerts").select("id", { count: "exact" }).eq("is_read", false).limit(0),
    supabase.from("admin_settings").select("value").eq("key", "notifications_paused").maybeSingle(),
  ])

  const pendingScrapeReview = pendingScrapeReviewRes.count ?? 0
  const eligibilityFailed = eligibilityFailedRes.count ?? 0
  const eligibilityPending = eligibilityPendingRes.count ?? 0
  const notificationUnsent = notificationUnsentRes.count ?? 0
  const notificationUnread = notificationUnreadRes.count ?? 0
  const notificationsPaused = notificationsPausedRes.data?.value === "true"

  const riskCards = [
    { label: "Scrape review backlog", value: pendingScrapeReview, danger: pendingScrapeReview > 0, href: "/admin/scrape" },
    { label: "Eligibility failed", value: eligibilityFailed, danger: eligibilityFailed > 0, href: "/admin/eligibility-queue?status=failed" },
        { label: "Email unsent alerts", value: notificationUnsent, danger: notificationUnsent > 0, href: "/admin/notifications" },
  ]

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Control support dashboard
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          Ops-first visibility for backlog, SLA risk, and governance controls.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {riskCards.map((card) => (
          <Link key={card.label} href={card.href}
            className={`rounded-xl border px-4 py-3 transition-colors ${card.danger ? "bg-red-500/[0.04] border-red-500/25" : "bg-white/[0.02] border-white/[0.07] hover:border-white/[0.15]"}`}>
            <p className="text-white/35 text-xs uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-semibold leading-none ${card.danger ? "text-red-400" : "text-white"}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {card.value.toLocaleString()}
            </p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <h2 className="text-white text-sm font-medium mb-3">Operational signals</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <p className="text-white/60">Eligibility pending queue: <span className="text-white">{eligibilityPending.toLocaleString()}</span></p>
          <p className="text-white/60">Unread notifications: <span className="text-white">{notificationUnread.toLocaleString()}</span></p>
          <p className="text-white/60">Notification kill switch: <span className={notificationsPaused ? "text-red-400" : "text-emerald-400"}>{notificationsPaused ? "paused" : "active"}</span></p>
        </div>
      </div>
    </div>
  )
}

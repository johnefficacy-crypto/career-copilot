/**
 * app/admin/page.tsx — Admin Overview
 *
 * FIX: Wrapped getAdminStats() in try/catch to prevent 500 on timeout.
 * Added links to scrape dashboard and sources so the overview is useful.
 * Also added scraper status section showing last run info.
 */

import { getAdminStats } from "@/lib/db/admin"
import { getScrapeRuns, getScraperStats } from "@/lib/db/notifications"
import { adminTriggerEligibilityRecompute } from "@/actions/admin"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; info?: string }>
}) {
  const { success, error, info } = await searchParams

  // Both wrapped — proxy.ts timeout should not 500 the overview page
  const [stats, scraperStats, recentRuns] = await Promise.allSettled([
    getAdminStats(),
    getScraperStats(),
    getScrapeRuns(3),
  ])

  const s = stats.status === "fulfilled" ? stats.value : {
    organizations: 0, recruitments: 0, openRecruitments: 0, upcomingRecruitments: 0,
    posts: 0, totalUsers: 0, eligibleMatches: 0,
  }
  const ss = scraperStats.status === "fulfilled" ? scraperStats.value : null
  const runs = recentRuns.status === "fulfilled" ? recentRuns.value : []

  const statCards = [
    { label: "Organizations",        value: s.organizations },
    { label: "Total recruitments",   value: s.recruitments },
    { label: "Open now",             value: s.openRecruitments,    accent: true },
    { label: "Upcoming",             value: s.upcomingRecruitments },
    { label: "Posts defined",        value: s.posts },
    { label: "Registered users",     value: s.totalUsers },
    { label: "Eligible matches",     value: s.eligibleMatches,     accent: true },
    { label: "Pending review",       value: ss?.pendingReview ?? 0, accent: (ss?.pendingReview ?? 0) > 0 },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-white text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Admin overview
        </h1>
        <p className="text-white/40 text-sm">Manage notifications, posts, and eligibility.</p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {decodeURIComponent(success)}
        </div>
      )}
      {info && (
        <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
          {decodeURIComponent(info)}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label}
            className={`rounded-xl border px-4 py-3 ${s.accent ? "bg-[#e8d5a3]/[0.04] border-[#e8d5a3]/20" : "bg-white/[0.03] border-white/[0.07]"}`}>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold leading-none ${s.accent ? "text-[#e8d5a3]" : "text-white"}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/admin/recruitments/new",  title: "Add recruitment",   desc: "Create a notification with posts, criteria, and deadlines" },
          { href: "/admin/scrape",            title: "Scrape Dashboard",  desc: `${ss?.pendingReview ?? 0} items pending review · trigger manual run` },
          { href: "/admin/sources",           title: "Source Registry",   desc: "Manage scraping sources, inspect URLs, add new portals" },
          { href: "/admin/notifications",     title: "Notifications",     desc: "Send logs, kill switch, role-restricted sending" },
          { href: "/admin/recruitment-feedback", title: "Recruitment Feedback", desc: "Resolve wrong-match, deadline, and link reports" },
          { href: "/admin/eligibility-queue", title: "Eligibility Queue", desc: "Monitor recompute jobs — pending, processing, failed" },
          { href: "/admin/audit",             title: "Audit Log",         desc: "Append-only record of every admin mutation" },
          { href: "/admin/rbac",              title: "RBAC Manager",      desc: "Manage admin roles and super_admin access" },
          { href: "/admin/ai-policy",         title: "AI Policy",         desc: "Control which actions the AI may take autonomously" },
          { href: "/admin/control-support",  title: "Control Support",   desc: "SLA risk dashboard for backlog, failures, and incident signals" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex flex-col gap-1 px-5 py-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] transition-colors">
            <span className="text-white font-medium text-sm">{item.title}</span>
            <span className="text-white/40 text-xs">{item.desc}</span>
          </Link>
        ))}
      </div>

      {/* Scraper status */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-base font-medium">Scraper status</h2>
          <Link href="/admin/scrape" className="text-[#e8d5a3]/60 text-xs hover:text-[#e8d5a3]">
            Full dashboard →
          </Link>
        </div>
        {runs.length === 0 ? (
          <p className="text-white/30 text-sm">No scrape runs yet. Trigger one from the Scrape Dashboard.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map(run => (
              <div key={run.id} className="flex items-center gap-4 text-sm">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  run.status === "completed" ? "bg-emerald-500" :
                  run.status === "partial"   ? "bg-amber-400" :
                  run.status === "failed"    ? "bg-red-500" : "bg-blue-400"
                }`} />
                <span className="text-white/60 tabular-nums text-xs">
                  {new Date(run.started_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="text-white/40 text-xs">{run.sources_checked ?? 0} sources · {run.items_new ?? 0} new</span>
                <span className={`text-xs ml-auto ${
                  run.status === "completed" ? "text-emerald-400" :
                  run.status === "partial"   ? "text-amber-300" :
                  run.status === "failed"    ? "text-red-400" : "text-blue-400"
                }`}>{run.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eligibility engine */}
      <div className="rounded-xl border border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.03] px-6 py-5">
        <h2 className="text-white text-base font-medium mb-1">Eligibility engine</h2>
        <p className="text-white/40 text-sm mb-4">
          Re-run eligibility checks for all users. Run this after adding or updating any recruitment, post, or criteria.
        </p>
        <form action={adminTriggerEligibilityRecompute}>
          <button type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
            Recompute all eligibility
          </button>
        </form>
      </div>
    </div>
  )
}
// below code is created by `Claude-Code Design` which is to be applied.
/* AdminOverview — app/admin/page.tsx recreation */

// const STATS = [
//   { label: "Organizations",       value: 524 },
//   { label: "Total recruitments",  value: "1,842" },
//   { label: "Open now",            value: 96,   accent: true },
//   { label: "Upcoming",            value: 31 },
//   { label: "Posts defined",       value: "12,406" },
//   { label: "Registered users",    value: "51,290" },
//   { label: "Eligible matches",    value: "8,214", accent: true },
//   { label: "Pending review",      value: 4,    accent: true },
// ];

// const RUNS = [
//   { status: "completed", source: "rbi.org.in/careers",          items: 3,  changed: 0, ts: "12 min ago",  duration: "4.2s" },
//   { status: "partial",   source: "sebi.gov.in/careers",         items: 5,  changed: 2, ts: "1h ago",      duration: "11.8s" },
//   { status: "failed",    source: "upsc.gov.in/notifications",   items: 0,  changed: 0, ts: "2h ago",      duration: "—", err: "HTTP 504 gateway timeout" },
// ];

// function AdminOverview() {
//   return (
//     <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
//       <div>
//         <h1 className="a-serif" style={{ fontSize: 26, margin: "0 0 4px" }}>Admin overview</h1>
//         <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Manage notifications, posts, and eligibility.</p>
//       </div>

//       <div style={{ padding: "10px 16px", borderRadius: 14, background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)", fontSize: 13 }}>
//         Eligibility recompute completed — 8,214 matches updated across 51,290 aspirants.
//       </div>

//       <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
//         {STATS.map(s => (
//           <div key={s.label} className={`a-stat ${s.accent ? "accent" : ""}`}>
//             <div className="lbl">{s.label}</div>
//             <div className="val">{s.value}</div>
//           </div>
//         ))}
//       </div>

//       <div>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
//           <h2 className="a-serif" style={{ fontSize: 16, margin: 0 }}>Quick actions</h2>
//         </div>
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
//           {[
//             { title: "Add recruitment", desc: "Create a notification with posts, criteria, deadlines", icon: "plus" },
//             { title: "Scrape dashboard", desc: "4 items pending review · trigger manual run", icon: "refresh-cw" },
//             { title: "Source registry", desc: "Manage scraping sources, inspect URLs, add portals", icon: "folder-tree" },
//           ].map((a, i) => (
//             <div key={i} className="a-card tight" style={{ cursor: "pointer" }}>
//               <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
//                 <span style={{ color: "var(--gold)", background: "var(--gold-faint)", border: "1px solid var(--gold-border)", width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center" }}><Icon name={a.icon} size={14} /></span>
//                 <span style={{ fontSize: 14, fontWeight: 500 }}>{a.title}</span>
//               </div>
//               <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{a.desc}</p>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="a-card">
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
//           <h2 className="a-serif" style={{ fontSize: 16, margin: 0 }}>Scraper status</h2>
//           <a style={{ fontSize: 12, color: "rgba(232,213,163,0.6)", cursor: "pointer" }}>Full dashboard →</a>
//         </div>
//         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//           {RUNS.map((r, i) => (
//             <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
//               <span style={{ width: 8, height: 8, borderRadius: 9999, background: r.status === "completed" ? "var(--success)" : r.status === "partial" ? "#f59e0b" : "var(--danger)", flexShrink: 0 }} />
//               <span className="a-mono" style={{ fontSize: 12, color: "var(--text-body)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source}</span>
//               <span className="a-mono" style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 90 }}>{r.items} items · {r.changed} changed</span>
//               <span className="a-mono" style={{ fontSize: 11, color: "var(--text-dim)", minWidth: 70 }}>{r.duration}</span>
//               <span className="a-mono" style={{ fontSize: 11, color: "var(--text-dim)", minWidth: 80, textAlign: "right" }}>{r.ts}</span>
//               <Pill tone={r.status === "completed" ? "success" : r.status === "partial" ? "warning" : "danger"}>{r.status}</Pill>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// window.AdminOverview = AdminOverview;

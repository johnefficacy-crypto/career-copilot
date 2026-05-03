import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getUserApplications, STATUS_LABEL, STATUS_ORDER } from "@/lib/db/apply-tracker"
import { updateApplicationStatus } from "@/actions/apply-tracker"
import type { ApplicationStatus, UserApplication } from "@/lib/db/apply-tracker"

export const dynamic = "force-dynamic"
export const metadata = { title: "Application Tracker — Career Copilot" }

const STATUS_STYLE: Record<ApplicationStatus, { dot: string; text: string; bg: string }> = {
  not_started:    { dot: "bg-white/20",    text: "text-white/30",    bg: "bg-white/[0.02]" },
  opened:         { dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-500/[0.05]" },
  in_progress:    { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/[0.05]" },
  submitted:      { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/[0.05]" },
  skipped:        { dot: "bg-white/20",    text: "text-white/25",    bg: "" },
  not_applicable: { dot: "bg-white/15",    text: "text-white/20",    bg: "" },
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  "not_started", "opened", "in_progress", "submitted", "skipped", "not_applicable",
]

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams.catch(() => ({ filter: undefined as string | undefined, success: undefined as string | undefined, error: undefined as string | undefined }))
  const filter = (params.filter ?? "active") as "active" | "submitted" | "all"

  const all = await getUserApplications(user.id)

  const filtered = all.filter(app => {
    if (filter === "submitted") return app.status === "submitted"
    if (filter === "active")
      return ["opened", "in_progress", "not_started"].includes(app.status)
    return !["skipped", "not_applicable"].includes(app.status)
  })

  // Sort by STATUS_ORDER, then by deadline
  const sorted = [...filtered].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status)
    const bi = STATUS_ORDER.indexOf(b.status)
    if (ai !== bi) return ai - bi
    const ad = a.recruitment?.apply_end_date ?? ""
    const bd = b.recruitment?.apply_end_date ?? ""
    return ad.localeCompare(bd)
  })

  const FILTER_TABS = [
    { key: "active",    label: "Active" },
    { key: "submitted", label: "Submitted" },
    { key: "all",       label: "All" },
  ] as const

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-white text-3xl font-medium mt-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Application Tracker
          </h1>
          <p className="text-white/35 text-sm mt-1">
            Track your form status for each exam you plan to apply to.
          </p>
        </div>

        {params.success && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {decodeURIComponent(params.success)}
          </div>
        )}
        {params.error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-xl p-1 mb-6 self-start"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {FILTER_TABS.map(tab => (
            <Link
              key={tab.key}
              href={`/dashboard/tracker?filter=${tab.key}`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filter === tab.key ? "rgba(232,213,163,0.10)" : "transparent",
                color:      filter === tab.key ? "#e8d5a3" : "rgba(255,255,255,0.35)",
                border:     filter === tab.key ? "1px solid rgba(232,213,163,0.25)" : "1px solid transparent",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-8 py-16 text-center">
            <p className="text-white/40 text-base mb-2">No applications tracked yet</p>
            <p className="text-white/25 text-sm mb-6">
              Open an exam you are eligible for and mark your application status.
            </p>
            <Link href="/dashboard/exams"
              className="inline-block px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
              Browse exams
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(app => <ApplicationCard key={app.id} app={app} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ApplicationCard({ app }: { app: UserApplication }) {
  const rec = app.recruitment
  const style = STATUS_STYLE[app.status]
  const deadline = rec?.apply_end_date ?? null
  const left = daysLeft(deadline)
  const isUrgent = left !== null && left >= 0 && left <= 7

  return (
    <div className={`rounded-2xl border border-white/[0.07] p-5 ${style.bg}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/recruitments/${app.recruitment_id}`}
            className="text-white font-medium text-base hover:text-[#e8d5a3] transition-colors truncate block"
          >
            {rec?.name ?? "Unknown exam"}
          </Link>
          {rec?.organization?.name && (
            <p className="text-white/35 text-xs mt-0.5">{rec.organization.name}</p>
          )}
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Deadline */}
      {deadline && (
        <p className={`text-xs mb-3 ${isUrgent ? "text-red-400" : "text-white/30"}`}>
          {left !== null && left < 0
            ? `Deadline passed ${fmt(deadline)}`
            : left === 0
            ? "Deadline today"
            : left !== null
            ? `${left} day${left !== 1 ? "s" : ""} left — ${fmt(deadline)}`
            : `Deadline: ${fmt(deadline)}`}
        </p>
      )}

      {/* App number / notes preview */}
      {app.application_number && (
        <p className="text-xs text-white/40 mb-1">
          App no. <span className="font-mono text-white/60">{app.application_number}</span>
        </p>
      )}
      {app.fee_paid && (
        <p className="text-xs text-white/30 mb-1">
          Fee paid{app.fee_amount ? ` — ₹${app.fee_amount}` : ""}
        </p>
      )}

      {/* Status selector */}
      <form action={updateApplicationStatus} className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
        <input type="hidden" name="recruitment_id" value={app.recruitment_id} />
        <select
          name="status"
          defaultValue={app.status}
          className="text-xs rounded-lg px-2 py-1.5 text-white/70 focus:outline-none flex-1"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            colorScheme: "dark",
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          type="submit"
          className="text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
          style={{ background: "rgba(232,213,163,0.10)", color: "#e8d5a3", border: "1px solid rgba(232,213,163,0.20)" }}
        >
          Update
        </button>
        <Link
          href={`/dashboard/recruitments/${app.recruitment_id}`}
          className="text-xs text-white/25 hover:text-white/60 transition-colors shrink-0"
        >
          Details →
        </Link>
      </form>
    </div>
  )
}

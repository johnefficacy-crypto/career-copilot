import Link from "next/link"
import { listForumReports, type ForumReportRecord, type ForumReportSeverity, type ForumReportStatus } from "@/lib/db/forum-moderation"
import { requireAdminRole } from "@/lib/db/admin"
import { updateForumReportAction } from "@/actions/community-admin"

export const metadata = { title: "Admin Community Moderation — Career Copilot" }

const STATUS_OPTIONS: ForumReportStatus[] = ["open", "in_review", "resolved", "dismissed", "escalated"]
const SEVERITY_OPTIONS: ForumReportSeverity[] = ["p0_harmful", "p1_misleading", "p2_spam_noise"]

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>
}) {
  await requireAdminRole("community")
  const { status = "all", severity = "all" } = await searchParams

  const reports = await listForumReports({
    status: status as ForumReportStatus | "all",
    severity: severity as ForumReportSeverity | "all",
  })

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl text-white mb-2">Community Moderation Queue</h1>
      <p className="text-white/50 text-sm mb-6">Report triage with severity rubric and auditable actions.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <FilterLink label="All" href="/admin/community" active={status === "all" && severity === "all"} />
        <FilterLink label="Open P0" href="/admin/community?status=open&severity=p0_harmful" active={status === "open" && severity === "p0_harmful"} />
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
      </div>
    </div>
  )
}

function ReportRow({ report }: { report: ForumReportRecord }) {
  return (
    <form key={report.id} action={updateForumReportAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <input type="hidden" name="report_id" value={report.id} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-white/40">{report.target_type.toUpperCase()} • {new Date(report.created_at).toLocaleString()}</p>
          <p className="text-white text-sm font-medium">{report.reason}</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full border border-white/15 text-white/70">{report.id.slice(0, 8)}</span>
      </div>

      <p className="text-white/60 text-xs mb-3">{report.details ?? "No additional details."}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <label className="text-xs text-white/60">Status
          <select name="status" defaultValue={report.status} className="w-full mt-1 rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-sm text-white">
            {STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/60">Severity
          <select name="severity" defaultValue={report.severity} className="w-full mt-1 rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-sm text-white">
            {SEVERITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/60">Target
          <div className="mt-1 rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-sm text-white/85">
            {report.target_type === "post" ? report.post?.title ?? "Post" : (report.comment?.body ?? "Comment").slice(0, 72)}
          </div>
        </label>
      </div>

      <label className="text-xs text-white/60 block mb-3">Action notes
        <textarea name="action_notes" defaultValue={report.action_notes ?? ""} rows={2} className="w-full mt-1 rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-sm text-white" />
      </label>

      <button className="px-3 py-1.5 rounded-md bg-[#e8d5a3]/20 border border-[#e8d5a3]/30 text-[#e8d5a3] text-sm hover:bg-[#e8d5a3]/30">Save moderation action</button>
    </form>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className="rounded-lg border px-3 py-2 text-sm" style={{
      borderColor: active ? "rgba(232,213,163,0.5)" : "rgba(255,255,255,0.12)",
      color: active ? "#e8d5a3" : "rgba(255,255,255,0.7)",
      background: active ? "rgba(232,213,163,0.08)" : "transparent",
    }}>{label}</Link>
  )
}

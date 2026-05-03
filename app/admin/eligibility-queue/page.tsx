import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"
import { adminTriggerEligibilityRecompute } from "@/actions/admin"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const metadata = { title: "Eligibility Queue — Admin" }

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  done:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed:     "bg-red-500/10 text-red-400 border-red-500/20",
  skipped:    "bg-white/5 text-white/30 border-white/10",
}

const PAGE_SIZE = 50

async function retryJobAction(formData: FormData) {
  "use server"
  const jobId = formData.get("job_id") as string
  try {
    const ctx = await requireAdminRole("eligibility")
    const supabase = await createClient()
    await supabase
      .from("eligibility_recompute_queue")
      .update({ status: "pending", last_error: null, next_attempt_at: null, claimed_at: null })
      .eq("id", jobId)
    void logAdminAction({
      actorId:    ctx.userId,
      actorEmail: ctx.userEmail,
      action:     "retry_eligibility_job",
      entityType: "eligibility_recompute_queue",
      entityId:   jobId,
    })
    revalidatePath("/admin/eligibility-queue")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error"
    redirect(`/admin/eligibility-queue?error=${encodeURIComponent(msg)}`)
  }
  redirect("/admin/eligibility-queue")
}

export default async function EligibilityQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("eligibility") } catch { redirect("/dashboard") }

  const sp      = await searchParams
  const status  = sp.status ?? ""
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const from    = (pageNum - 1) * PAGE_SIZE
  const to      = from + PAGE_SIZE - 1

  // Stats
  const statsResult = await supabase.rpc("get_eligibility_queue_stats").maybeSingle()
  const stats = statsResult.data

  // Counts per status
  const statusCountsRes = await supabase
    .from("eligibility_recompute_queue")
    .select("status")
  const counts = (statusCountsRes.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  // Paginated rows
  let q = supabase
    .from("eligibility_recompute_queue")
    .select("id, user_id, recruitment_id, status, attempt_count, last_error, claimed_at, next_attempt_at, queued_at", { count: "exact" })
    .order("queued_at", { ascending: false })
    .range(from, to)
  if (status) q = q.eq("status", status)

  const { data: jobs, count } = await q
  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const TABS = ["", "pending", "processing", "done", "failed", "skipped"]

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Eligibility queue
          </h1>
          <p className="text-white/40 text-sm mt-0.5">{total} jobs · recompute backlog</p>
        </div>
        <form action={adminTriggerEligibilityRecompute}>
          <button type="submit"
            className="px-4 py-2 rounded-xl border border-[#e8d5a3]/20 text-[#e8d5a3]/60 text-sm hover:text-[#e8d5a3] hover:border-[#e8d5a3]/40 transition-colors">
            ↻ Recompute all
          </button>
        </form>
      </div>

      {sp.error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {(["pending", "processing", "done", "failed", "skipped"] as const).map((s) => (
          <Link key={s} href={`/admin/eligibility-queue?status=${s}`}
            className={`rounded-xl border px-4 py-3 text-center transition-colors ${
              status === s ? "border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.04]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]"
            }`}>
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">{s}</p>
            <p className={`text-xl font-light ${s === "failed" && (counts[s] ?? 0) > 0 ? "text-red-400" : "text-white"}`}>
              {counts[s] ?? 0}
            </p>
          </Link>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <Link key={t || "all"} href={t ? `/admin/eligibility-queue?status=${t}` : "/admin/eligibility-queue"}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              status === t ? "border-[#e8d5a3]/30 bg-[#e8d5a3]/[0.06] text-[#e8d5a3]" : "border-white/[0.08] text-white/40 hover:text-white/70"
            }`}>
            {t || "All"}
          </Link>
        ))}
      </div>

      {/* Jobs table */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-6">
        {(jobs ?? []).length === 0 ? (
          <p className="text-white/30 text-sm px-5 py-10 text-center">No jobs found.</p>
        ) : (
          (jobs ?? []).map((job) => (
            <div key={job.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[job.status] ?? STATUS_STYLES.pending}`}>
                {job.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs font-mono truncate">user: {job.user_id?.slice(0, 12)}…</p>
                {job.last_error && (
                  <p className="text-red-400/70 text-[10px] truncate mt-0.5">{job.last_error}</p>
                )}
              </div>
              <span className="text-white/20 text-xs tabular-nums shrink-0">
                {job.attempt_count > 0 ? `${job.attempt_count} attempt${job.attempt_count > 1 ? "s" : ""}` : ""}
              </span>
              <span className="text-white/25 text-xs tabular-nums shrink-0 font-mono">
                {new Date(job.queued_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </span>
              {job.status === "failed" && (
                <form action={retryJobAction}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <button type="submit"
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-amber-500/25 text-amber-400/70 hover:text-amber-400 transition-colors">
                    Retry
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">Page {pageNum} of {totalPages}</span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link href={`/admin/eligibility-queue?page=${pageNum - 1}${status ? `&status=${status}` : ""}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 transition-colors">
                ← Prev
              </Link>
            )}
            {pageNum < totalPages && (
              <Link href={`/admin/eligibility-queue?page=${pageNum + 1}${status ? `&status=${status}` : ""}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 transition-colors">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

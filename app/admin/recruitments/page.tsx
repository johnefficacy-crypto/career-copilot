/**
 * app/admin/recruitments/page.tsx
 *
 * Shows all promoteds recruitments — manually added AND promoted from scrape queue.
 * Scrape-sourced items are identified by joining scrape_queue.duplicate_of = recruitments.id
 * and shown with a "via scraper" badge + confidence/quality scores.
 */

import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getRecruitmentsAdminPaginated, getAllRecruitmentsAdmin, requireAdminRole } from "@/lib/db/admin"
import { formatDate, daysUntil } from "@/lib/utils/dates"
import { adminDeleteRecruitment } from "@/actions/admin"
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton"
import { redirect } from "next/navigation"

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  open:     { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",  dot: "#4ade80" },
  upcoming: { badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",           dot: "#60a5fa" },
  closed:   { badge: "bg-white/5 text-white/30 border-white/10",                  dot: "#ffffff30" },
  draft:    { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",         dot: "#fbbf24" },
}

type Recruitment = Awaited<ReturnType<typeof getAllRecruitmentsAdmin>>[number]

type ScrapeOrigin = {
  recruitment_id: string
  source_name: string | null
  source_url: string | null
  confidence_score: number | null
  data_quality_score: number | null
  scraped_at: string | null
  reviewed_at: string | null
}

export const dynamic = "force-dynamic"

const PAGE_SIZE = 30

export default async function AdminRecruitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("recruitments") } catch { redirect("/dashboard") }

  const params   = await searchParams.catch(() => ({ page: undefined }))
  const pageNum  = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  let recruitments: Recruitment[] = []
  let total      = 0
  let totalPages = 1
  let fetchError: string | null = null
  const scrapeOrigins: Map<string, ScrapeOrigin> = new Map()

  try {
    const result = await getRecruitmentsAdminPaginated(pageNum, PAGE_SIZE)
    recruitments = result.rows as Recruitment[]
    total        = result.total
    totalPages   = result.totalPages

    if (recruitments.length > 0) {
      const { data: queueRows } = await supabase
        .from("scrape_queue")
        .select("duplicate_of, source_name, source_url, confidence_score, data_quality_score, scraped_at, reviewed_at")
        .eq("status", "approved")
        .not("duplicate_of", "is", null)

      for (const row of queueRows ?? []) {
        if (row.duplicate_of) {
          scrapeOrigins.set(row.duplicate_of, {
            recruitment_id:     row.duplicate_of,
            source_name:        row.source_name,
            source_url:         row.source_url,
            confidence_score:   row.confidence_score,
            data_quality_score: row.data_quality_score,
            scraped_at:         row.scraped_at,
            reviewed_at:        row.reviewed_at,
          })
        }
      }
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load recruitments"
  }

  const scraped  = recruitments.filter(r => scrapeOrigins.has(r.id))
  const manual   = recruitments.filter(r => !scrapeOrigins.has(r.id))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Recruitments
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {total} total · {scraped.length} from scraper · {manual.length} manual
            {totalPages > 1 && ` · page ${pageNum}/${totalPages}`}
          </p>
        </div>
        <Link
          href="/admin/recruitments/new"
          className="px-4 py-2 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
        >
          + Add recruitment
        </Link>
      </div>

      {fetchError && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {fetchError}
        </div>
      )}

      {recruitments.length === 0 && !fetchError && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-3xl mb-3 opacity-20">🏛️</p>
          <p className="text-white/50 text-sm mb-1">No recruitments yet.</p>
          <p className="text-white/25 text-xs mb-4">
            Approve items from the{" "}
            <Link href="/admin/scrape" className="text-[#e8d5a3]/50 hover:text-[#e8d5a3] underline">
              Scrape Queue
            </Link>{" "}
            to populate this list automatically.
          </p>
          <Link href="/admin/recruitments/new" className="text-[#e8d5a3]/60 text-sm hover:text-[#e8d5a3]">
            Or add manually →
          </Link>
        </div>
      )}

      {/* ── Scraper-sourced recruitments ─────────────────────────────────── */}
      {scraped.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-widest text-white/30">🤖 Via scraper</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#e8d5a3]/8 border border-[#e8d5a3]/15 text-[#e8d5a3]/50">
              {scraped.length} admin-verified
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {scraped.map((rec) => {
              const origin = scrapeOrigins.get(rec.id)!
              return <RecruitmentRow key={rec.id} rec={rec} origin={origin} />
            })}
          </div>
        </section>
      )}

      {/* ── Manually added recruitments ──────────────────────────────────── */}
      {manual.length > 0 && (
        <section>
          {scraped.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-widest text-white/30">✍️ Manually added</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {manual.map((rec) => (
              <RecruitmentRow key={rec.id} rec={rec} origin={null} />
            ))}
          </div>
        </section>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 mt-4 border-t border-white/[0.06]">
          <span className="text-xs text-white/30">
            Page {pageNum} of {totalPages} · {total} recruitments total
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`/admin/recruitments?page=${pageNum - 1}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
              >
                ← Prev
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`/admin/recruitments?page=${pageNum + 1}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RecruitmentRow({
  rec,
  origin,
}: {
  rec: Recruitment
  origin: ScrapeOrigin | null
}) {
  const daysLeft   = rec.apply_end_date ? daysUntil(rec.apply_end_date) : null
  const postCount  = rec.posts?.length ?? 0
  const style      = STATUS_STYLES[rec.status ?? "upcoming"] ?? STATUS_STYLES.upcoming

  const confPct  = origin ? Math.round((origin.confidence_score ?? 0) * 100) : null
  const qualPct  = origin?.data_quality_score ?? null
  const confColor = confPct !== null
    ? confPct >= 80 ? "#4ade80" : confPct >= 60 ? "#fbbf24" : "#f87171"
    : null
  const qualColor = qualPct !== null
    ? qualPct >= 80 ? "#4ade80" : qualPct >= 50 ? "#fbbf24" : "#f87171"
    : null

  return (
    <div className="flex items-start gap-4 px-5 py-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] transition-colors">

      {/* Status dot */}
      <div className="pt-1 shrink-0">
        <span className="block w-2 h-2 rounded-full" style={{ background: style.dot }} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-white/30 text-xs">{rec.organizations?.type ?? "—"}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/30 text-xs">{rec.year}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/30 text-xs">{postCount} post{postCount !== 1 ? "s" : ""}</span>
          {origin && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <a
                href={origin.source_url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#e8d5a3]/40 hover:text-[#e8d5a3]/70 transition-colors"
                title={origin.source_url ?? undefined}
              >
                {origin.source_name ?? "scraper"} ↗
              </a>
            </>
          )}
        </div>

        <p className="text-white text-sm font-medium mb-0.5">{rec.name}</p>
        <p className="text-white/35 text-xs">{rec.organizations?.name}</p>

        {/* Scrape quality bars */}
        {origin && (
          <div className="flex items-center gap-4 mt-2">
            {confPct !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/25">confidence</span>
                <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${confPct}%`, background: confColor ?? "#fff" }} />
                </div>
                <span className="text-[10px] font-mono" style={{ color: confColor ?? "#fff" }}>{confPct}%</span>
              </div>
            )}
            {qualPct !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/25">quality</span>
                <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${qualPct}%`, background: qualColor ?? "#fff" }} />
                </div>
                <span className="text-[10px] font-mono" style={{ color: qualColor ?? "#fff" }}>{qualPct}</span>
              </div>
            )}
            {origin.reviewed_at && (
              <span className="text-[10px] text-white/20">
                reviewed {new Date(origin.reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Deadline */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-white/30 text-[10px] uppercase tracking-wide mb-0.5">Apply by</p>
        <p className={`text-xs font-mono tabular-nums ${
          daysLeft !== null && daysLeft >= 0 && daysLeft <= 7  ? "text-red-400" :
          daysLeft !== null && daysLeft >= 0 && daysLeft <= 21 ? "text-amber-300" :
          "text-white/40"
        }`}>
          {daysLeft !== null && daysLeft >= 0
            ? `${daysLeft}d left`
            : rec.apply_end_date
              ? formatDate(rec.apply_end_date)
              : "—"}
        </p>
      </div>

      {/* Status badge */}
      <span className={`shrink-0 border text-xs px-2.5 py-1 rounded-full ${style.badge}`}>
        {rec.status}
      </span>

      {/* Publish status badge */}
      {(() => {
        const ps = (rec as { publish_status?: string }).publish_status
        if (!ps || ps === "draft") return null
        const psStyles: Record<string, string> = {
          needs_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          verified:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
          published:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          withdrawn:    "bg-red-500/10 text-red-400 border-red-500/20",
          archived:     "bg-white/5 text-white/20 border-white/10",
        }
        return (
          <span className={`shrink-0 border text-[10px] px-2 py-0.5 rounded-full ${psStyles[ps] ?? ""}`}>
            {ps.replace("_", " ")}
          </span>
        )
      })()}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/admin/recruitments/${rec.id}`}
          className="text-white/40 text-xs hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/[0.05]"
        >
          Edit
        </Link>
        <DeleteConfirmButton
          action={adminDeleteRecruitment}
          message={`Delete "${rec.name}"? This will also delete all posts and criteria.`}
          fields={{ id: rec.id }}
          label="✕"
        />
      </div>
    </div>
  )
}

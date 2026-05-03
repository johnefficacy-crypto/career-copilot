/**
 * EligibleRecruitmentsWidget
 *
 * Renders the top N recruitments the user is eligible (or conditionally
 * eligible) for on the main dashboard. Closes the UX gap where the
 * /dashboard page previously had no surface for the eligibility engine's
 * output — users had to navigate to /dashboard/exams to see matches.
 *
 * Data comes from getEligibleRecruitments() in lib/eligibility/runner.ts.
 * Posts from the same recruitment are deduped to a single card; the
 * "X matching posts" badge shows how many posts contributed.
 *
 * Clicking "View all" takes the user to /dashboard/exams where the full
 * list + search + filters live. Each card links to the official notification
 * page via the Browse Exams filter (no per-recruitment detail page yet).
 */
import Link from "next/link"
import { daysUntil, formatDate, getDeadlineUrgency } from "@/lib/utils/dates"

type Urgency = "safe" | "warning" | "danger" | "expired" | "unknown"

type EligibleRow = {
  post_id:         string
  recruitment_id:  string
  is_eligible:     boolean | null
  is_conditional:  boolean | null
  // Supabase returns joined tables as either object or array — handle both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posts:           any
}

interface Props {
  rows: EligibleRow[]
  limit?: number
}

const URGENCY_BADGE: Record<Urgency, string> = {
  safe:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  danger:  "bg-red-500/10 text-red-400 border-red-500/20",
  expired: "bg-white/5 text-white/40 border-white/10",
  unknown: "bg-white/5 text-white/40 border-white/10",
}

const URGENCY_LABEL: Record<Urgency, string> = {
  safe:    "Open",
  warning: "Closing soon",
  danger:  "Urgent",
  expired: "Closed",
  unknown: "Open",
}

type RecruitmentView = {
  recruitment_id:    string
  name:              string
  org_name:          string | null
  org_type:          string | null
  apply_end_date:    string | null
  status:            string | null
  matching_posts:    number
  is_conditional:    boolean
}

function unwrapJoin<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export function EligibleRecruitmentsWidget({ rows, limit = 5 }: Props) {
  // Group by recruitment_id — one card per recruitment even if user matches
  // multiple posts. Track whether ANY match was strictly eligible (is_eligible)
  // vs only conditional, so the card badge reflects the best status.
  const byId = new Map<string, RecruitmentView>()
  for (const r of rows) {
    const post = unwrapJoin<{ recruitments?: unknown }>(r.posts)
    const rec  = unwrapJoin<{
      name?: string
      apply_end_date?: string | null
      status?: string | null
      organizations?: unknown
    }>(post?.recruitments as never)
    if (!rec?.name) continue
    const org = unwrapJoin<{ name?: string; type?: string }>(rec.organizations as never)

    const prev = byId.get(r.recruitment_id)
    if (prev) {
      prev.matching_posts += 1
      if (r.is_eligible) prev.is_conditional = false
    } else {
      byId.set(r.recruitment_id, {
        recruitment_id: r.recruitment_id,
        name:           rec.name,
        org_name:       org?.name ?? null,
        org_type:       org?.type ?? null,
        apply_end_date: rec.apply_end_date ?? null,
        status:         rec.status ?? null,
        matching_posts: 1,
        is_conditional: !r.is_eligible && !!r.is_conditional,
      })
    }
  }

  // Sort: soonest deadline first, nulls last; eligible before conditional
  const items = Array.from(byId.values()).sort((a, b) => {
    if (a.is_conditional !== b.is_conditional) return a.is_conditional ? 1 : -1
    if (a.apply_end_date && b.apply_end_date) return a.apply_end_date.localeCompare(b.apply_end_date)
    if (a.apply_end_date && !b.apply_end_date) return -1
    if (!a.apply_end_date && b.apply_end_date) return 1
    return 0
  })

  const shown  = items.slice(0, limit)
  const hidden = Math.max(0, items.length - shown.length)

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/40 uppercase tracking-widest text-xs">
          Matched for you
        </p>
        <Link
          href="/dashboard/exams"
          className="text-xs text-[#e8d5a3] hover:text-[#f0e0b8] transition-colors"
        >
          View all →
        </Link>
      </div>

      {shown.length === 0 ? (
        <div>
          <p className="text-white/60 text-base mb-1">No matches yet.</p>
          <p className="text-white/30 text-sm">
            Once new recruitments are published, we&apos;ll evaluate them against your profile
            and the eligible ones will appear here.
          </p>
          <Link
            href="/dashboard/exams"
            className="mt-4 inline-flex items-center gap-2 bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3] text-sm px-4 py-2 rounded-lg hover:bg-[#e8d5a3]/15 transition-colors"
          >
            Browse open exams
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((it) => {
            // Guard null apply_end_date — many scraper extractions come back
            // without a deadline; render those as "Open" with no countdown.
            const daysLeft: number | null =
              it.apply_end_date ? daysUntil(it.apply_end_date) : null
            const urgency: Urgency =
              it.apply_end_date ? getDeadlineUrgency(it.apply_end_date) : "unknown"
            const badge = URGENCY_BADGE[urgency]
            const label = URGENCY_LABEL[urgency]

            return (
              <Link
                key={it.recruitment_id}
                href={`/dashboard/exams?q=${encodeURIComponent(it.name.split(" ").slice(0, 3).join(" "))}`}
                className="block border border-white/[0.07] rounded-xl p-4 hover:border-white/[0.14] hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {it.org_type && <span className="text-white/40 text-xs">{it.org_type}</span>}
                      {it.is_conditional && (
                        <>
                          <span className="text-white/20">·</span>
                          <span className="text-amber-300/80 text-xs">Conditional</span>
                        </>
                      )}
                      {it.matching_posts > 1 && (
                        <>
                          <span className="text-white/20">·</span>
                          <span className="text-white/40 text-xs">
                            {it.matching_posts} matching posts
                          </span>
                        </>
                      )}
                    </div>
                    <h3
                      className="text-white text-sm font-medium leading-snug truncate"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {it.name}
                    </h3>
                    {it.org_name && (
                      <p className="text-white/40 text-xs mt-0.5 truncate">{it.org_name}</p>
                    )}
                  </div>

                  <span className={`shrink-0 border text-xs px-2.5 py-1 rounded-full ${badge}`}>
                    {urgency === "expired"
                      ? "Closed"
                      : daysLeft !== null && daysLeft >= 0
                      ? `${daysLeft}d left`
                      : label}
                  </span>
                </div>

                {it.apply_end_date && (
                  <p className="text-white/40 text-xs">
                    Apply by <span className="text-white/60">{formatDate(it.apply_end_date)}</span>
                  </p>
                )}
              </Link>
            )
          })}

          {hidden > 0 && (
            <p className="text-white/30 text-xs mt-1 text-center">
              +{hidden} more eligible recruitments
            </p>
          )}
        </div>
      )}
    </div>
  )
}

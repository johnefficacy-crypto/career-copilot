/**
 * app/dashboard/recruitments/[id]/page.tsx
 *
 * Minimal recruitment detail page.
 *
 * Phase 3B follow-up (P0 — April 19 code review fix):
 *   NotificationsFeed and the dashboard alert list both link to
 *   /dashboard/recruitments/<id>. That route was a 404 before this file
 *   existed — every "new match" notification deadened into a broken link.
 *   This page renders the canonical detail view so the alerts have a real
 *   destination.
 *
 * What it shows:
 *   - Recruitment name + organisation + status
 *   - Apply window (start / end / days left)
 *   - Official notification URL (external)
 *   - The user's own eligibility verdict per post, with fail_reasons
 *     pulled from the authoritative eligibility engine's cache
 *     (eligibility_results)
 *   - Track / untrack toggle (server action)
 *
 * Kept deliberately simple — the full detail page with salary tables,
 * vacancies breakdown, syllabus, and apply-tracker is Phase 4 work.
 */

import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { trackRecruitmentAction, untrackRecruitmentAction } from "@/actions/notifications"
import { Timeline } from "@/components/recruitments/Timeline"
import { getApplication, STATUS_LABEL } from "@/lib/db/apply-tracker"
import { updateApplicationStatus } from "@/actions/apply-tracker"
import type { ApplicationStatus } from "@/lib/db/apply-tracker"

export const revalidate = 30
export const metadata = { title: "Recruitment — Career Copilot" }

// Match the runtime shape of Next 16 App Router dynamic params
interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function daysUntil(d: string | null): number | null {
  if (!d) return null
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

export default async function RecruitmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // ── Load recruitment + nested org + posts ─────────────────────────────
  const { data: recruitment, error: recErr } = await supabase
    .from("recruitments")
    .select(`
      id,
      name,
      year,
      status,
      notification_date,
      apply_start_date,
      apply_end_date,
      official_notification_url,
      total_vacancies,
      organizations ( id, name, type, state ),
      posts (
        id,
        post_name,
        group_type,
        pay_level
      )
    `)
    .eq("id", id)
    .maybeSingle()

  if (recErr || !recruitment) notFound()

  // ── Load this user's cached eligibility for every post ───────────────
  const [elRes, trackedRes, appRes] = await Promise.all([
    supabase
      .from("eligibility_results")
      .select("post_id, is_eligible, is_conditional, fail_reasons")
      .eq("user_id", user.id)
      .eq("recruitment_id", id),
    supabase
      .from("tracked_recruitments")
      .select("recruitment_id")
      .eq("user_id", user.id)
      .eq("recruitment_id", id)
      .maybeSingle(),
    getApplication(user.id, id).catch(() => null),
  ])

  const isTracked  = !!trackedRes.data
  const appStatus  = (appRes?.status ?? "not_started") as ApplicationStatus

  const verdictByPost = new Map(
    (elRes.data ?? []).map((r) => [
      r.post_id as string,
      {
        is_eligible: r.is_eligible as boolean,
        is_conditional: r.is_conditional as boolean,
        fail_reasons: (r.fail_reasons ?? []) as string[],
      },
    ]),
  )

  const org = Array.isArray(recruitment.organizations)
    ? recruitment.organizations[0]
    : recruitment.organizations
  const posts = (recruitment.posts ?? []) as Array<{
    id: string
    post_name: string | null
    group_type: string | null
    pay_level: string | null
  }>

  const deadlineDays = daysUntil(recruitment.apply_end_date as string | null)

  // Aggregate verdict across all posts for the headline card.
  let anyEligible = false
  let anyConditional = false
  for (const p of posts) {
    const v = verdictByPost.get(p.id)
    if (!v) continue
    if (v.is_eligible) anyEligible = true
    else if (v.is_conditional) anyConditional = true
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white/85">
      {/* Header bar */}
      <div className="border-b border-white/[0.06] sticky top-0 z-30 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-white/30 text-sm hover:text-white/60 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-white/10">/</span>
          <span className="text-white/60 text-sm truncate">
            {recruitment.name}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Title card */}
        <div>
          <h1 className="font-serif text-2xl text-white font-medium mb-1">
            {recruitment.name}
          </h1>
          <p className="text-sm text-white/40">
            {org?.name ?? "Organisation"}
            {org?.type ? <span> · {org.type}</span> : null}
            {org?.state ? <span> · {org.state}</span> : null}
            {recruitment.year ? <span> · {recruitment.year}</span> : null}
          </p>
        </div>

        {/* Eligibility verdict */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: anyEligible
              ? "rgba(134,239,172,0.35)"
              : anyConditional
                ? "rgba(250,204,21,0.30)"
                : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-xs uppercase tracking-wider text-white/40 mb-1">
            Your eligibility
          </div>
          <div className="text-sm">
            {anyEligible ? (
              <span className="text-emerald-300">
                You are eligible for at least one post in this recruitment.
              </span>
            ) : anyConditional ? (
              <span className="text-amber-300">
                Conditionally eligible — you meet some criteria, final check
                depends on unverified data (e.g. education completion).
              </span>
            ) : verdictByPost.size === 0 ? (
              <span className="text-white/50">
                Not yet evaluated. Your eligibility is recomputed automatically
                after any profile update.
              </span>
            ) : (
              <span className="text-white/55">
                You are not eligible for any post in this recruitment. See
                reasons below.
              </span>
            )}
          </div>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-1">
              Notification
            </div>
            <div className="text-sm">
              {formatDate(recruitment.notification_date as string | null)}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-1">
              Apply from
            </div>
            <div className="text-sm">
              {formatDate(recruitment.apply_start_date as string | null)}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-1">
              Apply by
            </div>
            <div className="text-sm">
              {formatDate(recruitment.apply_end_date as string | null)}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/35 mb-1">
              Status
            </div>
            <div className="text-sm">
              {recruitment.status ?? "—"}
              {deadlineDays !== null && deadlineDays >= 0 && (
                <span className="ml-1 text-white/40">
                  ({deadlineDays}d left)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Application tracker CTA */}
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Application status</p>
              <p className="text-sm font-medium text-white/80">{STATUS_LABEL[appStatus]}</p>
            </div>
            <Link href="/dashboard/tracker" className="text-xs text-[#e8d5a3]/50 hover:text-[#e8d5a3] transition-colors">
              View tracker →
            </Link>
          </div>
          <form action={updateApplicationStatus} className="flex items-center gap-2">
            <input type="hidden" name="recruitment_id" value={id} />
            <select
              name="status"
              defaultValue={appStatus}
              className="text-xs rounded-lg px-2 py-1.5 text-white/70 flex-1 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", colorScheme: "dark" }}
            >
              {(["not_started","opened","in_progress","submitted","skipped","not_applicable"] as ApplicationStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
              style={{ background: "rgba(232,213,163,0.10)", color: "#e8d5a3", border: "1px solid rgba(232,213,163,0.20)" }}
            >
              Save
            </button>
          </form>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {recruitment.official_notification_url && (
            <a
              href={recruitment.official_notification_url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-sm transition-colors"
              style={{
                background: "rgba(232,213,163,0.12)",
                color: "#e8d5a3",
                border: "1px solid rgba(232,213,163,0.25)",
              }}
            >
              Read official notification ↗
            </a>
          )}

          <form
            action={async () => {
              "use server"
              if (isTracked) {
                await untrackRecruitmentAction(id)
              } else {
                await trackRecruitmentAction(id)
              }
            }}
          >
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm transition-colors"
              style={{
                background: isTracked
                  ? "rgba(232,213,163,0.16)"
                  : "rgba(255,255,255,0.04)",
                color: isTracked ? "#e8d5a3" : "rgba(255,255,255,0.65)",
                border: `1px solid ${isTracked ? "rgba(232,213,163,0.30)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {isTracked ? "★ Tracking" : "☆ Track"}
            </button>
          </form>
        </div>

        {/* Timeline */}
        <div
          className="rounded-2xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <Timeline
            notificationDate={recruitment.notification_date as string | null}
            applyStartDate={recruitment.apply_start_date as string | null}
            applyEndDate={recruitment.apply_end_date as string | null}
          />
        </div>

        {/* Posts */}
        <div>
          <h2 className="text-sm font-medium text-white/70 mb-3">
            Posts ({posts.length})
          </h2>
          {posts.length === 0 ? (
            <div className="text-sm text-white/35">
              No posts listed for this recruitment yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {posts.map((p) => {
                const v = verdictByPost.get(p.id)
                const tone = !v
                  ? { label: "Pending", fg: "rgba(255,255,255,0.45)", bg: "rgba(255,255,255,0.03)" }
                  : v.is_eligible
                    ? { label: "Eligible", fg: "#86efac", bg: "rgba(134,239,172,0.08)" }
                    : v.is_conditional
                      ? { label: "Conditional", fg: "#fde68a", bg: "rgba(250,204,21,0.08)" }
                      : { label: "Not eligible", fg: "#f87171", bg: "rgba(248,113,113,0.06)" }

                return (
                  <li
                    key={p.id}
                    className="rounded-xl border border-white/[0.06] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white/85 truncate">
                          {p.post_name ?? "Untitled post"}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">
                          {p.group_type ? <span>{p.group_type}</span> : null}
                          {p.pay_level ? <span> · Pay {p.pay_level}</span> : null}
                        </div>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: tone.fg, background: tone.bg }}
                      >
                        {tone.label}
                      </span>
                    </div>

                    {v && v.fail_reasons.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {v.fail_reasons.map((r, i) => (
                          <li
                            key={`${p.id}-reason-${i}`}
                            className="text-xs text-white/50"
                          >
                            · {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getUserMockTests, getMockTestStats } from "@/lib/db/mock-tests"
import { MockTestForm } from "@/components/study-plan/MockTestForm"
import { deleteMockTestAction } from "@/actions/mock-tests"

export const dynamic = "force-dynamic"
export const metadata = { title: "Mock Tests — Career Copilot" }

function ScoreBadge({ score, total }: { score: number | null; total: number | null }) {
  if (score == null || total == null || total === 0) return <span className="text-white/25">—</span>
  const pct = Math.round((score / total) * 100)
  const color = pct >= 70 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171"
  return (
    <span className="font-mono tabular-nums text-sm" style={{ color }}>
      {score}/{total} <span className="text-[10px]">({pct}%)</span>
    </span>
  )
}

export default async function MockTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; add?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const params  = await searchParams
  const planId  = params.plan
  const showAdd = params.add === "1"

  const [tests, stats] = await Promise.all([
    getUserMockTests(user.id, planId),
    getMockTestStats(user.id, planId),
  ])

  const trendColor = stats.trend === "improving" ? "#4ade80" : stats.trend === "declining" ? "#f87171" : "#fbbf24"
  const trendLabel = stats.trend === "improving" ? "↑ Improving" : stats.trend === "declining" ? "↓ Declining" : "→ Stable"

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard/study-plan" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
          ← Study plans
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-white text-3xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Mock test tracker
            </h1>
            <p className="text-white/35 text-sm mt-1">
              Log your mock tests and track performance over time.
            </p>
          </div>
          <Link
            href={`/dashboard/study-plan/mock-tests?${planId ? `plan=${planId}&` : ""}add=1`}
            className="shrink-0 px-4 py-2 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
          >
            + Log test
          </Link>
        </div>

        {/* Stats row */}
        {stats.totalAttempts > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Attempts",   val: String(stats.totalAttempts) },
              { label: "Avg score",  val: stats.avgScore != null ? `${stats.avgScore}%` : "—" },
              { label: "Best score", val: stats.bestScore != null ? `${stats.bestScore}%` : "—" },
              { label: "Percentile", val: stats.avgPercentile != null ? `${stats.avgPercentile}` : "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-white text-xl font-light tabular-nums">{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {stats.trend && (
          <div className="mb-6 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] inline-flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: trendColor }}>{trendLabel}</span>
            <span className="text-white/25 text-xs">based on last 3 tests</span>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="mb-8">
            <MockTestForm planId={planId} />
          </div>
        )}

        {/* Test list */}
        {tests.length === 0 && !showAdd ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-3xl mb-3 opacity-20">📝</p>
            <p className="text-white/50 text-sm mb-1">No mock tests logged yet.</p>
            <p className="text-white/25 text-xs mb-4">
              Log your first test to start tracking your performance.
            </p>
            <Link
              href={`/dashboard/study-plan/mock-tests?${planId ? `plan=${planId}&` : ""}add=1`}
              className="text-[#e8d5a3]/60 text-sm hover:text-[#e8d5a3]"
            >
              Log your first test →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tests.map((test) => (
              <div
                key={test.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-white/30 text-xs">
                        {new Date(test.attempted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {test.percentile != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e8d5a3]/8 border border-[#e8d5a3]/15 text-[#e8d5a3]/60">
                          {test.percentile}ile
                        </span>
                      )}
                      {test.rank_in_series != null && (
                        <span className="text-white/20 text-xs">Rank #{test.rank_in_series}</span>
                      )}
                    </div>

                    <p className="text-white text-sm font-medium">
                      {test.test_name ?? test.exam_name}
                    </p>

                    <div className="flex items-center gap-3 mt-1">
                      <ScoreBadge score={test.scored_marks} total={test.total_marks} />
                      {test.total_questions != null && (
                        <span className="text-white/30 text-xs">
                          {test.attempted_questions ?? "?"}/{test.total_questions} attempted
                        </span>
                      )}
                      {test.duration_mins != null && (
                        <span className="text-white/25 text-xs">{test.duration_mins}m</span>
                      )}
                    </div>

                    {/* Subject breakdowns */}
                    {test.breakdowns && test.breakdowns.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {test.breakdowns.map((b) => {
                          const pct = b.scored_marks != null && b.total_marks && b.total_marks > 0
                            ? Math.round((b.scored_marks / b.total_marks) * 100)
                            : null
                          const c = pct != null ? (pct >= 70 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171") : "#ffffff40"
                          return (
                            <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] text-white/40">
                              {b.subject}
                              {pct != null && <span style={{ color: c }}> {pct}%</span>}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {test.notes && (
                      <p className="text-white/25 text-xs mt-2 line-clamp-1">{test.notes}</p>
                    )}
                  </div>

                  <form action={deleteMockTestAction as unknown as (fd: FormData) => Promise<void>}>
                    <input type="hidden" name="id" value={test.id} />
                    <button
                      type="submit"
                      className="text-white/20 text-xs hover:text-red-400 transition-colors px-2 py-1"
                      title="Delete this test"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

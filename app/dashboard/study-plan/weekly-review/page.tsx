import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getPlanWithWeeks, getPlanStats, getStudyLogs } from "@/lib/db/study-planner"
import { getUserMockTests, getMockTestStats } from "@/lib/db/mock-tests"

export const dynamic = "force-dynamic"
export const metadata = { title: "Weekly Review — Career Copilot" }

function ProgressBar({ value, max, color = "#e8d5a3" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums font-mono" style={{ color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

export default async function WeeklyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const params = await searchParams
  const planId = params.plan

  // Load all plans to let user pick
  const { data: allPlans } = await supabase
    .from("study_plans")
    .select("id, exam_name, status, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const activePlanId = planId ?? (allPlans?.[0]?.id ?? null)

  const [plan, stats, logs, mockTests, mockStats] = await Promise.all([
    activePlanId ? getPlanWithWeeks(activePlanId, user.id) : null,
    activePlanId ? getPlanStats(activePlanId, user.id) : null,
    activePlanId ? getStudyLogs(user.id, activePlanId, 7) : [],
    activePlanId ? getUserMockTests(user.id, activePlanId) : getUserMockTests(user.id),
    getMockTestStats(user.id, activePlanId ?? undefined),
  ])

  // Study session stats for last 7 days
  const now   = new Date()
  const week0 = new Date(now); week0.setDate(now.getDate() - 7)

  const recentLogs = (logs as Array<{ duration_mins?: number; subject?: string; started_at: string }>)
    .filter((l) => new Date(l.started_at) >= week0)

  const totalMinsThisWeek = recentLogs.reduce((sum, l) => sum + (l.duration_mins ?? 0), 0)
  const sessionCount      = recentLogs.length

  // Subject breakdown from sessions
  const subjectMap = recentLogs.reduce<Record<string, number>>((acc, l) => {
    const s = l.subject ?? "General"
    acc[s] = (acc[s] ?? 0) + (l.duration_mins ?? 0)
    return acc
  }, {})
  const topSubjects = Object.entries(subjectMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Recent mock tests (this week)
  const recentMocks = mockTests.filter((m) => new Date(m.attempted_at) >= week0)

  // Weekly tasks completion
  const weeks = plan?.study_weeks ?? []
  const currentWeek = weeks.find((w) => w.status === "in_progress")
    ?? weeks.find((w) => w.status === "pending")

  const weekLabel = currentWeek
    ? `Week ${(currentWeek as { week_number?: number }).week_number ?? ""}: ${(currentWeek as { theme?: string }).theme ?? ""}`
    : "No active week"

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard/study-plan" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
          ← Study plans
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-white text-3xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Weekly review
            </h1>
            <p className="text-white/35 text-sm mt-1">Last 7 days · {weekLabel}</p>
          </div>
          {allPlans && allPlans.length > 1 && (
            <form method="get">
              <select name="plan" defaultValue={activePlanId ?? ""}
                onChange={(e) => { if (typeof window !== "undefined") (e.target.form as HTMLFormElement)?.submit() }}
                className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-white text-sm focus:outline-none cursor-pointer">
                {allPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.exam_name}</option>
                ))}
              </select>
            </form>
          )}
        </div>

        {/* Study time summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Study time",    val: `${Math.round(totalMinsThisWeek / 60 * 10) / 10}h`, sub: `${sessionCount} sessions` },
            { label: "Weeks done",    val: String(stats?.completedWeeks ?? 0), sub: `of ${stats?.totalWeeks ?? 0} total` },
            { label: "Mock tests",    val: String(recentMocks.length), sub: mockStats.avgScore != null ? `avg ${mockStats.avgScore}%` : "this week" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-white text-2xl font-light mb-0.5">{s.val}</p>
              <p className="text-white/25 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Plan progress */}
        {stats && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Plan progress</p>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">Tasks completed</span>
                  <span className="text-white/50 tabular-nums">{stats.completedWeeks}/{stats.totalWeeks}</span>
                </div>
                <ProgressBar value={stats.completedWeeks} max={stats.totalWeeks} />
              </div>
              {stats.totalWeeks > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/50">Weeks complete</span>
                    <span className="text-white/50 tabular-nums">{stats.completedWeeks}/{stats.totalWeeks}</span>
                  </div>
                  <ProgressBar value={stats.completedWeeks} max={stats.totalWeeks} color="#60a5fa" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subject breakdown */}
        {topSubjects.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Time by subject (this week)</p>
            <div className="flex flex-col gap-3">
              {topSubjects.map(([subject, mins]) => (
                <div key={subject}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60">{subject}</span>
                    <span className="text-white/40 tabular-nums">{Math.round(mins / 60 * 10) / 10}h</span>
                  </div>
                  <ProgressBar value={mins} max={totalMinsThisWeek} color="#34d399" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mock test performance */}
        {recentMocks.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/40 text-xs uppercase tracking-widest">Mock tests this week</p>
              <Link href="/dashboard/study-plan/mock-tests" className="text-[#e8d5a3]/50 text-xs hover:text-[#e8d5a3]">
                All tests →
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {recentMocks.slice(0, 5).map((m) => {
                const pct = m.scored_marks != null && m.total_marks && m.total_marks > 0
                  ? Math.round((m.scored_marks / m.total_marks) * 100) : null
                const color = pct != null ? (pct >= 70 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171") : "#ffffff40"
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="text-white/50 text-xs flex-1 truncate">{m.test_name ?? m.exam_name}</span>
                    {pct != null && (
                      <span className="text-sm font-mono tabular-nums" style={{ color }}>{pct}%</span>
                    )}
                    {m.percentile != null && (
                      <span className="text-white/25 text-xs">{m.percentile}ile</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Next week preview */}
        {currentWeek && (
          <div className="rounded-2xl border border-[#e8d5a3]/10 bg-[#e8d5a3]/[0.03] p-5">
            <p className="text-[#e8d5a3]/50 text-xs uppercase tracking-widest mb-2">Focus this week</p>
            <p className="text-white text-sm font-medium">{weekLabel}</p>
            {(currentWeek as { focus_areas?: string[] }).focus_areas && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {((currentWeek as { focus_areas?: string[] }).focus_areas ?? []).map((fa: string) => (
                  <span key={fa} className="text-[10px] px-2 py-0.5 rounded-full border border-[#e8d5a3]/15 text-[#e8d5a3]/50">{fa}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-4">
              <Link href="/dashboard/study-plan/focus"
                className="text-xs px-3 py-1.5 rounded-xl border border-[#e8d5a3]/20 text-[#e8d5a3]/60 hover:text-[#e8d5a3] transition-colors">
                ⏱ Start focus session
              </Link>
              <Link href="/dashboard/study-plan/mock-tests?add=1"
                className="text-xs px-3 py-1.5 rounded-xl border border-white/[0.1] text-white/40 hover:text-white transition-colors">
                📝 Log mock test
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

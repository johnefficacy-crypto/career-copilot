import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getPlanWithWeeks, getPlanStats, getStudyLogs } from "@/lib/db/study-planner"
import { WeekCard } from "@/components/study-plan/WeekCard"
import { LogSessionForm } from "@/components/study-plan/LogSessionForm"
import { PlanStatsBar } from "@/components/study-plan/PlanStatsBar"
import { formatDate } from "@/lib/utils/dates"

export default async function StudyPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [plan, stats, logs] = await Promise.all([
    getPlanWithWeeks(id, user.id),
    getPlanStats(id, user.id),
    getStudyLogs(user.id, id, 7),
  ])

  if (!plan) notFound()

  const weeks = plan.study_weeks ?? []
  const currentWeek = weeks.find((w) => w.status === "in_progress")
    ?? weeks.find((w) => w.status === "pending")

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <Link href="/dashboard/study-plan" className="text-white/30 text-sm hover:text-white/60 transition-colors">
              ← Study plans
            </Link>
            <h1 className="text-white text-3xl font-medium mt-2"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {plan.exam_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/40">
              <span>{stats.totalWeeks}-week plan</span>
              <span>·</span>
              <span>{plan.daily_hours}h/day · {plan.weekly_days} days/week</span>
              <span>·</span>
              <span className="capitalize">{plan.current_level}</span>
              {plan.target_date && (
                <><span>·</span><span>Target {formatDate(plan.target_date)}</span></>
              )}
            </div>
          </div>

          <Link
            href="/dashboard/study-plan/new"
            className="shrink-0 px-4 py-2 rounded-xl border border-white/[0.1] text-white/50 text-xs hover:text-white hover:border-white/[0.2] transition-colors"
          >
            Regenerate
          </Link>
        </div>

        {/* Stats bar */}
        <PlanStatsBar stats={stats} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: week list */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Week by week</p>
            {weeks.map((week) => (
              <WeekCard
                key={week.id}
                week={week}
                planId={plan.id}
                isCurrent={week.id === currentWeek?.id}
              />
            ))}
          </div>

          {/* Right: log session + recent logs */}
          <div className="flex flex-col gap-5">
            <LogSessionForm
              planId={plan.id}
              currentWeekId={currentWeek?.id ?? null}
              currentWeekTitle={currentWeek?.title ?? null}
            />

            {logs.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Recent sessions</p>
                <div className="flex flex-col gap-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-white/60">{log.logged_date}</span>
                        {log.mood && (
                          <span className="ml-2 text-white/30">
                            {log.mood === "great" ? "🔥" : log.mood === "good" ? "✓" : log.mood === "okay" ? "~" : "😓"}
                          </span>
                        )}
                      </div>
                      <span className="text-[#e8d5a3]/70 tabular-nums font-medium">
                        {log.hours_studied}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
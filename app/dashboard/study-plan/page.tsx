import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getUserPlans, getPlanStats } from "@/lib/db/study-planner"
import { formatDate } from "@/lib/utils/dates"
import { deletePlanAction } from "@/actions/study-planner"

export const metadata = { title: "Study Plan — Career Copilot" }

export default async function StudyPlanIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const plans = await getUserPlans(user.id)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60 transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-white text-3xl font-medium mt-2"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Study plans
            </h1>
          </div>
          <Link
            href="/dashboard/study-plan/new"
            className="px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
          >
            + Generate new plan
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-8 py-16 text-center">
            <div className="text-4xl mb-4 opacity-30">📚</div>
            <p className="text-white/60 text-base mb-2">No study plans yet</p>
            <p className="text-white/30 text-sm mb-6">
              Generate a personalised AI study plan for your target exam in under a minute.
            </p>
            <Link
              href="/dashboard/study-plan/new"
              className="inline-block px-6 py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
            >
              Generate my first plan
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {plans.map(async (plan) => {
              const stats = await getPlanStats(plan.id, user.id)

              return (
                <div key={plan.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-white text-lg font-medium"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {plan.exam_name}
                      </h2>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span>{stats.totalWeeks} weeks</span>
                        <span>·</span>
                        <span>{plan.daily_hours}h/day</span>
                        <span>·</span>
                        <span>{plan.current_level}</span>
                        {plan.target_date && (
                          <><span>·</span><span>Target: {formatDate(plan.target_date)}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/dashboard/study-plan/${plan.id}`}
                        className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/60 text-xs hover:text-white hover:border-white/[0.2] transition-colors"
                      >
                        View plan →
                      </Link>
                      <form action={deletePlanAction}>
                        <input type="hidden" name="plan_id" value={plan.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-red-400/40 text-xs hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#e8d5a3] rounded-full transition-all"
                        style={{ width: `${stats.percentComplete}%` }}
                      />
                    </div>
                    <span className="text-[#e8d5a3] text-sm font-medium tabular-nums">
                      {stats.percentComplete}%
                    </span>
                  </div>

                  {/* Mini stats */}
                  <div className="flex gap-5 text-xs text-white/35">
                    <span>{stats.completedWeeks}/{stats.totalWeeks} weeks done</span>
                    <span>{stats.totalHours}h studied</span>
                    <span>{stats.studyDays} study days</span>
                    {stats.streak > 1 && (
                      <span className="text-amber-400">{stats.streak} day streak 🔥</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
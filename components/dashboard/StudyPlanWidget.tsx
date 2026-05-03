import Link from "next/link"

interface Week {
  week_number: number
  title: string | null
  focus_area: string | null
  status: string | null
}

interface Props {
  plan: {
    id: string
    exam_name: string
    study_weeks: Week[]
  } | null
  percentComplete: number
  streak: number
  targetExam?: string
}

export function StudyPlanWidget({ plan, percentComplete, streak, targetExam }: Props) {
  // No plan yet — show generator CTA
  if (!plan) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg,#e8d5a3 0px,#e8d5a3 1px,transparent 1px,transparent 12px)`,
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 uppercase tracking-widest text-xs">AI Study Plan</p>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Ready
            </span>
          </div>
          <p className="text-white/60 text-sm mb-4 leading-relaxed">
            {targetExam
              ? `Generate your personalised ${targetExam} study plan. AI tailors it to your timeline, hours, and weak areas.`
              : "Generate a personalised AI study plan for your target exam."}
          </p>
          <Link
            href="/dashboard/study-plan/new"
            className="block w-full py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium text-center hover:bg-[#f0dfa8] transition-colors"
          >
            Generate my study plan
          </Link>
        </div>
      </div>
    )
  }

  // Plan exists — show progress summary
  const weeks = plan.study_weeks ?? []
  const currentWeek = weeks.find((w) => w.status === "in_progress")
    ?? weeks.find((w) => w.status === "pending")
  const completedCount = weeks.filter((w) => w.status === "completed").length

  return (
    <div className="bg-white/[0.03] border border-[#e8d5a3]/15 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 uppercase tracking-widest text-xs">Study Plan</p>
        {streak > 1 && (
          <span className="text-amber-400 text-xs">{streak}d streak 🔥</span>
        )}
      </div>

      <p className="text-white text-sm font-medium mb-3 truncate"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {plan.exam_name}
      </p>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e8d5a3] rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        <span className="text-[#e8d5a3] text-xs tabular-nums">{percentComplete}%</span>
      </div>

      {/* Current week */}
      {currentWeek && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Current week</p>
          <p className="text-white/70 text-sm">Wk {currentWeek.week_number}: {currentWeek.focus_area}</p>
          <p className="text-white/35 text-xs mt-0.5 truncate">{currentWeek.title}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-white/30 text-xs">
          {completedCount}/{weeks.length} weeks done
        </p>
        <Link
          href={`/dashboard/study-plan/${plan.id}`}
          className="text-[#e8d5a3]/60 text-xs hover:text-[#e8d5a3] transition-colors"
        >
          View full plan →
        </Link>
      </div>
    </div>
  )
}
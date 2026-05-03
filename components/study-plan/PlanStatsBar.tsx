interface Props {
  stats: {
    totalWeeks: number
    completedWeeks: number
    percentComplete: number
    totalHours: number
    studyDays: number
    streak: number
  }
}

export function PlanStatsBar({ stats }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e8d5a3] rounded-full transition-all duration-700"
            style={{ width: `${stats.percentComplete}%` }}
          />
        </div>
        <span className="text-[#e8d5a3] font-medium text-sm tabular-nums">
          {stats.percentComplete}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Weeks done",   value: `${stats.completedWeeks}/${stats.totalWeeks}` },
          { label: "Hours logged", value: `${stats.totalHours}h` },
          { label: "Study days",   value: stats.studyDays },
          { label: "Day streak",   value: stats.streak > 0 ? `${stats.streak}${stats.streak > 2 ? " 🔥" : ""}` : "0" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-white text-lg font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {s.value}
            </p>
            <p className="text-white/30 text-xs">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
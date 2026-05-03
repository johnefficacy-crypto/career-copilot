import type { DashboardData } from "@/lib/db/dashboard"

interface Props {
  targets: DashboardData["targets"]
  attempts: DashboardData["attempts"]
  education: DashboardData["education"]
  preferences: DashboardData["preferences"]
}

export function StatsBar({ targets, attempts, education, preferences }: Props) {
  const totalAttempts = attempts.reduce((sum, a) => sum + (a.attempts_used ?? 0), 0)
  const highestEdu = education[0]?.level ?? "—"
  const targetCount = (preferences?.target_exams ?? []).length

  const stats = [
    {
      label: "Exams targeted",
      value: targets.length || targetCount || 0,
      unit: "",
      note: "tracked",
    },
    {
      label: "Attempts used",
      value: totalAttempts,
      unit: "",
      note: "across exams",
    },
    {
      label: "Education",
      value: highestEdu,
      unit: "",
      note: education[0]?.degree ?? "highest",
    },
    {
      label: "Sectors",
      value: (preferences?.preferred_sectors ?? []).length || "—",
      unit: "",
      note: "of interest",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3"
        >
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{s.label}</p>
          <p className="text-white text-2xl font-semibold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {s.value}{s.unit}
          </p>
          <p className="text-white/30 text-xs mt-1">{s.note}</p>
        </div>
      ))}
    </div>
  )
}
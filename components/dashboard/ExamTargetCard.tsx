import type { DashboardData } from "@/lib/db/dashboard"
import { daysUntil, formatDate, getDeadlineUrgency, dateProgress } from "@/lib/utils/dates"

interface Props {
  targets: DashboardData["targets"]
  attempts: DashboardData["attempts"]
}

const URGENCY_STYLES = {
  safe:    { bar: "bg-emerald-500",   badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "On track" },
  warning: { bar: "bg-amber-400",     badge: "bg-amber-400/10 text-amber-300 border-amber-400/20",     label: "Closing soon" },
  danger:  { bar: "bg-red-500",       badge: "bg-red-500/10 text-red-400 border-red-500/20",           label: "Urgent" },
  expired: { bar: "bg-white/20",      badge: "bg-white/5 text-white/40 border-white/10",               label: "Closed" },
}

export function ExamTargetCard({ targets, attempts }: Props) {
  if (targets.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
        <p className="text-white/40 text-sm mb-3 uppercase tracking-widest text-xs">Primary target</p>
        <p className="text-white/60 text-base">No exam targets added yet.</p>
        <p className="text-white/30 text-sm mt-1">
          Once the notification engine is live, matched exams will appear here automatically.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3] text-sm px-4 py-2 rounded-lg cursor-pointer hover:bg-[#e8d5a3]/15 transition-colors">
          Browse open exams
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <p className="text-white/40 uppercase tracking-widest text-xs mb-4">Exam targets</p>

      <div className="flex flex-col gap-4">
        {targets.slice(0, 3).map((t) => {
          const rec = t.recruitments as {
            id?: string
            name?: string
            year?: number | null
            notification_date?: string | null
            apply_start_date?: string | null
            apply_end_date?: string | null
            organizations?: { type?: string; name?: string } | null
          } | null
          if (!rec) return null

          const daysLeft = daysUntil(rec.apply_end_date)
          const urgency = getDeadlineUrgency(rec.apply_end_date)
          const styles = URGENCY_STYLES[urgency]
          const progress = dateProgress(rec.apply_start_date, rec.apply_end_date)
          const attemptRecord = attempts.find((a) => a.recruitment_id === rec.id)

          return (
            <div
              key={t.id}
              className="border border-white/[0.07] rounded-xl p-4 hover:border-white/[0.14] transition-colors"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/40 text-xs">{rec.organizations?.type ?? "Exam"}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-white/40 text-xs">{rec.year}</span>
                  </div>
                  <h3 className="text-white text-base font-medium leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {rec.name}
                  </h3>
                  <p className="text-white/40 text-xs mt-0.5">{rec.organizations?.name}</p>
                </div>

                <span className={`shrink-0 border text-xs px-2.5 py-1 rounded-full ${styles.badge}`}>
                  {styles.label}
                </span>
              </div>

              {/* Dates row */}
              <div className="flex gap-4 text-xs text-white/40 mb-3">
                <span>Notified: <span className="text-white/60">{formatDate(rec.notification_date)}</span></span>
                <span>Deadline: <span className="text-white/60">{formatDate(rec.apply_end_date)}</span></span>
                {attemptRecord && (
                  <span>Attempts: <span className="text-white/60">{attemptRecord.attempts_used}</span></span>
                )}
              </div>

              {/* Countdown */}
              {daysLeft !== null && urgency !== "expired" && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-white/[0.07] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${styles.bar}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium tabular-nums ${
                    urgency === "danger" ? "text-red-400" :
                    urgency === "warning" ? "text-amber-300" : "text-white/50"
                  }`}>
                    {daysLeft}d left
                  </span>
                </div>
              )}

              {urgency === "expired" && (
                <p className="text-white/30 text-xs">Application window closed</p>
              )}
            </div>
          )
        })}
      </div>

      {targets.length > 3 && (
        <p className="text-white/30 text-xs mt-3 text-center">
          +{targets.length - 3} more targeted exams
        </p>
      )}
    </div>
  )
}
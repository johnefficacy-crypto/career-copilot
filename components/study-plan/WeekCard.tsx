"use client"

import { useState } from "react"
import { updateWeekStatus } from "@/actions/study-planner"

interface DailyTask { day: string; task: string; duration_mins: number }
interface Resource  { title: string; type: string; url?: string }

interface Week {
  id: string
  week_number: number
  title: string
  focus_area: string
  description: string | null
  topics: string[] | null
  daily_tasks: unknown
  resources: unknown
  status: string | null
}

interface Props {
  week: Week
  planId: string
  isCurrent: boolean
}

const STATUS_CONFIG = {
  pending:     { label: "Pending",     dot: "bg-white/20",        text: "text-white/30" },
  in_progress: { label: "In progress", dot: "bg-amber-400",       text: "text-amber-300" },
  completed:   { label: "Done",        dot: "bg-emerald-400",     text: "text-emerald-400" },
}

const RESOURCE_ICONS: Record<string, string> = {
  book: "📖", video: "▶", practice: "✏", mock_test: "📝", revision: "🔄",
}

export function WeekCard({ week, planId, isCurrent }: Props) {
  const [expanded, setExpanded] = useState(isCurrent)
  const validStatuses = ["pending", "in_progress", "completed"] as const
  type ValidStatus = typeof validStatuses[number]
  const [status, setStatus] = useState<ValidStatus>(
    validStatuses.includes(week.status as ValidStatus)
      ? (week.status as ValidStatus)
      : "pending"
  )
  const [loading, setLoading] = useState(false)
  const cfg = STATUS_CONFIG[status]

  async function handleStatusChange(newStatus: typeof status) {
    setLoading(true)
    const fd = new FormData()
    fd.set("week_id", week.id)
    fd.set("plan_id", planId)
    fd.set("status", newStatus)
    await updateWeekStatus(fd)
    setStatus(newStatus)
    setLoading(false)
  }

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        status === "completed"
          ? "border-emerald-500/15 bg-emerald-500/[0.03]"
          : isCurrent
          ? "border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.03]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Week number */}
        <span className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40 text-xs font-mono">
          {week.week_number}
        </span>

        {/* Title + focus */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${status === "completed" ? "text-white/40 line-through" : "text-white"}`}>
            {week.title}
          </p>
          <p className="text-white/30 text-xs mt-0.5">{week.focus_area}</p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-xs ${cfg.text}`}>{cfg.label}</span>
        </div>

        {/* Expand chevron */}
        <span className={`text-white/20 text-sm transition-transform ${expanded ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.05]">
          {/* Description */}
          <p className="text-white/50 text-sm mt-4 mb-4 leading-relaxed">{week.description}</p>

          {/* Topics */}
          {(week.topics ?? []).length > 0 && (
            <div className="mb-4">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Topics this week</p>
              <div className="flex flex-wrap gap-1.5">
                {(week.topics ?? []).map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Daily tasks */}
          {Array.isArray(week.daily_tasks) && week.daily_tasks.length > 0 && (
            <div className="mb-4">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Daily schedule</p>
              <div className="flex flex-col gap-1.5">
                {(week.daily_tasks as DailyTask[]).map((task, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 text-white/30 text-xs w-16 pt-0.5">{task.day}</span>
                    <span className="flex-1 text-white/60">{task.task}</span>
                    <span className="shrink-0 text-white/25 text-xs tabular-nums">{task.duration_mins}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {Array.isArray(week.resources) && week.resources.length > 0 && (
            <div className="mb-5">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Resources</p>
              <div className="flex flex-col gap-1.5">
                {(week.resources as Resource[]).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/50">
                    <span className="text-xs">{RESOURCE_ICONS[r.type] ?? "•"}</span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#e8d5a3] transition-colors">
                        {r.title}
                      </a>
                    ) : (
                      <span>{r.title}</span>
                    )}
                    <span className="text-white/20 text-xs capitalize">({r.type.replace("_", " ")})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status controls */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/[0.05]">
            <span className="text-white/25 text-xs mr-1">Mark as:</span>
            {(["pending", "in_progress", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading || status === s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors capitalize ${
                  status === s
                    ? "bg-white/[0.08] text-white/60 cursor-default"
                    : "text-white/35 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
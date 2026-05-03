"use client"

import { useEffect, useMemo, useState } from "react"

export type LiveStatsSummary = {
  eligible_now: number
  potential_matches: number
  closing_soon: number
  today_tasks_done: number
  today_tasks_total: number
  weekly_focus_minutes: number
  latest_mock_score: number | null
  profile_readiness_pct: number
}

interface Props { summary: LiveStatsSummary }
const PREF_KEY = "cc.dashboard.liveStats.expanded"

export function LiveStatsBar({ summary }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const apply = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (mobile) {
        setExpanded(false)
      } else {
        setExpanded(window.localStorage.getItem(PREF_KEY) === "1")
      }
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const completion = useMemo(() => {
    if (summary.today_tasks_total <= 0) return "0/0"
    return `${summary.today_tasks_done}/${summary.today_tasks_total}`
  }, [summary.today_tasks_done, summary.today_tasks_total])

  const toggle = () => {
    if (isMobile) {
      setExpanded(v => !v)
      return
    }
    setExpanded(v => {
      const next = !v
      window.localStorage.setItem(PREF_KEY, next ? "1" : "0")
      return next
    })
  }

  const cards = [
    { label: "Eligible now", value: summary.eligible_now, note: "confirmed" },
    { label: "Potential matches", value: summary.potential_matches, note: "profile data needed" },
    { label: "Closing soon", value: summary.closing_soon, note: "deadline ≤ 7 days" },
    { label: "Study today", value: completion, note: "tasks done" },
  ]

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/55 text-xs uppercase tracking-widest">Live dashboard</p>
        <button onClick={toggle} className="text-xs text-[#e8d5a3]/80 hover:text-[#e8d5a3]">
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-white text-2xl font-semibold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {s.value}
            </p>
            <p className="text-white/30 text-xs mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-white/60">
            Weekly focus: <span className="text-white">{summary.weekly_focus_minutes} min</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-white/60">
            Latest mock: <span className="text-white">{summary.latest_mock_score ?? "—"}</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-white/60">
            Profile readiness: <span className="text-white">{summary.profile_readiness_pct}%</span>
          </div>
        </div>
      )}
    </section>
  )
}

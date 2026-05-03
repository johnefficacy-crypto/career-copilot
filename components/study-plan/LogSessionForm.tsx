"use client"

import { useState } from "react"
import { logSession } from "@/actions/study-planner"

interface Props {
  planId: string
  currentWeekId: string | null
  currentWeekTitle: string | null
}

const inputCls  = "w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
const selectCls = inputCls

const MOODS = [
  { value: "great", label: "🔥 Great" },
  { value: "good",  label: "✓ Good"  },
  { value: "okay",  label: "~ Okay"  },
  { value: "tough", label: "😓 Tough" },
]

export function LogSessionForm({ planId, currentWeekId, currentWeekTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await logSession(formData)
    setLoading(false)
    setDone(true)
    setOpen(false)
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-xs uppercase tracking-widest">Log today&apos;s session</p>
        {done && <span className="text-emerald-400 text-xs">Logged ✓</span>}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-xl border border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.04] text-[#e8d5a3]/60 text-sm hover:bg-[#e8d5a3]/[0.08] hover:text-[#e8d5a3] transition-colors"
        >
          + Log session
        </button>
      ) : (
        <form action={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="plan_id" value={planId} />
          {currentWeekId && <input type="hidden" name="week_id" value={currentWeekId} />}

          {currentWeekTitle && (
            <p className="text-white/30 text-xs">Current week: {currentWeekTitle}</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-white/30 text-xs">Hours studied</label>
              <select name="hours_studied" required className={selectCls}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6].map((h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white/30 text-xs">Session mood</label>
              <select name="mood" className={selectCls}>
                <option value="">—</option>
                {MOODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/30 text-xs">Topics covered (comma-separated)</label>
            <input
              name="topics_covered"
              type="text"
              placeholder="Number series, Percentage"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/30 text-xs">Notes (optional)</label>
            <input
              name="notes"
              type="text"
              placeholder="Struggled with compound interest..."
              className={inputCls}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save session"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-white/[0.1] text-white/40 text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
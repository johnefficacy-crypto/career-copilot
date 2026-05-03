"use client"

import { useRef, useState } from "react"
import { saveMockTestAction } from "@/actions/mock-tests"

const inputCls = "w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"

export function MockTestForm({ planId }: { planId?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setSaving(true)
    setError(null)
    const result = await saveMockTestAction(new FormData(formRef.current))
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDone(true)
      formRef.current.reset()
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-8 text-center">
        <p className="text-emerald-400 text-sm mb-3">Test logged successfully.</p>
        <button
          onClick={() => setDone(false)}
          className="text-white/40 text-xs hover:text-white transition-colors"
        >
          Log another
        </button>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
      <p className="text-white/40 text-xs uppercase tracking-widest">Log mock test</p>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
      )}

      {planId && <input type="hidden" name="plan_id" value={planId} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="text-white/35 text-xs">Exam name *</label>
          <input name="exam_name" required placeholder="IBPS PO 2024" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Test / series name</label>
          <input name="test_name" placeholder="Mock 5 — Oliveboard" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Date attempted</label>
          <input name="attempted_at" type="date" className={inputCls} defaultValue={new Date().toISOString().split("T")[0]} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Score</label>
          <input name="scored_marks" type="number" step="0.5" placeholder="67.5" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Out of</label>
          <input name="total_marks" type="number" placeholder="100" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Duration (min)</label>
          <input name="duration_mins" type="number" placeholder="60" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Total Qs</label>
          <input name="total_questions" type="number" placeholder="100" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Attempted</label>
          <input name="attempted_questions" type="number" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Correct</label>
          <input name="correct_answers" type="number" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Wrong</label>
          <input name="wrong_answers" type="number" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Percentile</label>
          <input name="percentile" type="number" step="0.01" placeholder="75.40" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-white/35 text-xs">Rank in series</label>
          <input name="rank_in_series" type="number" className={inputCls} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-white/35 text-xs">Notes / analysis</label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Weak in Reasoning — need more practice on blood relations"
          className={inputCls + " resize-none"}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save mock test"}
      </button>
    </form>
  )
}

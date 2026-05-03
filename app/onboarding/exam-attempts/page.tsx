"use client"

// FIX: Was calling saveExamAttempts() from onClick — bypasses Next.js CSRF protection.
// Now uses <form action={saveExamAttempts}> with hidden inputs for each row.
// FIX: Completely unstyled — now uses Career Copilot design system.
// FIX: Generic updateRow caused TS `never` inference in strict mode — split into explicit handlers.

import { useState } from "react"
import { saveExamAttempts } from "./action"

const EXAM_OPTIONS = [
  "SEBI Grade A", "RBI Grade B", "NABARD Grade A", "IRDAI",
  "LIC AAO", "UPSC CSE", "SSC CGL", "IBPS PO", "IBPS SO",
  "SBI PO", "State PSC",
]

interface AttemptRow { exam_name: string; attempts_used: number }

export default function ExamAttemptsPage() {
  const [rows, setRows] = useState<AttemptRow[]>([{ exam_name: "", attempts_used: 0 }])

  const addRow        = () => setRows((r) => [...r, { exam_name: "", attempts_used: 0 }])
  const removeRow     = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateExam    = (i: number, v: string) =>
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, exam_name: v } : row))
  const updateAttempts = (i: number, v: number) =>
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, attempts_used: v } : row))

  return (
    <div className="animate-fadeUp" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="cc-page-title">Previous exam attempts</h1>
        <p className="cc-page-subtitle">
          We use this to check your remaining attempts for each exam. Skip if you
          haven&apos;t appeared in any exam yet.
        </p>
      </div>

      {/* Real form — rows serialised as hidden inputs for CSRF-safe server action */}
      <form action={saveExamAttempts} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {rows.map((row, i) => (
          <div key={i} className="cc-exp-row">
            {/* Hidden inputs carry values into FormData on submit */}
            <input type="hidden" name={`exam_${i}_name`}     value={row.exam_name} />
            <input type="hidden" name={`exam_${i}_attempts`} value={row.attempts_used} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ color: "rgba(255,255,255,0.30)", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                Attempt {i + 1}
              </span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  style={{ color: "rgba(239,68,68,0.60)", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="cc-field">
                <label className="cc-label">Exam</label>
                <select className="cc-select" value={row.exam_name}
                  onChange={(e) => updateExam(i, e.target.value)}>
                  <option value="">Select exam</option>
                  {EXAM_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="cc-field">
                <label className="cc-label">Attempts used so far</label>
                <input type="number" min={0} max={20} className="cc-input" placeholder="0"
                  value={row.attempts_used}
                  onChange={(e) => updateAttempts(i, Number(e.target.value))} />
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={addRow}
          style={{ alignSelf: "flex-start", fontSize: "0.875rem", color: "var(--gold-dim)", background: "none", border: "none", cursor: "pointer" }}>
          + Add exam
        </button>

        <div className="cc-form-nav">
          <a href="/onboarding/experience" className="cc-btn-link">← Back</a>
          <button type="submit" className="cc-btn-primary w-auto">Continue →</button>
        </div>
      </form>
    </div>
  )
}
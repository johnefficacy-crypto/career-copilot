"use client"

import { useState } from "react"
import { saveExperience } from "@/actions/onboarding"

const SECTORS = ["BANKING", "FINANCE", "GOVT", "PRIVATE", "OTHER"] as const

interface ExpRow {
  sector: string
  role: string
  organization: string
  start_date: string
  end_date: string
}

const emptyRow: ExpRow = {
  sector: "PRIVATE",
  role: "",
  organization: "",
  start_date: "",
  end_date: "",
}

function calcYears(start: string, end: string) {
  if (!start) return 0
  const s = new Date(start)
  const e = end ? new Date(end) : new Date()
  return Math.max(0, +((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1))
}

export default function ExperiencePage() {
  const [isFresher, setIsFresher] = useState(true)
  const [rows, setRows] = useState<ExpRow[]>([{ ...emptyRow }])

  const addRow = () => setRows((r) => [...r, { ...emptyRow }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const update = (i: number, f: keyof ExpRow, v: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [f]: v } : row)))

  return (
    <div className="animate-fadeUp" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="cc-page-title">Work experience</h1>
        <p className="cc-page-subtitle">
          Some exams give age relaxation or bonus marks for work experience.
        </p>
      </div>

      <form
        action={saveExperience}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <input type="hidden" name="is_fresher" value={isFresher ? "true" : "false"} />

        {!isFresher &&
          rows.map((row, i) => (
            <span key={`hidden-${i}`} style={{ display: "none" }}>
              <input name={`exp_${i}_sector`} value={row.sector} readOnly />
              <input name={`exp_${i}_role`} value={row.role} readOnly />
              <input name={`exp_${i}_organization`} value={row.organization} readOnly />
              <input name={`exp_${i}_start_date`} value={row.start_date} readOnly />
              <input name={`exp_${i}_end_date`} value={row.end_date} readOnly />
              <input
                name={`exp_${i}_years_experience`}
                value={calcYears(row.start_date, row.end_date)}
                readOnly
              />
            </span>
          ))}

        <div className="cc-field">
          <span className="cc-label">Your current status</span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {[
              { val: true, label: "Fresher", desc: "No work experience" },
              { val: false, label: "Experienced", desc: "I have work history" },
            ].map((opt) => (
              <label key={String(opt.val)} className="cc-radio-card" style={{ flex: 1 }}>
                <input
                  type="radio"
                  checked={isFresher === opt.val}
                  onChange={() => setIsFresher(opt.val)}
                />
                <div className="card-body">
                  <p style={{ color: "rgba(255,255,255,0.70)", fontSize: "0.875rem", fontWeight: 500 }}>
                    {opt.label}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.30)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                    {opt.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {!isFresher && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <span className="cc-label">Work history</span>

            {rows.map((row, i) => (
              <div key={i} className="cc-exp-row">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.30)",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Position {i + 1}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      style={{
                        color: "rgba(239,68,68,0.60)",
                        fontSize: "0.75rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="cc-field">
                    <label className="cc-label">Sector</label>
                    <select
                      className="cc-select"
                      value={row.sector}
                      onChange={(e) => update(i, "sector", e.target.value)}
                    >
                      {SECTORS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="cc-field">
                    <label className="cc-label">Role / designation *</label>
                    <input
                      className="cc-input"
                      placeholder="e.g. Analyst, Officer"
                      value={row.role}
                      onChange={(e) => update(i, "role", e.target.value)}
                      required
                    />
                  </div>

                  <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="cc-label">Organisation *</label>
                    <input
                      className="cc-input"
                      placeholder="e.g. HDFC Bank, TCS"
                      value={row.organization}
                      onChange={(e) => update(i, "organization", e.target.value)}
                      required
                    />
                  </div>

                  <div className="cc-field">
                    <label className="cc-label">Start date *</label>
                    <input
                      type="date"
                      className="cc-input"
                      value={row.start_date}
                      onChange={(e) => update(i, "start_date", e.target.value)}
                      required
                    />
                  </div>

                  <div className="cc-field">
                    <label className="cc-label">
                      End date{" "}
                      <span
                        style={{
                          color: "rgba(255,255,255,0.20)",
                          textTransform: "none",
                          fontSize: "0.65rem",
                        }}
                      >
                        (blank = current)
                      </span>
                    </label>
                    <input
                      type="date"
                      className="cc-input"
                      min={row.start_date}
                      value={row.end_date}
                      onChange={(e) => update(i, "end_date", e.target.value)}
                    />
                  </div>
                </div>

                {row.start_date && (
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>
                    Duration: ~{calcYears(row.start_date, row.end_date)} years
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              style={{
                alignSelf: "flex-start",
                fontSize: "0.875rem",
                color: "var(--gold-dim)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              + Add another position
            </button>
          </div>
        )}

        <div className="cc-form-nav">
          <a href="/onboarding/education" className="cc-btn-link">
            ← Back
          </a>
          <button type="submit" className="cc-btn-primary w-auto">
            Continue →
          </button>
        </div>
      </form>
    </div>
  )
}
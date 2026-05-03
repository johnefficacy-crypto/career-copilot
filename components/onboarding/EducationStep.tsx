"use client"

import { useState } from "react"
import type { EducationRowInsert } from "@/types/onboarding"

// ─── Education level options ──────────────────────────────────────────────────

const EDU_LEVELS = [
  { value: "10th",           label: "Class X (10th)"         },
  { value: "12th",           label: "Class XII (10+2)"       },
  { value: "diploma",        label: "Diploma / ITI"          },
  { value: "graduate",       label: "Graduate (UG)"          },
  { value: "postgraduate",   label: "Post-Graduate (PG)"     },
  { value: "phd",            label: "PhD / Doctorate"        },
  { value: "professional",   label: "Professional (CA/CS/LLB)" },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i)

// ─── Empty row factory ────────────────────────────────────────────────────────

function emptyRow(): EducationRowInsert {
  return {
    level:           "graduate",
    degree:          null,
    stream:          null,
    institution:     null,
    graduation_year: null,
    percentage:      null,
    cgpa:            null,
    is_completed:    true,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initial: EducationRowInsert[]
  action:  (formData: FormData) => Promise<void>
  error?:  string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EducationStep({ initial, action, error }: Props) {
  const [rows, setRows] = useState<EducationRowInsert[]>(
    initial.length > 0 ? initial : [emptyRow()]
  )

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateRow<K extends keyof EducationRowInsert>(
    idx: number,
    key: K,
    value: EducationRowInsert[K]
  ) {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  return (
    <form action={action} className="cc-step-form">
      {/* Hidden field carries the full JSON payload */}
      <input
        type="hidden"
        name="education_json"
        value={JSON.stringify(rows)}
      />

      {error && (
        <div className="cc-alert-error">{decodeURIComponent(error)}</div>
      )}

      {rows.map((row, idx) => (
        <div key={idx} className="cc-exp-row">
          <div className="flex items-center justify-between mb-1">
            <span className="cc-section-label" style={{ marginBottom: 0 }}>
              Education {idx + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="cc-btn-link text-xs"
                style={{ color: "var(--danger)" }}
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Level */}
            <div className="cc-field">
              <label className="cc-label">Education level *</label>
              <select
                className="cc-select"
                value={row.level}
                onChange={(e) => updateRow(idx, "level", e.target.value)}
                required
              >
                {EDU_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Degree */}
            <div className="cc-field">
              <label className="cc-label">Degree / qualification</label>
              <input
                type="text"
                className="cc-input"
                value={row.degree ?? ""}
                onChange={(e) => updateRow(idx, "degree", e.target.value || null)}
                placeholder="B.Com, B.Tech, B.Sc…"
              />
            </div>

            {/* Stream */}
            <div className="cc-field">
              <label className="cc-label">Stream / specialisation</label>
              <input
                type="text"
                className="cc-input"
                value={row.stream ?? ""}
                onChange={(e) => updateRow(idx, "stream", e.target.value || null)}
                placeholder="Finance, Computer Science…"
              />
            </div>

            {/* Institution */}
            <div className="cc-field">
              <label className="cc-label">Institution / college</label>
              <input
                type="text"
                className="cc-input"
                value={row.institution ?? ""}
                onChange={(e) => updateRow(idx, "institution", e.target.value || null)}
                placeholder="University name or college"
              />
            </div>

            {/* Year */}
            <div className="cc-field">
              <label className="cc-label">Year of passing / expected</label>
              <select
                className="cc-select"
                value={row.graduation_year ?? ""}
                onChange={(e) =>
                  updateRow(idx, "graduation_year", e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Select year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Percentage */}
            <div className="cc-field">
              <label className="cc-label">Percentage / CGPA</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="cc-input"
                value={row.percentage ?? ""}
                onChange={(e) =>
                  updateRow(idx, "percentage", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="e.g. 72.5 or 8.4 (CGPA)"
              />
            </div>
          </div>

          {/* Completed toggle */}
          <label className="cc-checkbox-row mt-1">
            <input
              type="checkbox"
              checked={row.is_completed}
              onChange={(e) => updateRow(idx, "is_completed", e.target.checked)}
            />
            <span>Course completed (uncheck if in final year)</span>
          </label>
        </div>
      ))}

      {/* Add more */}
      <button
        type="button"
        onClick={addRow}
        className="cc-btn-link text-sm"
        style={{ alignSelf: "flex-start" }}
      >
        + Add another qualification
      </button>

      <div className="cc-form-nav">
        <a href="/onboarding/identity" className="cc-btn-link">← Back</a>
        <button type="submit" className="cc-btn-primary" style={{ width: "auto" }}>
          Continue →
        </button>
      </div>
    </form>
  )
}
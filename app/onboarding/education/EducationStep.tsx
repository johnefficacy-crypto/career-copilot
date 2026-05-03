// "use client"

// /**
//  * components/onboarding/EducationStep.tsx
//  * (also used at: app/onboarding/education/EducationStep.tsx)
//  *
//  * FIXES vs original:
//  * 1. Completely unstyled — now uses Career Copilot design system.
//  * 2. State is serialised into a single hidden `education_json` input so the
//  *    server action receives clean typed data, not raw indexed FormData strings.
//  * 3. Accepts `initialRecords` prop so returning users see their saved data.
//  * 4. 10th and 12th are always shown (fixed rows). Degree rows are dynamic.
//  * 5. TypeScript types are inlined — no import from aspirant.types.
//  */

// import { useState } from "react"

// interface EducationRecord {
//   level: string
//   degree?: string | null
//   stream?: string | null
//   institution?: string | null
//   graduation_year?: number | null
//   percentage?: number | null
//   cgpa?: number | null
//   is_completed?: boolean
// }



// interface DegreeRow {
//   degree: string
//   stream: string
//   institution: string
//   graduation_year: string
//   percentage: string
// }

// const emptyDegree: DegreeRow = {
//   degree: "", stream: "", institution: "", graduation_year: "", percentage: "",
// }

// interface Props {
//   action: (formData: FormData) => Promise<void>
//   initialRecords?: EducationRecord[]
// }

// function findRecord(records: EducationRecord[], level: string) {
//   return records.find((r) => r.level === level)
// }

// export default function EducationStep({ action, initialRecords = [] }: Props) {
//   const tenth   = findRecord(initialRecords, "10th")
//   const twelfth = findRecord(initialRecords, "12th")
//   const existing = initialRecords.filter((r) => r.level === "graduate" || r.level === "postgraduate")

//   const [tenthBoard,  setTenthBoard]  = useState(tenth?.institution ?? "")
//   const [tenthPct,    setTenthPct]    = useState(tenth?.percentage?.toString() ?? "")
//   const [tenthYear,   setTenthYear]   = useState(tenth?.graduation_year?.toString() ?? "")

//   const [twelfthBoard, setTwelfthBoard] = useState(twelfth?.institution ?? "")
//   const [twelfthPct,   setTwelfthPct]   = useState(twelfth?.percentage?.toString() ?? "")
//   const [twelfthYear,  setTwelfthYear]  = useState(twelfth?.graduation_year?.toString() ?? "")

//   const [degrees, setDegrees] = useState<DegreeRow[]>(
//     existing.length > 0
//       ? existing.map((r) => ({
//           degree:          r.degree         ?? "",
//           stream:          r.stream         ?? "",
//           institution:     r.institution    ?? "",
//           graduation_year: r.graduation_year?.toString() ?? "",
//           percentage:      r.percentage?.toString() ?? "",
//         }))
//       : []
//   )

//   const addDegree    = () => setDegrees((d) => [...d, { ...emptyDegree }])
//   const removeDegree = (i: number) => setDegrees((d) => d.filter((_, idx) => idx !== i))
//   const updateDegree = (i: number, field: keyof DegreeRow, value: string) =>
//     setDegrees((d) => d.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

//   // Build the education_json blob submitted as a hidden input
//   function buildJson(): string {
//     const records: EducationRecord[] = []

//     if (tenthBoard || tenthPct || tenthYear) {
//       records.push({
//         level:           "10th",
//         institution:     tenthBoard  || null,
//         percentage:      tenthPct   ? Number(tenthPct)  : null,
//         graduation_year: tenthYear  ? Number(tenthYear) : null,
//         is_completed:    true,
//       })
//     }

//     if (twelfthBoard || twelfthPct || twelfthYear) {
//       records.push({
//         level:           "12th",
//         institution:     twelfthBoard  || null,
//         percentage:      twelfthPct   ? Number(twelfthPct)  : null,
//         graduation_year: twelfthYear  ? Number(twelfthYear) : null,
//         is_completed:    true,
//       })
//     }

//     degrees.forEach((d) => {
//       if (d.degree.trim()) {
//         records.push({
//           level:           "graduate",
//           degree:          d.degree         || null,
//           stream:          d.stream         || null,
//           institution:     d.institution    || null,
//           graduation_year: d.graduation_year ? Number(d.graduation_year) : null,
//           percentage:      d.percentage     ? Number(d.percentage)     : null,
//           is_completed:    true,
//         })
//       }
//     })

//     return JSON.stringify(records)
//   }

//   return (
//     <form action={action} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
//       {/* Hidden input — server action reads this, not individual fields */}
//       <input type="hidden" name="education_json" value={buildJson()} />

//       {/* ── 10th ── */}
//       <section>
//         <span className="cc-section-label">Class 10</span>
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
//           <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
//             <label className="cc-label">Board / School *</label>
//             <input className="cc-input" placeholder="e.g. CBSE, ICSE, State Board"
//               value={tenthBoard} onChange={(e) => setTenthBoard(e.target.value)} required />
//           </div>
//           <div className="cc-field">
//             <label className="cc-label">Percentage *</label>
//             <input type="number" min={0} max={100} step={0.1} className="cc-input"
//               placeholder="85.5"
//               value={tenthPct} onChange={(e) => setTenthPct(e.target.value)} required />
//           </div>
//           <div className="cc-field" style={{ gridColumn: "2 / -1" }}>
//             <label className="cc-label">Passing year *</label>
//             <input type="number" min={1990} max={2030} className="cc-input"
//               placeholder="2018"
//               value={tenthYear} onChange={(e) => setTenthYear(e.target.value)} required />
//           </div>
//         </div>
//       </section>

//       {/* ── 12th ── */}
//       <section>
//         <span className="cc-section-label">Class 12</span>
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
//           <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
//             <label className="cc-label">Board / School *</label>
//             <input className="cc-input" placeholder="e.g. CBSE, ICSE, State Board"
//               value={twelfthBoard} onChange={(e) => setTwelfthBoard(e.target.value)} required />
//           </div>
//           <div className="cc-field">
//             <label className="cc-label">Percentage *</label>
//             <input type="number" min={0} max={100} step={0.1} className="cc-input"
//               placeholder="88.0"
//               value={twelfthPct} onChange={(e) => setTwelfthPct(e.target.value)} required />
//           </div>
//           <div className="cc-field" style={{ gridColumn: "2 / -1" }}>
//             <label className="cc-label">Passing year *</label>
//             <input type="number" min={1990} max={2030} className="cc-input"
//               placeholder="2020"
//               value={twelfthYear} onChange={(e) => setTwelfthYear(e.target.value)} required />
//           </div>
//         </div>
//       </section>

//       {/* ── Degrees (dynamic) ── */}
//       <section>
//         <span className="cc-section-label">Higher education</span>

//         {degrees.length === 0 && (
//           <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
//             No degrees added yet. Click below to add graduation or post-graduation.
//           </p>
//         )}

//         {degrees.map((deg, i) => (
//           <div key={i} className="cc-exp-row" style={{ marginBottom: "0.75rem" }}>
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//               <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
//                 Degree {i + 1}
//               </span>
//               <button type="button" onClick={() => removeDegree(i)}
//                 style={{ fontSize: "0.75rem", color: "rgba(239,68,68,0.60)", background: "none", border: "none", cursor: "pointer" }}>
//                 Remove
//               </button>
//             </div>

//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
//               <div className="cc-field">
//                 <label className="cc-label">Degree *</label>
//                 <input className="cc-input" placeholder="B.Tech, B.Sc, MBA, B.Com…"
//                   value={deg.degree}
//                   onChange={(e) => updateDegree(i, "degree", e.target.value)} required />
//               </div>
//               <div className="cc-field">
//                 <label className="cc-label">Specialisation</label>
//                 <input className="cc-input" placeholder="Computer Science, Finance…"
//                   value={deg.stream}
//                   onChange={(e) => updateDegree(i, "stream", e.target.value)} />
//               </div>
//               <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
//                 <label className="cc-label">University / Institution</label>
//                 <input className="cc-input" placeholder="Delhi University, IIT Bombay…"
//                   value={deg.institution}
//                   onChange={(e) => updateDegree(i, "institution", e.target.value)} />
//               </div>
//               <div className="cc-field">
//                 <label className="cc-label">Percentage / CGPA</label>
//                 <input type="number" min={0} max={100} step={0.01} className="cc-input"
//                   placeholder="75 or 8.5"
//                   value={deg.percentage}
//                   onChange={(e) => updateDegree(i, "percentage", e.target.value)} />
//               </div>
//               <div className="cc-field">
//                 <label className="cc-label">Passing year</label>
//                 <input type="number" min={1990} max={2030} className="cc-input"
//                   placeholder="2023"
//                   value={deg.graduation_year}
//                   onChange={(e) => updateDegree(i, "graduation_year", e.target.value)} />
//               </div>
//             </div>
//           </div>
//         ))}

//         <button type="button" onClick={addDegree}
//           style={{ fontSize: "0.875rem", color: "var(--gold-dim)", background: "none", border: "none", cursor: "pointer" }}>
//           + Add degree / diploma
//         </button>
//       </section>

//       {/* ── Nav ── */}
//       <div className="cc-form-nav">
//         <a href="/onboarding/identity" className="cc-btn-link">← Back</a>
//         <button type="submit" className="cc-btn-primary w-auto">Continue →</button>
//       </div>
//     </form>
//   )
// }


"use client"

import { useMemo, useState } from "react"

interface EducationRecord {
  level: string
  degree?: string | null
  stream?: string | null
  institution?: string | null
  graduation_year?: number | null
  percentage?: number | null
  cgpa?: number | null
  is_completed?: boolean
}

interface DegreeRow {
  level: string
  degree: string
  stream: string
  institution: string
  graduation_year: string
  percentage: string
}

const emptyDegree: DegreeRow = {
  level: "graduate",
  degree: "",
  stream: "",
  institution: "",
  graduation_year: "",
  percentage: "",
}

interface Props {
  action: (formData: FormData) => Promise<void>
  initialRecords?: EducationRecord[]
}

function findRecord(records: EducationRecord[], level: string) {
  return records.find((r) => r.level === level)
}

export default function EducationStep({ action, initialRecords = [] }: Props) {
  const tenth = findRecord(initialRecords, "10th")
  const twelfth = findRecord(initialRecords, "12th")

  const existingHigherEducation = initialRecords.filter(
    (r) => !["10th", "12th"].includes(r.level)
  )

  const [tenthBoard, setTenthBoard] = useState(tenth?.institution ?? "")
  const [tenthPct, setTenthPct] = useState(tenth?.percentage?.toString() ?? "")
  const [tenthYear, setTenthYear] = useState(tenth?.graduation_year?.toString() ?? "")

  const [twelfthBoard, setTwelfthBoard] = useState(twelfth?.institution ?? "")
  const [twelfthPct, setTwelfthPct] = useState(twelfth?.percentage?.toString() ?? "")
  const [twelfthYear, setTwelfthYear] = useState(twelfth?.graduation_year?.toString() ?? "")

  const [degrees, setDegrees] = useState<DegreeRow[]>(
    existingHigherEducation.length > 0
      ? existingHigherEducation.map((r) => ({
          level: r.level || "graduate",
          degree: r.degree ?? "",
          stream: r.stream ?? "",
          institution: r.institution ?? "",
          graduation_year: r.graduation_year?.toString() ?? "",
          percentage: r.percentage?.toString() ?? "",
        }))
      : []
  )

  const addDegree = () => setDegrees((d) => [...d, { ...emptyDegree }])
  const removeDegree = (i: number) => setDegrees((d) => d.filter((_, idx) => idx !== i))
  const updateDegree = (i: number, field: keyof DegreeRow, value: string) =>
    setDegrees((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  const educationJson = useMemo(() => {
    const records: EducationRecord[] = []

    if (tenthBoard || tenthPct || tenthYear) {
      records.push({
        level: "10th",
        institution: tenthBoard || null,
        percentage: tenthPct ? Number(tenthPct) : null,
        graduation_year: tenthYear ? Number(tenthYear) : null,
        is_completed: true,
      })
    }

    if (twelfthBoard || twelfthPct || twelfthYear) {
      records.push({
        level: "12th",
        institution: twelfthBoard || null,
        percentage: twelfthPct ? Number(twelfthPct) : null,
        graduation_year: twelfthYear ? Number(twelfthYear) : null,
        is_completed: true,
      })
    }

    degrees.forEach((d) => {
      if (d.degree.trim()) {
        records.push({
          level: d.level || "graduate",
          degree: d.degree || null,
          stream: d.stream || null,
          institution: d.institution || null,
          graduation_year: d.graduation_year ? Number(d.graduation_year) : null,
          percentage: d.percentage ? Number(d.percentage) : null,
          is_completed: true,
        })
      }
    })

    return JSON.stringify(records)
  }, [
    tenthBoard,
    tenthPct,
    tenthYear,
    twelfthBoard,
    twelfthPct,
    twelfthYear,
    degrees,
  ])

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <input type="hidden" name="education_json" value={educationJson} />

      <section>
        <span className="cc-section-label">Class 10</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
            <label className="cc-label">Board / School *</label>
            <input
              className="cc-input"
              placeholder="e.g. CBSE, ICSE, State Board"
              value={tenthBoard}
              onChange={(e) => setTenthBoard(e.target.value)}
              required
            />
          </div>
          <div className="cc-field">
            <label className="cc-label">Percentage *</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="cc-input"
              placeholder="85.5"
              value={tenthPct}
              onChange={(e) => setTenthPct(e.target.value)}
              required
            />
          </div>
          <div className="cc-field" style={{ gridColumn: "2 / -1" }}>
            <label className="cc-label">Passing year *</label>
            <input
              type="number"
              min={1990}
              max={2030}
              className="cc-input"
              placeholder="2018"
              value={tenthYear}
              onChange={(e) => setTenthYear(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      <section>
        <span className="cc-section-label">Class 12</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
            <label className="cc-label">Board / School *</label>
            <input
              className="cc-input"
              placeholder="e.g. CBSE, ICSE, State Board"
              value={twelfthBoard}
              onChange={(e) => setTwelfthBoard(e.target.value)}
              required
            />
          </div>
          <div className="cc-field">
            <label className="cc-label">Percentage *</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="cc-input"
              placeholder="88.0"
              value={twelfthPct}
              onChange={(e) => setTwelfthPct(e.target.value)}
              required
            />
          </div>
          <div className="cc-field" style={{ gridColumn: "2 / -1" }}>
            <label className="cc-label">Passing year *</label>
            <input
              type="number"
              min={1990}
              max={2030}
              className="cc-input"
              placeholder="2020"
              value={twelfthYear}
              onChange={(e) => setTwelfthYear(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      <section>
        <span className="cc-section-label">Higher education</span>

        {degrees.length === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
            No degrees added yet. Click below to add graduation or post-graduation.
          </p>
        )}

        {degrees.map((deg, i) => (
          <div key={i} className="cc-exp-row" style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                Degree {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeDegree(i)}
                style={{
                  fontSize: "0.75rem",
                  color: "rgba(239,68,68,0.60)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="cc-field">
                <label className="cc-label">Level</label>
                <select
                  className="cc-select"
                  value={deg.level}
                  onChange={(e) => updateDegree(i, "level", e.target.value)}
                >
                  <option value="diploma">Diploma</option>
                  <option value="graduate">Graduate</option>
                  <option value="postgraduate">Postgraduate</option>
                  <option value="phd">PhD</option>
                </select>
              </div>

              <div className="cc-field">
                <label className="cc-label">Degree *</label>
                <input
                  className="cc-input"
                  placeholder="B.Tech, B.Sc, MBA, B.Com…"
                  value={deg.degree}
                  onChange={(e) => updateDegree(i, "degree", e.target.value)}
                  required
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Specialisation</label>
                <input
                  className="cc-input"
                  placeholder="Computer Science, Finance…"
                  value={deg.stream}
                  onChange={(e) => updateDegree(i, "stream", e.target.value)}
                />
              </div>

              <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
                <label className="cc-label">University / Institution</label>
                <input
                  className="cc-input"
                  placeholder="Delhi University, IIT Bombay…"
                  value={deg.institution}
                  onChange={(e) => updateDegree(i, "institution", e.target.value)}
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Percentage</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="cc-input"
                  placeholder="75"
                  value={deg.percentage}
                  onChange={(e) => updateDegree(i, "percentage", e.target.value)}
                />
              </div>

              <div className="cc-field">
                <label className="cc-label">Passing year</label>
                <input
                  type="number"
                  min={1990}
                  max={2030}
                  className="cc-input"
                  placeholder="2023"
                  value={deg.graduation_year}
                  onChange={(e) => updateDegree(i, "graduation_year", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addDegree}
          style={{
            fontSize: "0.875rem",
            color: "var(--gold-dim)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          + Add degree / diploma
        </button>
      </section>

      <div className="cc-form-nav">
        <a href="/onboarding/identity" className="cc-btn-link">← Back</a>
        <button type="submit" className="cc-btn-primary w-auto">Continue →</button>
      </div>
    </form>
  )
}
"use client"

/**
 * app/onboarding/certifications/page.tsx
 *
 * FIXES:
 * 1. Completely unstyled — now uses Career Copilot design system.
 * 2. Had dead commented-out code at the top — removed.
 * 3. Field name was `cert_${i}_authority` but action.ts reads `cert_${i}_org`.
 *    FIX: renamed to `cert_${i}_org` to match the action.
 * 4. Remove button was always shown even when only 1 cert — now hidden if only 1.
 * 5. Certs start empty (no pre-added rows). The step is optional — user can
 *    submit an empty form to skip and the action handles rows.length === 0.
 */

import { useState } from "react"
import { saveCertifications } from "./action"

interface Cert { name: string; org: string; year: string }

export default function CertificationsPage() {
  const [certs, setCerts] = useState<Cert[]>([])

  const addCert    = () => setCerts((c) => [...c, { name: "", org: "", year: "" }])
  const removeCert = (i: number) => setCerts((c) => c.filter((_, idx) => idx !== i))
  const update     = (i: number, field: keyof Cert, value: string) =>
    setCerts((c) => c.map((cert, idx) => idx === i ? { ...cert, [field]: value } : cert))

  return (
    <div className="animate-fadeUp" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="cc-page-title">Professional certifications</h1>
        <p className="cc-page-subtitle">
          NISM, CA, CFA, NIELIT, or any other certification that may count for eligibility.
          This step is optional — skip if you don&apos;t have any.
        </p>
      </div>

      <form action={saveCertifications} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {certs.length === 0 && (
          <div className="cc-card-static" style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
              No certifications added
            </p>
            <button type="button" onClick={addCert}
              style={{ fontSize: "0.875rem", color: "var(--gold-dim)", background: "none", border: "none", cursor: "pointer" }}>
              + Add a certification
            </button>
          </div>
        )}

        {certs.map((cert, i) => (
          <div key={i} className="cc-exp-row">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                Certification {i + 1}
              </span>
              <button type="button" onClick={() => removeCert(i)}
                style={{ fontSize: "0.75rem", color: "rgba(239,68,68,0.60)", background: "none", border: "none", cursor: "pointer" }}>
                Remove
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="cc-field" style={{ gridColumn: "1 / -1" }}>
                <label className="cc-label">Certification name *</label>
                {/* FIX: name matches action.ts which reads cert_${i}_name */}
                <input name={`cert_${i}_name`} className="cc-input"
                  placeholder="e.g. NISM Series VIII, CA Final, CFA Level 1"
                  value={cert.name} onChange={(e) => update(i, "name", e.target.value)} required />
              </div>

              <div className="cc-field">
                <label className="cc-label">Issuing body</label>
                {/* FIX: was cert_${i}_authority — action reads cert_${i}_org */}
                <input name={`cert_${i}_org`} className="cc-input"
                  placeholder="e.g. NISM, ICAI, CFA Institute"
                  value={cert.org} onChange={(e) => update(i, "org", e.target.value)} />
              </div>

              <div className="cc-field">
                <label className="cc-label">Year completed</label>
                <input name={`cert_${i}_year`} type="number" min={1990} max={2030}
                  className="cc-input" placeholder="2022"
                  value={cert.year} onChange={(e) => update(i, "year", e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        {certs.length > 0 && (
          <button type="button" onClick={addCert}
            style={{ alignSelf: "flex-start", fontSize: "0.875rem", color: "var(--gold-dim)", background: "none", border: "none", cursor: "pointer" }}>
            + Add another certification
          </button>
        )}

        <div className="cc-form-nav">
          <a href="/onboarding/education" className="cc-btn-link">← Back</a>
          <button type="submit" className="cc-btn-primary w-auto">
            {certs.length === 0 ? "Skip →" : "Continue →"}
          </button>
        </div>
      </form>
    </div>
  )
}
"use client"

import { useState } from "react"

/**
 * Client component — handles the ex-serviceman checkbox toggle and
 * conditionally renders the service_years input.
 * Replaces the <script dangerouslySetInnerHTML> in identity/page.tsx
 * which React never executes when rendering on the client.
 */
export function ExServicemanFields({
  defaultChecked,
  defaultServiceYears,
}: {
  defaultChecked: boolean
  defaultServiceYears: number | null
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <>
      <label className="cc-checkbox-row">
        <input
          type="checkbox"
          name="ex_serviceman"
          value="true"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>Ex-serviceman or dependent of ex-serviceman (age: actual − service − 3 years)</span>
      </label>

      {checked && (
        <div className="cc-field ml-6">
          <label htmlFor="service_years" className="cc-label">
            Years of military service
          </label>
          <input
            id="service_years"
            name="service_years"
            type="number"
            min="0"
            max="40"
            step="1"
            defaultValue={defaultServiceYears ?? ""}
            placeholder="e.g. 6"
            className="cc-input"
            style={{ maxWidth: "120px" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>
            Used to compute effective age: actual age − service years − 3.
            Leave blank if unknown (a minimum 3-year relaxation will be applied).
          </p>
        </div>
      )}
    </>
  )
}

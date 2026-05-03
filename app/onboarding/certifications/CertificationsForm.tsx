"use client"

import { useState } from "react"

export default function CertificationsForm() {
  const [certs, setCerts] = useState([0])

  const addCert = () => setCerts([...certs, certs.length])
  const removeCert = (i: number) => setCerts(certs.filter((c) => c !== i))

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Professional Certifications</h2>

      {certs.map((i) => (
        <div key={i} className="border p-4 rounded space-y-3">
          <input name={`cert_${i}_name`} placeholder="Certification Name (CA, NISM, etc)" />
          <input name={`cert_${i}_authority`} placeholder="Authority (ICAI, NISM, NIELIT)" />
          <input name={`cert_${i}_year`} placeholder="Year Completed" />

          {certs.length > 1 && (
            <button type="button" onClick={() => removeCert(i)}>
              Remove
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addCert}>
        + Add Certification
      </button>
    </div>
  )
}
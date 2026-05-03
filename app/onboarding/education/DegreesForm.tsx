"use client"

import { useState } from "react"

type Degree = {
  id: number
}

export default function DegreesForm() {
  const [degrees, setDegrees] = useState<Degree[]>([{ id: 0 }])

  function addDegree() {
    setDegrees((prev) => [...prev, { id: prev.length }])
  }

  function removeDegree(id: number) {
    setDegrees((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div>
      <h2>Graduation / Post Graduation</h2>

      {degrees.map((degree, index) => (
        <div key={degree.id} style={{ border: "1px solid #ddd", padding: 15, marginBottom: 15 }}>
          <h4>Degree #{index + 1}</h4>

          <input name={`degree_${index}_qualification`} placeholder="Degree (BSc/BTech/MBA)" />
          <br /><br />

          <input name={`degree_${index}_specialization`} placeholder="Specialization" />
          <br /><br />

          <input name={`degree_${index}_university`} placeholder="University" />
          <br /><br />

          <input name={`degree_${index}_percentage`} placeholder="Percentage" />
          <br /><br />

          <input name={`degree_${index}_year`} placeholder="Passing Year" />
          <br /><br />

          {degrees.length > 1 && (
            <button type="button" onClick={() => removeDegree(degree.id)}>
              Remove Degree
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addDegree}>
        + Add Another Degree
      </button>
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { ProfileImpactResponse, ProfileImpactField } from "@/app/api/dashboard/profile-impact/route"

function ProgressRing({ pct }: { pct: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <circle
        cx={28} cy={28} r={r}
        fill="none"
        stroke={pct >= 80 ? "#86efac" : pct >= 50 ? "#e8d5a3" : "#f87171"}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x={28} y={28}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="rgba(255,255,255,0.75)"
      >
        {pct}%
      </text>
    </svg>
  )
}

function ImpactRow({ field }: { field: ProfileImpactField }) {
  return (
    <Link
      href={field.fillHref}
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors group"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors truncate">
          {field.label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
          {field.description}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {field.impact > 0 && (
          <p className="text-xs font-semibold" style={{ color: "#e8d5a3" }}>
            +{field.impact}
          </p>
        )}
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          opportunities
        </p>
      </div>

      <span className="text-white/20 group-hover:text-white/50 transition-colors text-sm shrink-0">
        →
      </span>
    </Link>
  )
}

export function ProfileImpactCard() {
  const [data, setData] = useState<ProfileImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/profile-impact")
      .then(r => r.json())
      .then((d: ProfileImpactResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", height: 160 }}
      />
    )
  }

  if (!data || data.missing.length === 0) return null

  const topMissing = data.missing.slice(0, 3)

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <ProgressRing pct={data.profilePct} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Profile readiness</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {data.missing.length} field{data.missing.length !== 1 ? "s" : ""} missing —
            fill them to unlock more opportunities
          </p>
        </div>
      </div>

      {/* Missing fields */}
      <div className="space-y-2">
        {topMissing.map(f => (
          <ImpactRow key={f.field} field={f} />
        ))}
      </div>

      {data.missing.length > 3 && (
        <Link
          href="/onboarding"
          className="block text-center text-xs py-2 rounded-xl transition-colors"
          style={{ color: "rgba(255,255,255,0.30)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          +{data.missing.length - 3} more fields to complete
        </Link>
      )}
    </div>
  )
}

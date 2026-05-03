/**
 * app/admin/eligibility/page.tsx
 *
 * FIX: Replaced <form action={adminTriggerEligibilityRecompute}><button>
 * with a proper server action form — no changes needed here, but wrapping
 * data fetch in try/catch to prevent 500 on timeout.
 *
 * NOTE: adminTriggerEligibilityRecompute redirects on completion which
 * works fine with <form action={...}> — this is the correct pattern.
 */

import { createClient } from "@/utils/supabase/server"
import { adminTriggerEligibilityRecompute } from "@/actions/admin"
import { requireAdminRole } from "@/lib/db/admin"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function EligibilityAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("eligibility") } catch { redirect("/dashboard") }

  const { success, error } = await searchParams

  // Wrapped in try/catch — query can timeout in dev with proxy.ts
  let summaryRaw: Array<{
    recruitment_id: string
    is_eligible: boolean
    posts: { recruitments: { name: string; status: string; organizations: { name: string } | null } | null } | null
  }> = []
  let fetchError: string | null = null

  try {
    const { data, error: dbErr } = await supabase
      .from("eligibility_results")
      .select("recruitment_id, is_eligible, posts ( recruitments ( name, status, organizations ( name ) ) )")
      .limit(2000)
    if (dbErr) fetchError = dbErr.message
    else summaryRaw = (data ?? []) as typeof summaryRaw
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load eligibility data"
  }

  // Aggregate
  const recMap: Record<string, { name: string; orgName: string; status: string; eligible: number; total: number }> = {}
  for (const row of summaryRaw) {
    const recId = row.recruitment_id
    const rec   = row.posts?.recruitments
    if (!rec) continue
    if (!recMap[recId]) {
      recMap[recId] = { name: rec.name, orgName: rec.organizations?.name ?? "—", status: rec.status, eligible: 0, total: 0 }
    }
    recMap[recId].total++
    if (row.is_eligible) recMap[recId].eligible++
  }
  const summaries = Object.values(recMap).sort((a, b) => b.eligible - a.eligible)
  const totalChecks   = summaryRaw.length
  const totalEligible = summaryRaw.filter(r => r.is_eligible).length

  return (
    <div className="p-8">
      <h1 className="text-white text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Eligibility audit
      </h1>
      <p className="text-white/40 text-sm mb-6">
        {totalChecks.toLocaleString()} checks computed · {totalEligible.toLocaleString()} eligible matches
      </p>

      {success && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {decodeURIComponent(success)}
        </div>
      )}
      {(error || fetchError) && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error ? decodeURIComponent(error) : fetchError}
        </div>
      )}

      {/* Trigger — server action form, no client JS needed */}
      <div className="mb-8 flex items-center gap-4">
        <form action={adminTriggerEligibilityRecompute}>
          <button type="submit"
            className="px-4 py-2 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
            Recompute all
          </button>
        </form>
        <p className="text-white/30 text-xs">
          Run after adding new recruitments or when users update their profiles.
          This runs eligibility checks for all onboarded users synchronously — may take 30–120s.
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] px-6 py-12 text-center">
          <p className="text-white/40 text-sm">No eligibility results yet.</p>
          <p className="text-white/25 text-xs mt-1">
            Add recruitments with posts and age/education criteria, then click Recompute.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {summaries.map((s, i) => {
            const pct = s.total > 0 ? Math.round((s.eligible / s.total) * 100) : 0
            return (
              <div key={i}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.name}</p>
                  <p className="text-white/35 text-xs">{s.orgName}</p>
                </div>
                <div className="w-32 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-white/40 text-xs tabular-nums">{pct}%</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white/60 text-sm font-medium">{s.eligible}</p>
                  <p className="text-white/25 text-xs">of {s.total} users</p>
                </div>
                <span className={`shrink-0 border text-xs px-2 py-0.5 rounded-full ${
                  s.status === "open" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/30 border-white/10"
                }`}>
                  {s.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
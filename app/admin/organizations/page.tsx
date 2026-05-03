/**
 * app/admin/organizations/page.tsx
 *
 * FIX: Wrapped dbGetAllSources in try/catch — was throwing unhandled error
 * when Supabase fetch timed out, causing the whole page to 500.
 * Organizations table fetch is also wrapped.
 * 
 * Also added "Add Organization" form so admins can create orgs manually
 * (needed before adding recruitments).
 */

import { redirect }        from "next/navigation"
import { createClient }    from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"
import { dbGetAllSources } from "@/lib/db/source-registry"
import { adminCreateOrganization } from "@/actions/admin"
import Link                from "next/link"

export const dynamic  = "force-dynamic"
export const metadata = { title: "Organizations — Admin" }

const ORG_TYPES = ["UPSC","SSC","Banking","PSU","Regulatory","State PSC","Judiciary","Railways","Defence","Insurance","Other"]

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("organizations") } catch { redirect("/dashboard") }

  const { error: qError, success: qSuccess } = await searchParams

  // Fetch in parallel — both wrapped in try/catch to prevent 500 on timeout
  let orgs: Array<{ id: string; name: string; type: string; created_at: string }> = []
  let orgError: string | null = null
  let sourceCount = 0
  let activeSourceCount = 0
  let failingCount = 0

  const [orgResult, sourceResult] = await Promise.allSettled([
    supabase.from("organizations").select("id,name,type,created_at").order("name").limit(200),
    dbGetAllSources(),
  ])

  if (orgResult.status === "fulfilled") {
    orgs = (orgResult.value.data ?? []) as typeof orgs
    if (orgResult.value.error) orgError = orgResult.value.error.message
  } else {
    orgError = orgResult.reason instanceof Error ? orgResult.reason.message : "Failed to load organizations"
  }

  if (sourceResult.status === "fulfilled") {
    const sources = sourceResult.value
    sourceCount       = sources.length
    activeSourceCount = sources.filter(s => s.is_active).length
    failingCount      = sources.filter(s => s.consecutive_fails >= 5).length
  }
  // If source fetch fails (proxy timeout etc), silently show zeros — not critical

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40"
  const selectCls = inputCls + " cursor-pointer"

  return (
    <div className="p-6 max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Organizations
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Recruiting bodies — auto-created on queue approval, or add manually here.
          </p>
        </div>
        <Link href="/admin/sources"
          className="text-sm px-4 py-2 rounded-xl font-medium"
          style={{ background: "rgba(232,213,163,0.10)", color: "#e8d5a3", border: "1px solid rgba(232,213,163,0.25)" }}>
          Source Registry →
        </Link>
      </div>

      {/* Alerts */}
      {qSuccess && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {decodeURIComponent(qSuccess)}
        </div>
      )}
      {(qError || orgError) && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {qError ? decodeURIComponent(qError) : orgError}
        </div>
      )}

      {/* Quick source stats */}
      {sourceCount > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Scraping sources</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total sources",  value: sourceCount,       accent: false },
              { label: "Active",         value: activeSourceCount, accent: true  },
              { label: "Failing (≥5)",   value: failingCount,      accent: failingCount > 0 },
            ].map(s => (
              <div key={s.label} className={`rounded-xl px-4 py-3 border ${
                s.accent ? "bg-[#e8d5a3]/[0.04] border-[#e8d5a3]/20" : "bg-white/[0.03] border-white/[0.07]"
              }`}>
                <p className={`text-2xl font-semibold ${s.accent ? "text-[#e8d5a3]" : "text-white"}`}>{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add organization form */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <h2 className="text-white text-base font-medium mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Add organization
        </h2>
        <form action={adminCreateOrganization} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Name</label>
            <input name="name" required placeholder="e.g. SEBI" className={inputCls} />
          </div>
          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Type</label>
            <select name="type" required className={selectCls}>
              <option value="" disabled>Select type</option>
              {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-[#e8d5a3] text-[#0a0a0a] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
              Add organization
            </button>
          </div>
        </form>
      </div>

      {/* Organizations table */}
      <div>
        <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
          {orgs.length} organizations
        </p>
        <div className="rounded-2xl overflow-hidden border border-white/[0.07]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/30">Name</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/30">Type</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/30">Added</th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-white/30">
                    No organizations yet. Add one above, or approve scrape queue items to auto-create them.
                  </td>
                </tr>
              ) : orgs.map((org, i) => (
                <tr key={org.id} className={i % 2 === 1 ? "bg-white/[0.01]" : ""}>
                  <td className="px-4 py-3 text-white/80">{org.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-white/40">{org.type ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/30">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl px-5 py-4 text-sm border border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.03] text-white/40">
        <strong className="text-[#e8d5a3]">Tip:</strong>{" "}
        Organizations are auto-created when you approve scrape queue items at{" "}
        <Link href="/admin/scrape" className="text-[#e8d5a3] hover:underline">Scrape Dashboard</Link>.
        Only add manually if you need to create a recruitment before the scraper finds one.
      </div>
    </div>
  )
}
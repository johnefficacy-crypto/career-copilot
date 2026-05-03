import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const metadata = { title: "Audit Log — Admin" }

const ACTION_COLORS: Record<string, string> = {
  create_recruitment:   "text-emerald-400",
  update_recruitment:   "text-blue-400",
  delete_recruitment:   "text-red-400",
  publish_recruitment:  "text-emerald-400",
  withdraw_recruitment: "text-red-400",
  submit_for_review:    "text-amber-400",
  approve_scrape_item:  "text-emerald-400",
  reject_scrape_item:   "text-red-400",
  update_ai_policy:     "text-purple-400",
  toggle_kill_switch:   "text-red-400",
  update_admin_role:    "text-amber-400",
  create_organization:  "text-emerald-400",
  update_organization:  "text-blue-400",
}

const PAGE_SIZE = 50

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("audit") } catch { redirect("/dashboard") }

  const sp      = await searchParams
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const entity  = sp.entity ?? ""
  const action  = sp.action ?? ""
  const from    = (pageNum - 1) * PAGE_SIZE
  const to      = from + PAGE_SIZE - 1

  let q = supabase
    .from("admin_audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, old_value, new_value, notes, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (entity) q = q.eq("entity_type", entity)
  if (action) q = q.ilike("action", `%${action}%`)

  const { data: logs, count } = await q
  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Distinct entity types for filter tabs
  const { data: entityTypes } = await supabase
    .from("admin_audit_logs")
    .select("entity_type")
    .order("entity_type")

  const types = [...new Set((entityTypes ?? []).map((r) => r.entity_type))].filter(Boolean)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Audit log
          </h1>
          <p className="text-white/40 text-sm mt-0.5">{total} entries · append-only</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link
          href="/admin/audit"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !entity ? "border-[#e8d5a3]/30 bg-[#e8d5a3]/[0.06] text-[#e8d5a3]" : "border-white/[0.08] text-white/40 hover:text-white/70"
          }`}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t}
            href={`/admin/audit?entity=${t}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              entity === t ? "border-[#e8d5a3]/30 bg-[#e8d5a3]/[0.06] text-[#e8d5a3]" : "border-white/[0.08] text-white/40 hover:text-white/70"
            }`}
          >
            {t.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-6">
        <div className="grid grid-cols-[160px_1fr_140px_100px_160px] gap-4 px-5 py-2.5 border-b border-white/[0.06]">
          {["Time", "Action", "Entity type", "Entity ID", "Actor"].map((h) => (
            <span key={h} className="text-white/25 text-[10px] uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {(logs ?? []).length === 0 ? (
          <p className="text-white/30 text-sm px-5 py-10 text-center">No audit entries found.</p>
        ) : (
          (logs ?? []).map((log) => {
            const color = ACTION_COLORS[log.action] ?? "text-white/60"
            return (
              <details key={log.id} className="border-b border-white/[0.04] last:border-0 group">
                <summary className="grid grid-cols-[160px_1fr_140px_100px_160px] gap-4 px-5 py-3 items-center cursor-pointer hover:bg-white/[0.02] list-none">
                  <span className="text-white/30 text-xs tabular-nums font-mono">
                    {new Date(log.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className={`text-xs font-mono ${color}`}>{log.action}</span>
                  <span className="text-white/35 text-xs">{log.entity_type}</span>
                  <span className="text-white/25 text-[10px] font-mono truncate" title={log.entity_id ?? ""}>
                    {log.entity_id ? log.entity_id.slice(0, 8) + "…" : "—"}
                  </span>
                  <span className="text-white/35 text-xs truncate">{log.actor_email ?? "—"}</span>
                </summary>

                {/* Expanded payload inspector */}
                <div className="px-5 pb-4 pt-1 bg-black/20 text-xs font-mono grid grid-cols-2 gap-4">
                  {log.old_value && (
                    <div>
                      <p className="text-white/25 mb-1 uppercase tracking-widest text-[10px]">Before</p>
                      <pre className="text-white/40 whitespace-pre-wrap break-all text-[11px]">
                        {JSON.stringify(log.old_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.new_value && (
                    <div>
                      <p className="text-white/25 mb-1 uppercase tracking-widest text-[10px]">After</p>
                      <pre className="text-white/60 whitespace-pre-wrap break-all text-[11px]">
                        {JSON.stringify(log.new_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.notes && (
                    <div className="col-span-2">
                      <p className="text-white/25 mb-1 uppercase tracking-widest text-[10px]">Notes</p>
                      <p className="text-white/50">{log.notes}</p>
                    </div>
                  )}
                </div>
              </details>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">Page {pageNum} of {totalPages} · {total} entries</span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link href={`/admin/audit?page=${pageNum - 1}${entity ? `&entity=${entity}` : ""}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 transition-colors">
                ← Prev
              </Link>
            )}
            {pageNum < totalPages && (
              <Link href={`/admin/audit?page=${pageNum + 1}${entity ? `&entity=${entity}` : ""}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/80 transition-colors">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction, type AdminRole } from "@/lib/db/admin"

export const dynamic = "force-dynamic"
export const metadata = { title: "RBAC Manager — Admin" }

const ROLES: AdminRole[] = ["super_admin", "ops_admin", "content_admin", "scraper_admin", "support_admin"]

const ROLE_DESC: Record<AdminRole, string> = {
  super_admin:   "All permissions — unrestricted access",
  ops_admin:     "Scrape, sources, queue, recruitments, orgs, audit",
  content_admin: "Recruitments, orgs, posts only",
  scraper_admin: "Scrape, sources, queue only",
  support_admin: "Users, notifications only",
}

async function updateAdminRoleAction(formData: FormData) {
  "use server"
  const targetUserId = formData.get("target_user_id") as string
  const newRole      = (formData.get("new_role") as string) || null

  try {
    const ctx = await requireAdminRole("rbac")
    const supabase = await createClient()

    const { data: target } = await supabase
      .from("profiles")
      .select("admin_role, email:id")
      .eq("id", targetUserId)
      .single()

    await supabase
      .from("profiles")
      .update({ admin_role: newRole, is_admin: newRole !== null })
      .eq("id", targetUserId)

    void logAdminAction({
      actorId:    ctx.userId,
      actorEmail: ctx.userEmail,
      action:     "update_admin_role",
      entityType: "profile",
      entityId:   targetUserId,
      oldValue:   { admin_role: (target as { admin_role?: string })?.admin_role },
      newValue:   { admin_role: newRole },
    })

    revalidatePath("/admin/rbac")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    if (msg === "UNAUTHENTICATED") redirect("/login")
    redirect(`/admin/rbac?error=${encodeURIComponent(msg)}`)
  }
  redirect("/admin/rbac")
}

export default async function RBACPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("rbac") } catch { redirect("/dashboard") }

  const sp    = await searchParams
  const query = sp.q?.trim() ?? ""

  // Get all admin users + search
  const adminQ = supabase
    .from("profiles")
    .select("id, full_name, admin_role, is_admin, created_at")
    .or("is_admin.eq.true,admin_role.not.is.null")
    .order("created_at", { ascending: false })

  const { data: admins } = await adminQ

  // User search for granting access
  let searchResults: Array<{ id: string; full_name: string | null; admin_role: string | null }> = []
  if (query.length >= 3) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, admin_role")
      .ilike("full_name", `%${query}%`)
      .is("admin_role", null)
      .limit(10)
    searchResults = (data ?? []) as typeof searchResults
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          RBAC manager
        </h1>
        <p className="text-white/40 text-sm mt-0.5">Manage admin roles. super_admin has unrestricted access.</p>
      </div>

      {sp.error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
        {ROLES.map((r) => (
          <div key={r} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#e8d5a3]/70 shrink-0 mt-0.5">{r}</span>
            <span className="text-white/35 text-xs">{ROLE_DESC[r]}</span>
          </div>
        ))}
      </div>

      {/* Current admins */}
      <h2 className="text-white/60 text-sm font-medium mb-3 uppercase tracking-widest text-xs">Current admins</h2>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-8">
        {(admins ?? []).length === 0 ? (
          <p className="text-white/30 text-sm px-5 py-8 text-center">No admins found.</p>
        ) : (
          (admins ?? []).map((admin) => (
            <form key={admin.id} action={updateAdminRoleAction}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
              <input type="hidden" name="target_user_id" value={admin.id} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{admin.full_name ?? "Unknown"}</p>
                <p className="text-white/25 text-xs font-mono">{admin.id.slice(0, 12)}…</p>
              </div>
              <select
                name="new_role"
                defaultValue={admin.admin_role ?? ""}
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#e8d5a3]/40 cursor-pointer"
              >
                <option value="">— Remove access —</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="submit"
                className="text-xs px-3 py-1.5 rounded-lg border border-[#e8d5a3]/20 text-[#e8d5a3]/60 hover:text-[#e8d5a3] hover:border-[#e8d5a3]/40 transition-colors">
                Save
              </button>
            </form>
          ))
        )}
      </div>

      {/* Grant access to new user */}
      <h2 className="text-white/60 text-sm font-medium mb-3 uppercase tracking-widest text-xs">Grant access</h2>
      <form method="get" action="/admin/rbac" className="flex gap-2 mb-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name (3+ chars)…"
          className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
        />
        <button type="submit"
          className="px-4 py-2 rounded-xl border border-white/[0.1] text-white/50 text-sm hover:text-white transition-colors">
          Search
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {searchResults.map((u) => (
            <form key={u.id} action={updateAdminRoleAction}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
              <input type="hidden" name="target_user_id" value={u.id} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{u.full_name ?? "Unknown"}</p>
                <p className="text-white/25 text-xs font-mono">{u.id.slice(0, 12)}…</p>
              </div>
              <select name="new_role" defaultValue=""
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none cursor-pointer">
                <option value="">— Select role —</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="submit"
                className="text-xs px-3 py-1.5 rounded-lg bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3]/70 hover:text-[#e8d5a3] transition-colors">
                Grant
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}

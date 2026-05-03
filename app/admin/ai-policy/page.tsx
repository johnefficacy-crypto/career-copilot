import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"

export const dynamic = "force-dynamic"
export const metadata = { title: "AI Action Policy — Admin" }

type PolicyMode = "allow" | "require_approval" | "deny"

const MODE_STYLES: Record<PolicyMode, { badge: string; label: string }> = {
  allow:            { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Allow" },
  require_approval: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",      label: "Require approval" },
  deny:             { badge: "bg-red-500/10 text-red-400 border-red-500/20",             label: "Deny" },
}

const ACTION_LABELS: Record<string, string> = {
  publish_recruitment:  "Publish recruitment",
  send_notification:    "Send notification",
  update_eligibility:   "Update eligibility",
  generate_study_plan:  "Generate study plan",
  send_message:         "Send message",
  approve_scrape_item:  "Approve scrape item",
  modify_user_data:     "Modify user data",
}

async function updatePolicyAction(formData: FormData) {
  "use server"
  const action = formData.get("action") as string
  const mode   = formData.get("mode")   as PolicyMode
  const reason = formData.get("reason") as string

  try {
    const ctx = await requireAdminRole("ai_policy")
    const supabase = await createClient()

    await supabase
      .from("ai_action_policies")
      .update({ mode, reason: reason || null, updated_by: ctx.userId, updated_at: new Date().toISOString() })
      .eq("action", action)

    void logAdminAction({
      actorId:    ctx.userId,
      actorEmail: ctx.userEmail,
      action:     "update_ai_policy",
      entityType: "ai_action_policy",
      entityId:   action,
      newValue:   { mode, reason },
    })

    revalidatePath("/admin/ai-policy")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    if (msg === "UNAUTHENTICATED") redirect("/login")
    redirect(`/admin/ai-policy?error=${encodeURIComponent(msg)}`)
  }
  redirect("/admin/ai-policy")
}

export default async function AIPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("ai_policy") } catch { redirect("/dashboard") }

  const sp = await searchParams

  const { data: policies } = await supabase
    .from("ai_action_policies")
    .select("*")
    .order("action")

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-medium" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          AI action policy
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          Controls which actions the AI is permitted to take autonomously. Governed by the Career Copilot agent rules.
        </p>
      </div>

      {sp?.error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-white/[0.06] grid grid-cols-[2fr_1fr_3fr_auto] gap-4">
          <span className="text-white/30 text-[10px] uppercase tracking-widest">Action</span>
          <span className="text-white/30 text-[10px] uppercase tracking-widest">Mode</span>
          <span className="text-white/30 text-[10px] uppercase tracking-widest">Reason</span>
          <span />
        </div>

        {(policies ?? []).map((policy) => {
          const style = MODE_STYLES[policy.mode as PolicyMode] ?? MODE_STYLES.deny
          return (
            <details key={policy.action} className="border-b border-white/[0.04] last:border-0">
              <summary className="px-5 py-4 grid grid-cols-[2fr_1fr_3fr_auto] gap-4 items-center cursor-pointer hover:bg-white/[0.02] transition-colors list-none">
                <span className="text-white text-sm">{ACTION_LABELS[policy.action] ?? policy.action}</span>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {style.label}
                </span>
                <span className="text-white/30 text-xs truncate">{policy.reason ?? "—"}</span>
                <span className="text-white/20 text-xs">Edit ›</span>
              </summary>

              <form action={updatePolicyAction} className="px-5 pb-5 pt-2 bg-white/[0.02] flex flex-col gap-3">
                <input type="hidden" name="action" value={policy.action} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/30 text-xs uppercase tracking-widest">Mode</label>
                  <div className="flex gap-2">
                    {(["allow", "require_approval", "deny"] as PolicyMode[]).map((m) => (
                      <label key={m} className="flex-1 cursor-pointer">
                        <input type="radio" name="mode" value={m} defaultChecked={policy.mode === m} className="sr-only peer" />
                        <div className={`text-center py-2 rounded-xl border text-xs transition-colors
                          ${m === "allow"            ? "peer-checked:border-emerald-500/40 peer-checked:bg-emerald-500/10 peer-checked:text-emerald-400" : ""}
                          ${m === "require_approval" ? "peer-checked:border-amber-500/40 peer-checked:bg-amber-500/10 peer-checked:text-amber-400" : ""}
                          ${m === "deny"             ? "peer-checked:border-red-500/40 peer-checked:bg-red-500/10 peer-checked:text-red-400" : ""}
                          border-white/[0.08] text-white/30
                        `}>
                          {MODE_STYLES[m].label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/30 text-xs uppercase tracking-widest">Reason / justification</label>
                  <input
                    name="reason"
                    defaultValue={policy.reason ?? ""}
                    placeholder="Why is this policy set this way?"
                    className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="self-start px-4 py-2 rounded-xl bg-[#e8d5a3] text-[#0a0a0a] text-xs font-medium hover:bg-[#f0dfa8] transition-colors"
                >
                  Save policy
                </button>
              </form>
            </details>
          )
        })}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
        <p className="text-amber-400/80 text-xs font-medium mb-1">Governance reminder</p>
        <p className="text-amber-400/50 text-xs">
          Per the Career Copilot agent rules: AI may propose, summarize, classify, and explain.
          AI must not independently publish, verify, calculate final eligibility, or override deterministic results.
          &quot;Deny&quot; and &quot;Require approval&quot; modes enforce this at the application layer.
        </p>
      </div>
    </div>
  )
}

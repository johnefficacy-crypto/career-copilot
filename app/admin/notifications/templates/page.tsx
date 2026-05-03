import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const metadata = { title: "Notification Templates — Admin" }

async function saveTemplateAction(formData: FormData) {
  "use server"
  const id = formData.get("id") as string
  try {
    const ctx = await requireAdminRole("notifications")
    const supabase = await createClient()
    const patch = {
      subject:    formData.get("subject") as string,
      body_text:  formData.get("body_text") as string,
      body_html:  (formData.get("body_html") as string) || null,
      is_active:  formData.get("is_active") === "true",
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    }
    await (supabase as any).from("notification_templates").update(patch).eq("id", id)
    void logAdminAction({
      actorId:    ctx.userId,
      actorEmail: ctx.userEmail,
      action:     "update_notification_template",
      entityType: "notification_template",
      entityId:   id,
      newValue:   { subject: patch.subject },
    })
    revalidatePath("/admin/notifications/templates")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error"
    if (msg === "UNAUTHENTICATED") redirect("/login")
    redirect(`/admin/notifications/templates?error=${encodeURIComponent(msg)}`)
  }
  redirect("/admin/notifications/templates?success=Template+saved")
}

export default async function NotificationTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("notifications") } catch { redirect("/dashboard") }

  const sp = await searchParams

  const { data: templates } = await supabase
    .from("notification_templates")
    .select("*")
    .order("key")

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/admin/notifications" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          ← Notifications
        </Link>
      </div>
      <h1 className="text-white text-2xl font-medium mb-1 mt-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Notification templates
      </h1>
      <p className="text-white/40 text-sm mb-6">Edit subject/body for each notification type. Use {"{{variable}}"} placeholders.</p>

      {sp.error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {decodeURIComponent(sp.error)}
        </div>
      )}
      {sp.success && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {decodeURIComponent(sp.success)}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(templates ?? []).map((tmpl) => (
          <details key={tmpl.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-white/[0.02] rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#e8d5a3]/70">{tmpl.key}</span>
                <span className="text-white text-sm">{tmpl.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  tmpl.is_active
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-white/30 border-white/10"
                }`}>
                  {tmpl.is_active ? "Active" : "Inactive"}
                </span>
                <span className="text-white/20 text-xs">Edit ›</span>
              </div>
            </summary>

            <form action={saveTemplateAction} className="px-5 pb-5 pt-2 border-t border-white/[0.06] flex flex-col gap-4">
              <input type="hidden" name="id" value={tmpl.id} />

              <div className="flex flex-col gap-1.5">
                <label className="text-white/35 text-xs">Subject line</label>
                <input name="subject" defaultValue={tmpl.subject}
                  className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white/35 text-xs">Body (plain text)</label>
                <textarea name="body_text" rows={6} defaultValue={tmpl.body_text}
                  className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors resize-y" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white/35 text-xs">Body (HTML — optional)</label>
                <textarea name="body_html" rows={4} defaultValue={tmpl.body_html ?? ""}
                  placeholder="Leave empty to use plain text"
                  className="bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors resize-y" />
              </div>

              {tmpl.variables && (
                <div className="flex flex-wrap gap-1.5">
                  {(tmpl.variables as string[]).map((v) => (
                    <span key={v} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-[#e8d5a3]/50">{`{{${v}}}`}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <select name="is_active" defaultValue={tmpl.is_active ? "true" : "false"}
                    className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none cursor-pointer">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <button type="submit"
                  className="px-4 py-2 rounded-xl bg-[#e8d5a3] text-[#0a0a0a] text-xs font-medium hover:bg-[#f0dfa8] transition-colors">
                  Save template
                </button>
              </div>
            </form>
          </details>
        ))}
      </div>
    </div>
  )
}

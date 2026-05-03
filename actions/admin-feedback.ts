"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole, logAdminAction } from "@/lib/db/admin"

function handleErr(err: unknown): never {
  const msg = err instanceof Error ? err.message : "Unknown error"
  if (msg === "UNAUTHENTICATED") redirect("/auth/login")
  if (msg === "UNAUTHORIZED") redirect("/dashboard")
  redirect(`/admin/recruitment-feedback?error=${encodeURIComponent(msg)}`)
}

export async function adminResolveRecruitmentFeedback(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  const resolution = String(formData.get("resolution") ?? "resolved")

  try {
    const ctx = await requireAdminRole("audit")
    if (!id) throw new Error("Missing feedback id")
    if (!["resolved", "rejected"].includes(resolution)) throw new Error("Invalid resolution")

    const supabase = await createClient()
    const db = supabase as unknown as {
      from: (table: string) => {
        select: (q: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } }
        update: (v: unknown) => { eq: (k: string, v: string) => Promise<unknown> }
      }
    }

    const { data: oldRow } = await db
      .from("user_recruitment_feedback")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    await db
      .from("user_recruitment_feedback")
      .update({ status: resolution, resolved_at: new Date().toISOString() })
      .eq("id", id)

    void logAdminAction({
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: "resolve_feedback",
      entityType: "user_recruitment_feedback",
      entityId: id,
      oldValue: oldRow ?? null,
      newValue: { status: resolution },
    })

    revalidatePath("/admin/recruitment-feedback")
  } catch (err) {
    handleErr(err)
  }
}

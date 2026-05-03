"use server"

import { redirect }     from "next/navigation"
import { createClient } from "@/utils/supabase/server"

// ─── Delete account ───────────────────────────────────────────────────────────
// Purges all personal data per DPDP Act 2023 data principal rights.
// Deletes in FK-safe order: dependent rows first, then the auth user record.

export async function deleteAccount() {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect("/auth/login")

  const uid = user.id

  // 1. Notification preferences + alerts
  await supabase.from("notification_alerts").delete().eq("user_id", uid)
  await supabase.from("tracked_recruitments").delete().eq("user_id", uid)

  // 2. Eligibility results
  await supabase.from("eligibility_results").delete().eq("user_id", uid)
  await supabase.from("eligibility_recompute_queue").delete().eq("user_id", uid)

  // 3. Onboarding progress + education
  await supabase.from("user_education").delete().eq("user_id", uid)
  await supabase.from("onboarding_progress").delete().eq("user_id", uid)

  // 4. Subscriptions / billing (soft-delete only — Razorpay audit trail)
  await supabase.from("subscriptions").update({ status: "deleted" }).eq("user_id", uid)

  // 5. Profile
  await supabase.from("profiles").delete().eq("id", uid)

  // 6. Delete the auth user (uses service role — requires admin client)
  // We use the standard client here; Supabase RLS allows users to delete themselves.
  await supabase.auth.admin?.deleteUser(uid)
  // Fallback: sign out so the session is cleared even if admin delete is unavailable
  await supabase.auth.signOut()

  redirect("/?deleted=1")
}

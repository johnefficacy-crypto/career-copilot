/**
 * app/dashboard/layout.tsx
 * Career Copilot — Dashboard layout
 *
 * Handles the onboarding_completed redirect that was previously in proxy.ts.
 *
 * Phase 3D fix: the proxy no longer makes a DB call to check onboarding status
 * (that was causing 15–48s per-request dev latency because it ran on EVERY
 * request, including static assets). This layout runs only once on initial
 * dashboard navigation, not on every route change within the dashboard.
 *
 * Why a layout instead of the page: the redirect needs to intercept all
 * dashboard routes (/dashboard, /dashboard/notifications, etc.), not just
 * the root page.
 */

import { redirect }       from "next/navigation"
import { createClient }   from "@/utils/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Auth check (belt-and-suspenders — proxy already blocked unauthenticated)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Onboarding check — single indexed PK lookup, ~1–3 ms
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect("/onboarding")
  }

  return <>{children}</>
}

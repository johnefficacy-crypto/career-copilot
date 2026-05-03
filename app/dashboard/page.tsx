/**
 * app/dashboard/page.tsx
 *
 * FIX: Removed `children` from <DashboardShell> — DashboardShell does not
 * accept children in its Props interface, so passing <AiChatWidget> as a
 * child caused:
 *   "Property 'children' does not exist on type 'IntrinsicAttributes & Props'"
 *
 * Correct approach: pass the chat widget data as a dedicated prop
 * `chatWidget` on DashboardShell, then render <AiChatWidget> inside
 * DashboardShell's own JSX where it belongs in the grid.
 *
 * TWO CHANGES required (both shown here):
 *  1. This file (dashboard/page.tsx)  — pass chatWidget prop, no children
 *  2. DashboardShell.tsx              — add chatWidget to Props, render it
 */

import { redirect }                from "next/navigation"
import { createClient }            from "@/utils/supabase/server"
import { getDashboardData }        from "@/lib/db/dashboard"
import { getEligibleRecruitments } from "@/lib/eligibility/runner"
import { getUserNotifications, getUnreadCount } from "@/lib/db/notifications"
import { getUserPlans, getPlanStats }            from "@/lib/db/study-planner"
import { getUserChatSessions }     from "@/lib/db/chat"
import { getOrGenerateNextActions } from "@/lib/db/next-actions"
import { getTodaysTasks }          from "@/lib/db/study-tasks"
import { getMissionControlData }   from "@/lib/db/mission-control"
import { DashboardShell }          from "@/components/dashboard/DashboardShell"

export const dynamic  = "force-dynamic"
export const metadata = { title: "Dashboard — Career Copilot" }

export default async function DashboardPage() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // ── Parallel fetch ─────────────────────────────────────────────────────────
  // getUserNotifications / getUnreadCount are non-fatal: if v_notification_feed
  // view hasn't been applied yet, catch and return empty so the rest of the
  // dashboard still renders.
  const [
    data,
    eligibleRecruitments,
    userNotifications,
    unreadCount,
    userPlans,
    chatSessions,
    nextActions,
    missionControlData,
  ] = await Promise.all([
    getDashboardData(user.id),
    getEligibleRecruitments(user.id),
    getUserNotifications(user.id, { limit: 20 }).catch(() => []),
    getUnreadCount(user.id).catch(() => 0),
    getUserPlans(user.id),
    getUserChatSessions(user.id, 5),
    getOrGenerateNextActions(user.id).catch(() => []),
    getMissionControlData(user.id),
  ])

  // Derive active plan before fetching tasks
  const primaryPlanCandidate = userPlans.find(p => p.status === "active") ?? userPlans[0] ?? null
  const todaysTasks = primaryPlanCandidate
    ? await getTodaysTasks(user.id, primaryPlanCandidate.id).catch(() => [])
    : []

  if (!data.profile?.onboarding_completed) redirect("/onboarding")

  // ── Derived values ─────────────────────────────────────────────────────────
  const isPaid      = data.profile?.plan_id === "pro" || data.profile?.plan_id === "elite"
  const lastSession = chatSessions[0] ?? null
  const primaryPlan = primaryPlanCandidate

  const planStats = primaryPlan
    ? await getPlanStats(primaryPlan.id, user.id).catch(() => null)
    : null

  const liveStats = {
    eligible_now: missionControlData.summary.eligibleNow,
    potential_matches: missionControlData.summary.profileBlockers,
    closing_soon: missionControlData.summary.closingThisWeek,
    today_tasks_done: todaysTasks.filter((t) => t.status === "done").length,
    today_tasks_total: todaysTasks.length,
    weekly_focus_minutes: Math.round((planStats?.totalHours ?? 0) * 60),
    latest_mock_score: null,
    profile_readiness_pct: Math.max(0, 100 - (missionControlData.summary.profileBlockers * 10)),
  }

  return (
    <DashboardShell
      data={data}
      userId={user.id}
      missionControlData={missionControlData}
      eligibleRecruitments={eligibleRecruitments}
      userAlerts={userNotifications}
      unreadCount={unreadCount}
      primaryPlan={primaryPlan}
      planStats={planStats}
      lastChatSessionId={lastSession?.id ?? null}
      isPaid={isPaid}
      nextActions={nextActions}
      todaysTasks={todaysTasks}
      liveStats={liveStats}
    />
  )
}
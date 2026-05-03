import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getMissionControlData } from "@/lib/db/mission-control"
import { getUserPlans, getPlanStats } from "@/lib/db/study-planner"
import { getTodaysTasks } from "@/lib/db/study-tasks"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [missionControlData, userPlans] = await Promise.all([
    getMissionControlData(user.id),
    getUserPlans(user.id),
  ])

  const primaryPlan = userPlans.find((p) => p.status === "active") ?? userPlans[0] ?? null
  const [todaysTasks, planStats] = await Promise.all([
    primaryPlan ? getTodaysTasks(user.id, primaryPlan.id).catch(() => []) : Promise.resolve([]),
    primaryPlan ? getPlanStats(primaryPlan.id, user.id).catch(() => null) : Promise.resolve(null),
  ])

  return NextResponse.json({
    eligible_now: missionControlData.summary.eligibleNow,
    potential_matches: missionControlData.summary.profileBlockers,
    closing_soon: missionControlData.summary.closingThisWeek,
    today_tasks_done: todaysTasks.filter((t) => t.status === "done").length,
    today_tasks_total: todaysTasks.length,
    weekly_focus_minutes: Math.round((planStats?.totalHours ?? 0) * 60),
    latest_mock_score: null,
    profile_readiness_pct: Math.max(0, 100 - (missionControlData.summary.profileBlockers * 10)),
  })
}

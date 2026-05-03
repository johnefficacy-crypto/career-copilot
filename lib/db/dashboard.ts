import { createClient } from "@/utils/supabase/server"

/**
 * All data needed to render the dashboard in one optimised fetch.
 * Called once from the dashboard Server Component.
 */
export async function getDashboardData(userId: string) {
  const supabase = await createClient()

  // Run independent queries in parallel
  const [
    profileResult,
    educationResult,
    experienceResult,
    preferencesResult,
    targetsResult,
    attemptsResult,
    notificationsResult,
  ] = await Promise.all([
    // Full profile
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single(),

    // Education records
    supabase
      .from("aspirant_education")
      .select("level, degree, stream, graduation_year, percentage, cgpa, is_completed")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .order("graduation_year", { ascending: false }),

    // Experience
    supabase
      .from("aspirant_experience")
      .select("sector, role, organization, years_experience")
      .eq("user_id", userId)
      .order("years_experience", { ascending: false }),

    // Preferences (target exams, sectors, states)
    supabase
      .from("aspirant_preferences")
      .select("preferred_sectors, preferred_states, target_exams, willing_to_relocate")
      .eq("user_id", userId)
      .single(),

    // Exams the user is targeting
    supabase
      .from("user_targets")
      .select(`
        id,
        status,
        recruitments (
          id,
          name,
          year,
          notification_date,
          apply_start_date,
          apply_end_date,
          status,
          organizations ( name, type )
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),

    // Attempt counts
    supabase
      .from("user_exam_attempts")
      .select("recruitment_id, attempts_used")
      .eq("user_id", userId),

    // Active + recently closed recruitments — for the notifications feed.
    // "closed" is included so that admin-approved items with past deadlines
    // (e.g. deputation posts scraped weeks after notification) still appear
    // on the dashboard instead of silently vanishing.
    supabase
      .from("recruitments")
      .select(`
        id,
        name,
        year,
        notification_date,
        apply_start_date,
        apply_end_date,
        status,
        organizations ( name, type )
      `)
      .in("status", ["upcoming", "open", "closed"])
      .order("notification_date", { ascending: false })
      .limit(8),
  ])

  return {
    profile: profileResult.data,
    education: educationResult.data ?? [],
    experience: experienceResult.data ?? [],
    preferences: preferencesResult.data,
    targets: targetsResult.data ?? [],
    attempts: attemptsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>
export type ProfileRow = NonNullable<DashboardData["profile"]>
export type TargetRow = DashboardData["targets"][number]
export type NotificationRow = DashboardData["notifications"][number]
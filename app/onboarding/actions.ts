"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import type { Database } from "@/types/supabase"

/* -------------------------------------------------------------------------- */
/*                               TYPE HELPERS                                 */
/* -------------------------------------------------------------------------- */

type DB = Database

type ProfileRow = DB["public"]["Tables"]["profiles"]["Row"]
type ProfileInsert = DB["public"]["Tables"]["profiles"]["Insert"]
type ProfileUpdate = DB["public"]["Tables"]["profiles"]["Update"]

/* -------------------------------------------------------------------------- */
/*                        AUTHENTICATED USER HELPER                           */
/* -------------------------------------------------------------------------- */

export async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/login")

  return { user, supabase }
}

/* -------------------------------------------------------------------------- */
/*                  ENSURE PROFILE ROW EXISTS (UPSERT SAFE)                   */
/* -------------------------------------------------------------------------- */
/*
Why UPSERT?
• Prevents race conditions
• Handles deleted rows automatically
• Fixes dashboard bypass bug
• Idempotent and safe to call anytime
*/

export async function ensureProfileRow(userId: string) {
  const supabase = await createClient()

  const row: ProfileInsert = { id: userId }

  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })

  if (error) throw error
}

/* -------------------------------------------------------------------------- */
/*                     STEP 0 — SAVE BASIC PROFILE                            */
/* -------------------------------------------------------------------------- */

export async function saveProfile(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    await ensureProfileRow(user.id)

    const updateData: ProfileUpdate = {
      full_name: formData.get("full_name") as string,
      career_stage: formData.get("career_stage") as string,
      target_type: formData.get("target_type") as string,
      target_exam: formData.get("target_exam") as string,
      graduation_year: formData.get("graduation_year")
        ? Number(formData.get("graduation_year"))
        : null,
      onboarding_step: 1,
      onboarding_completed: false,
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) throw error
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to save profile"
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/identity")
}

/* -------------------------------------------------------------------------- */
/*                     STEP 1 — SAVE IDENTITY INFO                            */
/* -------------------------------------------------------------------------- */

export async function saveIdentity(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser()

    const updateData: ProfileUpdate = {
      age_group: formData.get("age_group") as string,
      study_status: formData.get("study_status") as string,
      daily_study_hours: Number(formData.get("daily_study_hours")),
      onboarding_step: 2,
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) throw error
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to save identity"
    redirect(`/onboarding/identity?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/goals")
}

/* -------------------------------------------------------------------------- */
/*                       STEP 2 — SAVE GOALS                                  */
/* -------------------------------------------------------------------------- */

export async function saveGoals(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser()

    const updateData: ProfileUpdate = {
      primary_goal: formData.get("primary_goal") as string,
      attempt_year: Number(formData.get("attempt_year")),
      weekly_study_days: Number(formData.get("weekly_study_days")),
      onboarding_step: 3,
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) throw error
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to save goals"
    redirect(`/onboarding/goals?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/finish")
}

/* -------------------------------------------------------------------------- */
/*                  STEP 3 — COMPLETE ONBOARDING                              */
/* -------------------------------------------------------------------------- */

export async function completeOnboarding() {
  try {
    const { user, supabase } = await getAuthenticatedUser()

    const updateData: ProfileUpdate = {
      onboarding_completed: true,
      onboarding_step: 999,
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (error) throw error
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to complete onboarding"
    redirect(`/onboarding/finish?error=${encodeURIComponent(msg)}`)
  }

  redirect("/dashboard")
}
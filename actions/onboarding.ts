// "use server"

// /**
//  * actions/onboarding.ts — All onboarding server actions.
//  *
//  * RULES (never break these):
//  * 1. Always `await createClient()` with NO arguments.
//  * 2. Always resolve user inside the action — never trust client-supplied user_id.
//  * 3. Always redirect() on error — never throw to the client.
//  * 4. Field names must exactly match what the form inputs send via FormData.
//  *
//  * STEP CHAIN:
//  *   /onboarding          → saveProfile()     → /onboarding/identity
//  *   /onboarding/identity → saveIdentity()    → /onboarding/education
//  *   /onboarding/certifications→ (action.ts) → /onboarding/experience
//  *   /onboarding/experience → saveExperience()→ /onboarding/preferences
//  *   /onboarding/preferences→ savePreferences()→ /onboarding/complete
//  *   /onboarding/complete → finishOnboarding()→ /dashboard
//  */



"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import {
  ensureProfileRow,
  updateProfileBasic,
  updateProfileIdentity,
  advanceOnboardingStep,
  completeOnboarding,
  ONBOARDING_STEPS,
} from "@/lib/db/profiles"
import { replaceEducation } from "@/lib/db/education"
import { replaceExperience } from "@/lib/db/experience"
import { upsertPreferences } from "@/lib/db/preferences"
import { runEligibilityForUser } from "@/lib/eligibility/runner"
import type { EducationRowInsert, ExperienceRowInsert } from "@/types/onboarding"

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")
  return user
}

// ─── Step 1: Profile ──────────────────────────────────────────────────────────

export async function saveProfile(formData: FormData) {
  const user = await requireUser()
  await ensureProfileRow(user.id)

  try {
    await updateProfileBasic(user.id, {
      full_name:    (formData.get("full_name") as string).trim(),
      career_stage: formData.get("career_stage") as string,
      target_type:  (formData.get("target_type") as string) || null,
      target_exam:  (formData.get("target_exam") as string) || null,
    })
    // updateProfileBasic already sets onboarding_step = 1
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save profile"
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/identity")
}

// ─── Step 2: Identity ─────────────────────────────────────────────────────────

export async function saveIdentity(formData: FormData) {
  const user = await requireUser()

  try {
    // Phase 3B: parse service_years — only meaningful when ex_serviceman is true
    const exServiceman = formData.get("ex_serviceman") === "true"
    const serviceYearsRaw = formData.get("service_years") as string | null
    const serviceYears = exServiceman && serviceYearsRaw
      ? (parseInt(serviceYearsRaw, 10) || null)
      : null

    await updateProfileIdentity(user.id, {
      dob:            (formData.get("dob") as string) || null,
      gender:         (formData.get("gender") as string) || null,
      category:       (formData.get("category") as string) || null,
      pwbd_status:    (formData.get("pwbd_status") as string) || null,
      domicile_state: (formData.get("domicile_state") as string) || null,
      ex_serviceman:  exServiceman,
      service_years:  serviceYears,
      govt_employee:  formData.get("govt_employee") === "true",
      phone:          (formData.get("phone") as string) || null,
    })
    // updateProfileIdentity already sets onboarding_step = 2
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save identity"
    redirect(`/onboarding/identity?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/education")
}

// ─── Step 3: Education ────────────────────────────────────────────────────────
// FIX: was missing advanceOnboardingStep(3) — status bar never moved past step 2

export async function saveEducation(formData: FormData) {
  const user = await requireUser()

  const raw = formData.get("education_json") as string | null
  let records: EducationRowInsert[] = []

  if (raw) {
    try {
      records = JSON.parse(raw) as EducationRowInsert[]
    } catch {
      redirect("/onboarding/education?error=Invalid+education+data")
    }
  }

  try {
    await replaceEducation(user.id, records)
    // ← CRITICAL FIX: explicitly advance step to 3
    await advanceOnboardingStep(user.id, ONBOARDING_STEPS.EDUCATION)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save education"
    redirect(`/onboarding/education?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/experience")
}

// ─── Step 4: Experience ───────────────────────────────────────────────────────
// FIX: was missing advanceOnboardingStep(4)

export async function saveExperience(formData: FormData) {
  const user = await requireUser()

  const raw = formData.get("experience_json") as string | null
  let records: ExperienceRowInsert[] = []

  if (raw) {
    try {
      records = JSON.parse(raw) as ExperienceRowInsert[]
    } catch {
      redirect("/onboarding/experience?error=Invalid+experience+data")
    }
  }

  try {
    await replaceExperience(user.id, records)
    // ← CRITICAL FIX: explicitly advance step to 4
    await advanceOnboardingStep(user.id, ONBOARDING_STEPS.EXPERIENCE)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save experience"
    redirect(`/onboarding/experience?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/preferences")
}

// ─── Step 5: Preferences ──────────────────────────────────────────────────────
// FIX: was missing advanceOnboardingStep(5)

export async function savePreferences(formData: FormData) {
  const user = await requireUser()

  try {
    await upsertPreferences(user.id, {
      preferred_sectors:   formData.getAll("preferred_sectors") as string[],
      preferred_states:    formData.getAll("preferred_states") as string[],
      target_exams:        formData.getAll("target_exams") as string[],
      willing_to_relocate: formData.get("willing_to_relocate") !== "false",
    })
    // ← CRITICAL FIX: explicitly advance step to 5
    await advanceOnboardingStep(user.id, ONBOARDING_STEPS.PREFERENCES)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save preferences"
    redirect(`/onboarding/preferences?error=${encodeURIComponent(msg)}`)
  }

  redirect("/onboarding/complete")
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function finishOnboarding() {
  const user = await requireUser()

  try {
    await completeOnboarding(user.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to complete onboarding"
    redirect(`/onboarding/complete?error=${encodeURIComponent(msg)}`)
  }

  // Set cookie so proxy can do an optimistic onboarding check without a DB query
  const cookieStore = await cookies()
  cookieStore.set("onboarding_completed", "true", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  // Run eligibility engine so the dashboard shows matched recruitments immediately.
  // Non-fatal — if this fails the user still lands on the dashboard.
  // In production this should be offloaded to a background job, but for an
  // initial run (typically < 2 s against a small posts table) it's acceptable inline.
  try {
    await runEligibilityForUser(user.id)
  } catch (e) {
    console.error("[finishOnboarding] eligibility run failed (non-fatal):", e)
  }

  // Seed initial notifications so the dashboard isn't empty for new users.
  // Non-fatal — if this fails the user still lands on the dashboard.
  try {
    const { seedNotificationsForNewUser } = await import("@/lib/db/notifications")
    await seedNotificationsForNewUser(user.id)
  } catch (e) {
    console.error("[finishOnboarding] seed notifications failed (non-fatal):", e)
  }

  redirect("/dashboard")
}

// ─── Complete with career goal ────────────────────────────────────────────────
// Called from the final onboarding page. Saves the aspirant's career_goal
// narrative (optional) then runs the standard finish sequence.

export async function saveCareerGoalAndFinish(formData: FormData) {
  const user = await requireUser()
  const supabase = await createClient()

  const raw  = formData.get("career_goal")
  const goal = typeof raw === "string" ? raw.trim() : null

  // Save career_goal — non-fatal if the column doesn't exist yet on this DB
  if (goal) {
    try {
      await supabase
        .from("profiles")
        .update({ career_goal: goal })
        .eq("id", user.id)
    } catch (e) {
      console.error("[saveCareerGoalAndFinish] career_goal save failed (non-fatal):", e)
    }
  }

  // Re-use the full finish sequence
  try {
    await completeOnboarding(user.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to complete onboarding"
    redirect(`/onboarding/complete?error=${encodeURIComponent(msg)}`)
  }

  const cookieStore = await cookies()
  cookieStore.set("onboarding_completed", "true", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })

  try {
    await runEligibilityForUser(user.id)
  } catch (e) {
    console.error("[saveCareerGoalAndFinish] eligibility run failed (non-fatal):", e)
  }

  try {
    const { seedNotificationsForNewUser } = await import("@/lib/db/notifications")
    await seedNotificationsForNewUser(user.id)
  } catch (e) {
    console.error("[saveCareerGoalAndFinish] seed notifications failed (non-fatal):", e)
  }

  redirect("/dashboard")
}
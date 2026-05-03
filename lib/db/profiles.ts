import { createClient } from "@/utils/supabase/server"

// ─── Step constants ────────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = {
  PROFILE:     1,
  IDENTITY:    2,
  EDUCATION:   3,
  EXPERIENCE:  4,
  PREFERENCES: 5,
  COMPLETE:    99,
} as const

export type OnboardingStepValue =
  typeof ONBOARDING_STEPS[keyof typeof ONBOARDING_STEPS]

// ─── ensureProfileRow ─────────────────────────────────────────────────────────
//
// Two previous bugs, now fixed with a single approach:
//
// Bug 1 (RLS violation) — upsert with ignoreDuplicates: false:
//   Compiled to INSERT ... ON CONFLICT DO UPDATE.
//   PostgreSQL evaluates BOTH the INSERT policy WITH CHECK and the
//   UPDATE policy USING in one shot. USING requires the row to already
//   exist — it doesn't for a new user — so RLS blocks the whole statement.
//
// Bug 2 (duplicate key) — SELECT then INSERT:
//   SELECT returns null → race: another request inserts the row →
//   INSERT throws "duplicate key violates unique constraint profiles_pkey".
//   Happens when Google OAuth callback and onboarding form overlap.
//
// Fix — upsert with ignoreDuplicates: true:
//   Compiles to INSERT ... ON CONFLICT (id) DO NOTHING.
//   • Only the INSERT RLS policy is evaluated (WITH CHECK auth.uid() = id).
//   • The UPDATE RLS policy is never touched.
//   • If the row already exists, the conflict is silently skipped.
//   • Atomic — no race window between check and write.

export async function ensureProfileRow(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id:                   userId,
        onboarding_completed: false,
        onboarding_step:      0,
        plan_id:              "free",
      },
      {
        onConflict:       "id",
        ignoreDuplicates: true,  // INSERT ... ON CONFLICT DO NOTHING
      }
    )

  if (error) throw new Error(`ensureProfileRow: ${error.message}`)
}

// ─── Step writers ─────────────────────────────────────────────────────────────

export async function updateProfileBasic(
  userId: string,
  data: {
    full_name:        string
    career_stage:     string
    target_type:      string | null
    target_exam:      string | null
    graduation_year?: number | null
  }
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name:       data.full_name,
      career_stage:    data.career_stage,
      target_type:     data.target_type,
      target_exam:     data.target_exam,
      graduation_year: data.graduation_year ?? null,
      onboarding_step: ONBOARDING_STEPS.PROFILE,
    })
    .eq("id", userId)

  if (error) throw new Error(`updateProfileBasic: ${error.message}`)
}

export async function updateProfileIdentity(
  userId: string,
  data: {
    dob:            string | null
    gender:         string | null
    category:       string | null
    pwbd_status:    string | null
    domicile_state: string | null
    ex_serviceman:  boolean
    service_years:  number | null   // Phase 3B: for ex-serviceman age formula
    govt_employee:  boolean
    phone:          string | null
  }
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({
      dob:             data.dob,
      gender:          data.gender,
      category:        data.category,
      pwbd_status:     data.pwbd_status,
      domicile_state:  data.domicile_state,
      ex_serviceman:   data.ex_serviceman,
      service_years:   data.service_years,
      govt_employee:   data.govt_employee,
      phone:           data.phone,
      onboarding_step: ONBOARDING_STEPS.IDENTITY,
    })
    .eq("id", userId)

  if (error) throw new Error(`updateProfileIdentity: ${error.message}`)
}

/**
 * Generic step advancer.
 * Called explicitly after education, experience, and preferences steps
 * because those write to separate tables, not profiles directly.
 * The .lt() guard ensures the step never goes backwards.
 */
export async function advanceOnboardingStep(
  userId: string,
  step: OnboardingStepValue
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: step })
    .eq("id", userId)
    .lt("onboarding_step", step)

  if (error) throw new Error(`advanceOnboardingStep: ${error.message}`)
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_step:      ONBOARDING_STEPS.COMPLETE,
    })
    .eq("id", userId)

  if (error) throw new Error(`completeOnboarding: ${error.message}`)
}

export async function setOnboardingStep(userId: string, step: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from("profiles").update({ onboarding_step: step }).eq("id", userId)
}

// ─── Readers ──────────────────────────────────────────────────────────────────

export async function getProfileDraft(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, career_stage, target_exam, dob, gender, category, pwbd_status, domicile_state, ex_serviceman, govt_employee, phone, plan_id, is_admin, avatar_url, onboarding_step, onboarding_completed")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw new Error(`getProfileDraft: ${error.message}`)
  return data
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle()
  return data?.onboarding_completed === true
}

export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, career_stage, target_type, target_exam, dob, gender, category, pwbd_status, domicile_state, ex_serviceman, govt_employee, phone, onboarding_step, onboarding_completed, plan_id, is_admin, is_instructor, avatar_url")
    .eq("id", userId)
    .single()
  if (error) throw new Error(`getProfile: ${error.message}`)
  return data
}
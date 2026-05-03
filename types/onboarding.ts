/**
 * types/onboarding.ts
 *
 * Strict domain types for the onboarding flow.
 * All shapes are derived from the real Supabase schema (supabase.ts).
 * No invented fields, no schema assumptions.
 *
 * These types are used by:
 *  - Server Actions  (input validation + DB writes)
 *  - lib/db/*        (query return shapes)
 *  - onboarding pages (pre-fill from DB)
 *  - future eligibility engine (consume without transformation)
 */

// ─── Step constants ────────────────────────────────────────────────────────────
// Kept in sync with middleware + layout progress indicator

export const ONBOARDING_STEPS = {
  PROFILE:     1,
  IDENTITY:    2,
  EDUCATION:   3,
  EXPERIENCE:  4,
  PREFERENCES: 5,
  COMPLETE:    99,
} as const

export type OnboardingStepValue = typeof ONBOARDING_STEPS[keyof typeof ONBOARDING_STEPS]

// ─── Step 1: Profile ──────────────────────────────────────────────────────────

export type ProfileStepPayload = {
  full_name:    string
  career_stage: string
  target_type:  string | null
  target_exam:  string | null
}

// ─── Step 2: Identity ─────────────────────────────────────────────────────────

// PWBD values that match what eligibility engine will consume.
// "none" means not applicable.
export type PwbdStatus = "none" | "visual" | "hearing" | "locomotor" | "other"

export type IdentityStepPayload = {
  dob:            string | null   // ISO date e.g. "1998-07-15"
  gender:         string | null
  category:       string | null   // general | obc | sc | st | ews
  pwbd_status:    PwbdStatus | null
  domicile_state: string | null
  ex_serviceman:  boolean
  service_years:  number | null   // Phase 3B: years of military service for age formula
  govt_employee:  boolean
  phone:          string | null
}

// ─── Step 3: Education ────────────────────────────────────────────────────────

// Mirrors aspirant_education Insert shape exactly.
// All nullable fields are nullable here too.
export type EducationRowInsert = {
  level:           string          // required by DB
  degree:          string | null
  stream:          string | null
  institution:     string | null
  graduation_year: number | null
  percentage:      number | null
  cgpa:            number | null
  is_completed:    boolean
}

// What the client serialises into education_json
export type EducationStepPayload = EducationRowInsert[]

// What comes back from DB for pre-fill
export type EducationRowFromDB = EducationRowInsert & {
  id:      string
  user_id: string | null
}

// ─── Step 4: Experience ───────────────────────────────────────────────────────

// Mirrors aspirant_experience Insert shape.
// start_date and end_date are ISO date strings or null.
export type ExperienceRowInsert = {
  sector:           string | null
  role:             string | null
  organization:     string | null
  start_date:       string | null
  end_date:         string | null  // null = current job
  years_experience: number | null
}

// The form sends an array serialised as JSON.
export type ExperienceStepPayload = ExperienceRowInsert[]

// What comes back from DB for pre-fill
export type ExperienceRowFromDB = ExperienceRowInsert & {
  id:         string
  user_id:    string | null
  created_at: string | null
}

// ─── Step 5: Preferences ──────────────────────────────────────────────────────

// Schema-exact — no study_mode, no study_hours_per_day (not in DB)
export type PreferencesStepPayload = {
  preferred_sectors:   string[]
  preferred_states:    string[]
  target_exams:        string[]
  willing_to_relocate: boolean
}

// ─── Onboarding data aggregate (for layout / complete page) ───────────────────

export type OnboardingProfileDraft = {
  full_name:           string | null
  career_stage:        string | null
  target_exam:         string | null
  dob:                 string | null
  gender:              string | null
  category:            string | null
  pwbd_status:         string | null
  domicile_state:      string | null
  ex_serviceman:       boolean | null
  service_years:       number | null   // Phase 3B
  govt_employee:       boolean | null
  onboarding_step:     number
  onboarding_completed: boolean
}
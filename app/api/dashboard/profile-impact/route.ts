/**
 * GET /api/dashboard/profile-impact
 *
 * Returns missing profile fields and how many more recruitment opportunities
 * each field would unlock. Used by ProfileImpactCard on the dashboard.
 *
 * Logic:
 *   1. Load the user's profile + education rows.
 *   2. Identify which eligibility-critical fields are null/empty.
 *   3. Count open recruitments that have criteria requiring each missing field.
 *   4. Return sorted list of missing fields by impact (highest first).
 */

import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export type ProfileImpactField = {
  field:        string
  label:        string
  description:  string
  fillHref:     string
  impact:       number   // estimated additional recruitments unlocked
}

export type ProfileImpactResponse = {
  missing:          ProfileImpactField[]
  profilePct:       number
  openRecruitments: number
}

const ELIGIBILITY_FIELDS: {
  key:         string
  label:       string
  description: string
  fillHref:    string
  checkFn:     (p: Record<string, unknown>, edu: unknown[], creds: unknown[]) => boolean
}[] = [
  {
    key:         "dob",
    label:       "Date of birth",
    description: "Required to check age eligibility and category relaxations",
    fillHref:    "/onboarding/identity",
    checkFn:     (p) => !!p.dob,
  },
  {
    key:         "category",
    label:       "Category / caste",
    description: "Needed to apply SC/ST/OBC age and attempt relaxations",
    fillHref:    "/onboarding/identity",
    checkFn:     (p) => !!p.category,
  },
  {
    key:         "domicile_state",
    label:       "Domicile state",
    description: "Required for state-quota posts and domicile-restricted exams",
    fillHref:    "/onboarding/identity",
    checkFn:     (p) => !!p.domicile_state,
  },
  {
    key:         "education",
    label:       "Education details (with university/board)",
    description: "Degree, year, and marks needed to match education criteria",
    fillHref:    "/onboarding/education",
    checkFn:     (_p, edu) => edu.length > 0,
  },
  {
    key:         "gender",
    label:       "Gender",
    description: "Some posts have gender-specific vacancy allocations",
    fillHref:    "/onboarding/identity",
    checkFn:     (p) => !!p.gender,
  },
  {
    key:         "pwbd_status",
    label:       "PwBD status",
    description: "Unlocks PwBD reservation quota and age relaxations",
    fillHref:    "/onboarding/identity",
    checkFn:     (p) => !!p.pwbd_status,
  },
  {
    key:         "gate_score",
    label:       "GATE / eligibility exam credential",
    description: "Required for exam-score based recruitments (e.g., GATE-based posts)",
    fillHref:    "/onboarding/exam-credentials",
    checkFn:     (_p, _edu, creds) => creds.length > 0,
  },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profileRes, eduRes, credsRes, openCountRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("dob, category, domicile_state, gender, pwbd_status, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("education_records")
      .select("id")
      .eq("user_id", user.id),
    (supabase as unknown as { from: (table: string) => { select: (q: string) => { eq: (k: string, v: string) => Promise<{ data: unknown[] | null }> } } })
      .from("aspirant_exam_credentials")
      .select("id")
      .eq("user_id", user.id),
    supabase
      .from("recruitments")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "upcoming", "published"]),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const education = eduRes.data ?? []
  const credentials = credsRes.data ?? []
  const openRecruitments = openCountRes.count ?? 0

  // How many total eligibility-critical fields exist
  const totalFields = ELIGIBILITY_FIELDS.length
  const presentCount = ELIGIBILITY_FIELDS.filter(f => f.checkFn(profile, education, credentials)).length
  const profilePct = Math.round((presentCount / totalFields) * 100)

  // Build missing fields with estimated impact.
  // Impact is approximated: missing critical fields (dob, category, education)
  // block the most checks. We use a tiered estimate rather than running full
  // eligibility since that would be too expensive here.
  const IMPACT_WEIGHT: Record<string, number> = {
    dob:           0.90,
    category:      0.70,
    education:     0.80,
    domicile_state: 0.50,
    gender:        0.25,
    pwbd_status:   0.15,
    gate_score:    0.60,
  }

  const missing: ProfileImpactField[] = ELIGIBILITY_FIELDS
    .filter(f => !f.checkFn(profile, education, credentials))
    .map(f => ({
      field:       f.key,
      label:       f.label,
      description: f.description,
      fillHref:    f.fillHref,
      impact:      Math.round(openRecruitments * (IMPACT_WEIGHT[f.key] ?? 0.20)),
    }))
    .sort((a, b) => b.impact - a.impact)

  return NextResponse.json({ missing, profilePct, openRecruitments } satisfies ProfileImpactResponse)
}

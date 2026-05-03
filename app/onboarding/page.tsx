import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { saveProfile } from "@/actions/onboarding"

export const metadata = { title: "Your profile — Career Copilot" }

const CAREER_STAGES = [
  { value: "student",        label: "Student",              desc: "Currently in college or final year" },
  { value: "fresh_graduate", label: "Fresh graduate",       desc: "Graduated, not yet working"         },
  { value: "working",        label: "Working professional", desc: "Employed, preparing alongside job"  },
  { value: "full_time_prep", label: "Full-time aspirant",   desc: "Fully dedicated to exam preparation" },
]

const TARGET_TYPES = [
  { value: "central_govt", label: "Central government" },
  { value: "state_govt",   label: "State government"   },
  { value: "banking_psu",  label: "Banking / PSU"      },
  { value: "regulatory",   label: "Regulatory bodies"  },
  { value: "railways",     label: "Railways"            },
  { value: "defence",      label: "Defence"             },
  { value: "multiple",     label: "Multiple categories" },
]

export default async function OnboardingProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams

  // Load profile — autopopulate from:
  // 1. Existing profile row (revisit)
  // 2. user.user_metadata.full_name (Google OAuth or signUp data)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, career_stage, target_type, target_exam")
    .eq("id", user.id)
    .maybeSingle()

  // Autopopulate full name: profile > Google metadata > email prefix
  const defaultFullName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    ""

  return (
    <div className="animate-fadeUp">
      <h1 className="cc-page-title">Tell us about yourself</h1>
      <p className="cc-page-subtitle">
        Personalises your notification feed, eligibility matching, and study plan.
      </p>

      {params?.error && (
        <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
      )}

      {/* Autofill notice */}
      {!profile?.full_name && user.user_metadata?.full_name && (
        <div className="cc-alert-success" style={{ marginBottom: "1rem" }}>
          ✓ We have pre-filled your name from your Google account. You can edit it below.
        </div>
      )}

      <form action={saveProfile} className="cc-step-form">

        {/* Full name — autopopulated */}
        <div className="cc-field">
          <label htmlFor="full_name" className="cc-label">Full name *</label>
          <input id="full_name" name="full_name" type="text" required
            defaultValue={defaultFullName}
            placeholder="Rahul Sharma"
            autoComplete="name"
            className="cc-input" />
        </div>

        {/* Career stage */}
        <div className="cc-field">
          <span className="cc-section-label">Where are you right now? *</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CAREER_STAGES.map((s) => (
              <label key={s.value} className="cc-radio-card">
                <input type="radio" name="career_stage" value={s.value}
                  defaultChecked={profile?.career_stage === s.value} required />
                <div className="card-body">
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{s.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{s.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Target type */}
        <div className="cc-field">
          <span className="cc-section-label">Which exams are you targeting?</span>
          <div className="flex flex-wrap gap-2">
            {TARGET_TYPES.map((t) => (
              <label key={t.value} className="cc-radio-pill">
                <input type="radio" name="target_type" value={t.value}
                  defaultChecked={profile?.target_type === t.value} />
                <span className="pill-body">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Primary target exam */}
        <div className="cc-field">
          <label htmlFor="target_exam" className="cc-label">
            Primary exam you&apos;re targeting (optional)
          </label>
          <input id="target_exam" name="target_exam" type="text"
            defaultValue={profile?.target_exam ?? ""}
            placeholder="e.g. SEBI Grade A, RBI Grade B, UPSC CSE"
            className="cc-input" />
        </div>

        <div className="cc-form-nav">
          <div />
          <button type="submit" className="cc-btn-primary" style={{ width: "auto" }}>
            Continue →
          </button>
        </div>
      </form>
    </div>
  )
}
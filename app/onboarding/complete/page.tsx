import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { saveCareerGoalAndFinish } from "@/actions/onboarding"

// FIX: removed unused `runEligibilityForUser` import.
// Eligibility runs are triggered from the admin panel or dashboard —
// not inline during onboarding completion.

export const metadata = { title: "Almost there — Career Copilot" }

export default async function OnboardingCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, career_stage, category, dob, target_exam, career_goal")
    .eq("id", user.id)
    .maybeSingle()

  const completionItems: Array<{ label: string; value: string; done: boolean }> = [
    { label: "Name",          value: profile?.full_name    ?? "—", done: !!profile?.full_name    },
    { label: "Career stage",  value: profile?.career_stage ?? "—", done: !!profile?.career_stage },
    { label: "Category",      value: profile?.category     ?? "—", done: !!profile?.category     },
    { label: "Date of birth", value: profile?.dob          ?? "—", done: !!profile?.dob          },
    { label: "Target exam",   value: profile?.target_exam  ?? "Not set yet", done: !!profile?.target_exam },
  ]

  return (
    <div className="animate-fadeUp">

      {params?.error && (
        <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
      )}

      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 mb-5">
          <span className="text-2xl">🎯</span>
        </div>
        <h1 className="cc-page-title">Your profile is ready</h1>
        <p className="cc-page-subtitle">
          Review your details, then launch your personalised dashboard.
        </p>
      </div>

      {/* Summary */}
      <div className="cc-card-static mb-6">
        <span className="cc-section-label">Profile summary</span>
        <div className="flex flex-col gap-3 mt-2">
          {completionItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-white/40">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">{item.value}</span>
                {item.done
                  ? <span className="text-xs text-emerald-400">✓</span>
                  : <span className="text-xs text-white/20">—</span>
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="rounded-2xl border border-[#e8d5a3]/15 bg-[#e8d5a3]/[0.03] p-6 mb-8">
        <span className="cc-section-label" style={{ color: "rgba(232,213,163,0.60)" }}>
          What happens next
        </span>
        <ul className="flex flex-col gap-2.5 mt-3">
          {[
            "Your notification feed is populated with matched exams",
            "Eligibility engine runs against all open posts",
            "Your dashboard is ready with tailored insights",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-white/50">
              <span className="text-[#e8d5a3]/50 mt-0.5 shrink-0">→</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Career goal — the one question that personalises everything */}
      <div className="cc-card-static mb-8">
        <form action={saveCareerGoalAndFinish}>
          <div className="cc-field">
            <label htmlFor="career_goal" className="cc-section-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              One last thing — what&apos;s your bigger goal? <span className="text-white/25 font-normal">(optional)</span>
            </label>
            <p className="text-xs mb-3" style={{ color: "var(--text-ghost)" }}>
              Beyond clearing the exam — what do you want to achieve? Write in any language, however feels natural.
            </p>
            <textarea
              id="career_goal"
              name="career_goal"
              rows={3}
              maxLength={400}
              defaultValue={profile?.career_goal ?? ""}
              className="cc-input"
              style={{ resize: "none", lineHeight: "1.6" }}
              placeholder="e.g. I want to become an IAS officer and serve my home district as a collector.

Hindi: Main IAS officer banna chahta hoon aur apne zile ke logon ki seva karna chahta hoon.

Tamil: Naan oru IAS officer aaga virumbugireen, en makkalukkaga seiya virumbugireen.

Bengali: Ami IAS officer hote chai, aamar gram-er manushder jonno kaj korte chai."
            />
            <p className="text-xs mt-1.5 text-right" style={{ color: "var(--text-ghost)" }}>
              Used only to personalise your AI coaching — never shown publicly.
            </p>
          </div>

          <button
            type="submit"
            className="cc-btn-primary"
            style={{ fontSize: "1rem", padding: "0.875rem 2rem", marginTop: "0.5rem" }}
          >
            Go to my dashboard →
          </button>
        </form>
      </div>

      <div className="flex justify-center gap-6">
        <a href="/onboarding/preferences" className="cc-btn-link">← Edit preferences</a>
        <a href="/onboarding/education"   className="cc-btn-link">Edit education</a>
      </div>
    </div>
  )
}
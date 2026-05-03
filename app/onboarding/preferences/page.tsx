import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { savePreferences } from "@/actions/onboarding"

export const metadata = { title: "Preferences — Career Copilot" }

const JOB_TYPES = [
  { value: "CENTRAL_GOVT", label: "Central Govt" },
  { value: "STATE_GOVT", label: "State Govt" },
  { value: "PSU", label: "PSU" },
  { value: "REGULATORY", label: "Regulatory" },
  { value: "BANKING", label: "Banking / PSU" },
]

const TARGET_EXAMS = [
  "UPSC CSE",
  "SSC CGL",
  "IBPS PO",
  "SBI PO",
  "RBI Grade B",
  "SEBI Grade A",
  "NABARD Grade A",
  "Railway",
  "State PSC",
]

const STATES_OF_INDIA = [
  "All India",
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
]

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const params = await searchParams

  const { data: prefs } = await supabase
    .from("aspirant_preferences")
    .select("preferred_sectors, preferred_states, target_exams, willing_to_relocate")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="animate-fadeUp">
      <h1 className="cc-page-title">Job preferences</h1>
      <p className="cc-page-subtitle">
        We use these to filter notifications and personalise your dashboard.
      </p>

      {params?.error && (
        <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
      )}

      <form action={savePreferences} className="cc-step-form">
        <div className="cc-field">
          <span className="cc-section-label">Target job types</span>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map((jt) => (
              <label key={jt.value} className="cc-radio-pill">
                <input
                  type="checkbox"
                  name="preferred_sectors"
                  value={jt.value}
                  defaultChecked={prefs?.preferred_sectors?.includes(jt.value)}
                  className="sr-only"
                />
                <span className="pill-body">{jt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="cc-field">
          <span className="cc-section-label">Preferred job locations</span>
          <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--text-ghost)" }}>
            Select states where you want to work. Leave blank for all-India.
          </p>
          <div
            className="flex flex-wrap gap-2 overflow-y-auto pr-1"
            style={{ maxHeight: "240px" }}
          >
            {STATES_OF_INDIA.map((s) => (
              <label key={s} className="cc-radio-pill">
                <input
                  type="checkbox"
                  name="preferred_states"
                  value={s}
                  defaultChecked={prefs?.preferred_states?.includes(s)}
                  className="sr-only"
                />
                <span className="pill-body">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="cc-field">
          <span className="cc-section-label">Target exams</span>
          <div className="flex flex-wrap gap-2">
            {TARGET_EXAMS.map((exam) => (
              <label key={exam} className="cc-radio-pill">
                <input
                  type="checkbox"
                  name="target_exams"
                  value={exam}
                  defaultChecked={prefs?.target_exams?.includes(exam)}
                  className="sr-only"
                />
                <span className="pill-body">{exam}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="cc-checkbox-row">
          <input
            type="checkbox"
            name="willing_to_relocate"
            value="true"
            defaultChecked={prefs?.willing_to_relocate ?? true}
          />
          <span>Willing to relocate anywhere in India</span>
        </label>

        <div className="cc-form-nav">
          <a href="/onboarding/experience" className="cc-btn-link">← Back</a>
          <button type="submit" className="cc-btn-primary" style={{ width: "auto" }}>
            Continue →
          </button>
        </div>
      </form>
    </div>
  )
}
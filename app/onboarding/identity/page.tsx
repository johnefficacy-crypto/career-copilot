import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { saveIdentity } from "@/actions/onboarding"
import {
  getReservationCategories,
  getStateReservationNote,
  PWBD_CATEGORIES,
} from "@/lib/data/reservation-categories"
import { ExServicemanFields } from "./ExServicemanFields"

export const metadata = { title: "Identity & eligibility — Career Copilot" }

const GENDERS = [
  { value: "male",           label: "Male"              },
  { value: "female",         label: "Female"            },
  { value: "transgender",    label: "Transgender"       },
  { value: "prefer_not_say", label: "Prefer not to say" },
]

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Andaman & Nicobar Islands",
]

export default async function IdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams

  // Load existing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("dob, gender, category, pwbd_status, domicile_state, ex_serviceman, service_years, govt_employee, phone, target_type")
    .eq("id", user.id)
    .maybeSingle()

  // Get state-appropriate reservation categories
  const reservationCategories = getReservationCategories(
    profile?.domicile_state,
    profile?.target_type
  )
  const reservationNote = getStateReservationNote(profile?.domicile_state)

  const exServiceman = profile?.ex_serviceman ?? false
  const govtEmployee = profile?.govt_employee ?? false
  const serviceYears = profile?.service_years ?? null

  return (
    <div className="animate-fadeUp">
      <h1 className="cc-page-title">Identity &amp; eligibility details</h1>
      <p className="cc-page-subtitle">
        Used to compute age relaxation, reservation benefits, and attempt limits.
        All data is private and encrypted.
      </p>

      {params?.error && (
        <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
      )}

      {/* DPDP Act 2023 consent notice — required before collecting personal data */}
      <div className="cc-alert-info" style={{ fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <strong>Data notice (DPDP Act 2023):</strong> The information below is used solely to match
        you with eligible government job notifications. It is stored securely and never shared with
        third parties. You can delete your account and all associated data at any time from{" "}
        <a href="/account/delete" style={{ color: "var(--accent)", textDecoration: "underline" }}>
          Account settings
        </a>.
      </div>

      <form action={saveIdentity} className="cc-step-form">

        {/* DOB + Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="cc-field">
            <label htmlFor="dob" className="cc-label">Date of birth *</label>
            <input id="dob" name="dob" type="date" required
              defaultValue={profile?.dob ?? ""}
              className="cc-input" />
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>
              Used to verify age cutoffs &amp; relaxation
            </p>
          </div>
          <div className="cc-field">
            <label htmlFor="gender" className="cc-label">Gender</label>
            <select id="gender" name="gender"
              defaultValue={profile?.gender ?? ""}
              className="cc-select">
              <option value="">Select…</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Domicile state */}
        <div className="cc-field">
          <label htmlFor="domicile_state" className="cc-label">Domicile state</label>
          <select id="domicile_state" name="domicile_state"
            defaultValue={profile?.domicile_state ?? ""}
            className="cc-select">
            <option value="">Select state…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>
            Affects which state-specific reservation categories appear below
          </p>
        </div>

        {/* Reservation category — state-aware */}
        <div className="cc-field">
          <span className="cc-section-label">Reservation category *</span>
          {reservationNote && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "var(--gold-faint)", border: "1px solid var(--gold-border)", color: "var(--gold-dim)" }}>
              ℹ {reservationNote}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {reservationCategories.map((c) => (
              <label key={c.value} className="cc-radio-pill" title={c.description}>
                <input type="radio" name="category" value={c.value}
                  defaultChecked={profile?.category === c.value} required />
                <span className="pill-body">
                  {c.label}
                  {c.age_relaxation_years ? (
                    <span className="ml-1.5 text-[10px] opacity-60">+{c.age_relaxation_years}yr</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-ghost)" }}>
            Hover over a category to see its description. Age relaxation shown in years.
          </p>
        </div>

        {/* PwBD — elaborate with RPwD Act 2016 categories */}
        <div className="cc-field">
          <label htmlFor="pwbd_status" className="cc-label">
            Person with Benchmark Disability (PwBD) — RPwD Act 2016
          </label>
          <select id="pwbd_status" name="pwbd_status"
            defaultValue={profile?.pwbd_status ?? "none"}
            className="cc-select">
            {PWBD_CATEGORIES.map((p) => (
              <option key={p.value} value={p.value} title={p.description}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>
            Categories per Rights of Persons with Disabilities Act 2016.
            Benchmark disability = 40% or more impairment as certified by medical authority.
            General: +10 yrs · OBC: +13 yrs · SC/ST: +15 yrs age relaxation.
          </p>
        </div>

        {/* Phone */}
        <div className="cc-field">
          <label htmlFor="phone" className="cc-label">Mobile number</label>
          <input id="phone" name="phone" type="tel"
            defaultValue={profile?.phone ?? ""}
            placeholder="+91 98765 43210"
            className="cc-input" />
        </div>

        {/* Boolean flags */}
        <div className="cc-field">
          <span className="cc-section-label">Additional eligibility flags</span>
          <div className="flex flex-col gap-3">
            {/* ExServicemanFields is a client component — handles checkbox toggle
                and conditionally renders the service_years input via useState */}
            <ExServicemanFields
              defaultChecked={exServiceman}
              defaultServiceYears={serviceYears}
            />

            <label className="cc-checkbox-row">
              <input type="checkbox" name="govt_employee" value="true"
                defaultChecked={govtEmployee} />
              <span>Currently employed in central or state government (+5 years age relaxation for many exams)</span>
            </label>
          </div>
        </div>

        <div className="cc-form-nav">
          <a href="/onboarding" className="cc-btn-link">← Back</a>
          <button type="submit" className="cc-btn-primary" style={{ width: "auto" }}>
            Continue →
          </button>
        </div>
      </form>
    </div>
  )
}
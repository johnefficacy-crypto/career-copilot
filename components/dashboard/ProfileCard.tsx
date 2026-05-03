import type { DashboardData, ProfileRow } from "@/lib/db/dashboard"
import { ageFromDob } from "@/lib/utils/dates"

interface Props {
  profile: ProfileRow | null
  education: DashboardData["education"]
  experience: DashboardData["experience"]
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "GEN",
  obc:     "OBC",
  sc:      "SC",
  st:      "ST",
  ews:     "EWS",
}

const EDU_LEVEL_LABELS: Record<string, string> = {
  graduate:      "Graduate",
  postgraduate:  "Post-Graduate",
  phd:           "PhD",
  diploma:       "Diploma",
  "12th":        "Class XII",
  "10th":        "Class X",
}

export function ProfileCard({ profile, education, experience }: Props) {
  if (!profile) return null

  const age = ageFromDob(profile.dob ?? profile.date_of_birth)
  const primaryEdu = education[0]
  const totalExp = experience.reduce((sum, e) => sum + (e.years_experience ?? 0), 0)

  const chips = [
    profile.category ? (CATEGORY_LABELS[profile.category.toLowerCase()] ?? profile.category.toUpperCase()) : null,
    profile.ex_serviceman ? "Ex-Serviceman" : null,
    profile.pwbd_status && profile.pwbd_status !== "none" ? "PwBD" : null,
    profile.govt_employee ? "Govt. Employee" : null,
    profile.domicile_state ?? null,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 flex items-center justify-center shrink-0">
          <span className="text-[#e8d5a3] text-base font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {profile.full_name?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-medium text-sm truncate">{profile.full_name}</p>
          <p className="text-white/40 text-xs">
            {profile.career_stage ?? "Aspirant"}
            {age ? ` · ${age} yrs` : ""}
          </p>
        </div>
      </div>

      {/* Category chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {chips.map((c) => (
            <span
              key={c}
              className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/50"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-4" />

      {/* Education */}
      {primaryEdu && (
        <div className="mb-3">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Education</p>
          <p className="text-white/70 text-sm">
            {primaryEdu.degree ?? EDU_LEVEL_LABELS[primaryEdu.level] ?? primaryEdu.level}
          </p>
          {primaryEdu.stream && (
            <p className="text-white/35 text-xs">{primaryEdu.stream}</p>
          )}
          {primaryEdu.graduation_year && (
            <p className="text-white/25 text-xs">{primaryEdu.graduation_year}</p>
          )}
        </div>
      )}

      {/* Experience */}
      {totalExp > 0 && (
        <div className="mb-3">
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Experience</p>
          <p className="text-white/70 text-sm">{totalExp} yr{totalExp !== 1 ? "s" : ""}</p>
          {experience[0]?.sector && (
            <p className="text-white/35 text-xs">{experience[0].sector}</p>
          )}
        </div>
      )}

      {/* Target exam */}
      {profile.target_exam && (
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Primary goal</p>
          <p className="text-white/70 text-sm">{profile.target_exam}</p>
        </div>
      )}

      {/* Edit link */}
      <div className="mt-4 pt-3 border-t border-white/[0.05]">
        <a
          href="/onboarding"
          className="text-[#e8d5a3]/50 text-xs hover:text-[#e8d5a3] transition-colors"
        >
          Edit profile →
        </a>
      </div>
    </div>
  )
}
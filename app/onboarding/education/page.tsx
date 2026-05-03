// import { createClient } from "@/utils/supabase/server"
// import { redirect } from "next/navigation"
// import EducationStep from "./EducationStep"
// import { saveEducation } from "@/actions/onboarding"

// export const metadata = { title: "Education — Career Copilot" }

// type EducationRecord = {
//   level: string
//   degree?: string | null
//   stream?: string | null
//   institution?: string | null
//   graduation_year?: number | null
//   percentage?: number | null
//   cgpa?: number | null
//   is_completed?: boolean
// }

// export default async function EducationPage({
//   searchParams,
// }: {
//   searchParams: Promise<{ error?: string }>
// }) {
//   const supabase = await createClient()
//   const {
//     data: { user },
//   } = await supabase.auth.getUser()

//   if (!user) redirect("/auth/login")

//   const params = await searchParams

//   const { data: existing, error } = await supabase
//     .from("aspirant_education")
//     .select("level, degree, stream, institution, graduation_year, percentage, cgpa, is_completed")
//     .eq("user_id", user.id)
//     .order("graduation_year", { ascending: true })

//   if (error) {
//     redirect(`/onboarding/education?error=${encodeURIComponent(error.message)}`)
//   }

//   const initialRecords: EducationRecord[] =
//     (existing ?? []).map((row) => ({
//       level: row.level,
//       degree: row.degree,
//       stream: row.stream,
//       institution: row.institution,
//       graduation_year: row.graduation_year,
//       percentage: row.percentage,
//       cgpa: row.cgpa,
//       is_completed: row.is_completed ?? undefined,
//     }))

//   return (
//     <div className="animate-fadeUp">
//       <h1 className="cc-page-title">Education details</h1>
//       <p className="cc-page-subtitle">
//         We use your education history to verify eligibility for every exam automatically.
//       </p>

//       {params?.error && (
//         <div className="cc-alert-error">{decodeURIComponent(params.error)}</div>
//       )}

//       <EducationStep action={saveEducation} initialRecords={initialRecords} />
//     </div>
//   )
// }


import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { saveEducation } from "@/actions/onboarding"
import { getEducation } from "@/lib/db/education"
import { EducationStep } from "@/components/onboarding/EducationStep"
import type { EducationRowInsert } from "@/types/onboarding"

export const metadata = { title: "Education — Career Copilot" }

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const params = await searchParams

  // Load existing records for pre-fill on revisit
  const existing = await getEducation(user.id)

  // Map DB rows → insert shape (strip id and user_id, which client doesn't need)
  const initial: EducationRowInsert[] = existing.map((row) => ({
    level:           row.level,
    degree:          row.degree,
    stream:          row.stream,
    institution:     row.institution,
    graduation_year: row.graduation_year,
    percentage:      row.percentage,
    cgpa:            row.cgpa,
    is_completed:    row.is_completed ?? false,
  }))

  return (
    <div className="animate-fadeUp">
      <h1 className="cc-page-title">Education history</h1>
      <p className="cc-page-subtitle">
        Add all completed and in-progress qualifications.
        These are used to verify eligibility for each post.
      </p>

      <EducationStep
        initial={initial}
        action={saveEducation}
        error={params?.error ?? null}
      />
    </div>
  )
}
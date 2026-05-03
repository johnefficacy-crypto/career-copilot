// import Link from "next/link"
// import { redirect } from "next/navigation"
// import { createClient } from "@/utils/supabase/server"

// const STEPS = [
//   { path: "/onboarding",              label: "Profile"      },
//   { path: "/onboarding/identity",     label: "Identity"     },
//   { path: "/onboarding/education",    label: "Education"    },
//   { path: "/onboarding/experience",   label: "Experience"   },
//   { path: "/onboarding/preferences",  label: "Preferences"  },
//   { path: "/onboarding/complete",     label: "Done"         },
// ]

// function getStepIndex(pathname: string): number {
//   const idx = STEPS.findIndex((s) => s.path === pathname)
//   return idx === -1 ? 0 : idx
// }

// export default async function OnboardingLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   const supabase = await createClient()
//   const { data: { user } } = await supabase.auth.getUser()
//   if (!user) redirect("/auth/login")

//   // If already completed, send to dashboard
//   const { data: profile } = await supabase
//     .from("profiles")
//     .select("onboarding_completed, onboarding_step")
//     .eq("id", user.id)
//     .single()

//   if (profile?.onboarding_completed) redirect("/dashboard")

//   return (
//     <div className="min-h-screen bg-[#0c0c0c]">

//       {/* Top bar */}
//       <div className="border-b border-white/[0.06] h-14 flex items-center px-6 justify-between">
//         <Link href="/" className="text-[#e8d5a3] font-serif text-lg font-medium">
//           Career Copilot
//         </Link>
//         <p className="text-white/30 text-xs">
//           Setting up your profile
//         </p>
//       </div>

//       {/* Step progress */}
//       <div className="max-w-2xl mx-auto px-6 pt-10 pb-6">
//         <div className="flex items-center gap-0">
//           {STEPS.map((step, i) => {
//             const stepNum = profile?.onboarding_step ?? 0
//             const done    = i < stepNum
//             const active  = i === stepNum

//             return (
//               <div key={step.path} className="flex items-center flex-1 last:flex-none">
//                 <div className="flex flex-col items-center gap-1.5">
//                   <div
//                     className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
//                       done
//                         ? "bg-[#e8d5a3] text-[#0c0c0c]"
//                         : active
//                         ? "border-2 border-[#e8d5a3] text-[#e8d5a3]"
//                         : "border border-white/[0.12] text-white/20"
//                     }`}
//                   >
//                     {done ? "✓" : i + 1}
//                   </div>
//                   <span className={`text-[10px] hidden sm:block ${active ? "text-[#e8d5a3]/70" : "text-white/20"}`}>
//                     {step.label}
//                   </span>
//                 </div>
//                 {i < STEPS.length - 1 && (
//                   <div className={`flex-1 h-px mx-2 mb-4 ${i < stepNum ? "bg-[#e8d5a3]/30" : "bg-white/[0.08]"}`} />
//                 )}
//               </div>
//             )
//           })}
//         </div>
//       </div>

//       {/* Step content */}
//       <main className="max-w-2xl mx-auto px-6 pb-20">
//         {children}
//       </main>
//     </div>
//   )
// }


import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { OnboardingProgress } from "./OnboardingProgress"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth guard — middleware also does this but belt-and-suspenders
  if (!user) redirect("/auth/login")

  // Fetch profile to check completion state (no redirect — users can re-visit)
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-[#0c0c0c]">
      {/* Top bar */}
      <div
        className="border-b h-14 flex items-center px-6 justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="cc-logo">Career Copilot</Link>
          {profile?.onboarding_completed && (
            <Link href="/dashboard" className="text-xs" style={{ color: "var(--text-dim)" }}>
              ← Dashboard
            </Link>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          {profile?.onboarding_completed ? "Edit your profile" : "Setting up your profile"}
        </p>
      </div>

      {/* Step progress — client component reads usePathname() so it updates
          on every navigation without the layout re-rendering from the server */}
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-4">
        <OnboardingProgress />
      </div>

      {/* Page content */}
      <main className="max-w-2xl mx-auto px-6 pb-20">
        {children}
      </main>
    </div>
  )
}
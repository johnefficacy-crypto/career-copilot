import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export const metadata = { title: "Support — Career Copilot" }

const ITEMS = [
  {
    title: "Wrong eligibility or exam match",
    description: "Use recruitment feedback to flag wrong matches, deadline issues, or broken official links.",
    href: "/dashboard/notifications",
    cta: "Open notifications & report",
  },
  {
    title: "Missing profile fields affecting eligibility",
    description: "Update identity and education details to improve confidence and reduce conditional matches.",
    href: "/onboarding/identity",
    cta: "Complete profile",
  },
  {
    title: "Community/report safety issue",
    description: "Report harmful, misleading, or spam content from community discussions.",
    href: "/forum",
    cta: "Go to forum",
  },
] as const

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">Support & issue resolution</h1>
      <p className="text-sm text-white/60 mb-6">
        Deterministic support paths for eligibility confidence, recruitment data issues, and community safety.
      </p>

      <div className="space-y-4">
        {ITEMS.map((item) => (
          <section key={item.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-white text-base font-medium">{item.title}</h2>
            <p className="mt-1 text-sm text-white/65">{item.description}</p>
            <Link href={item.href} className="mt-3 inline-flex text-sm text-[#e8d5a3] hover:text-[#f5e7bc]">
              {item.cta} →
            </Link>
          </section>
        ))}
      </div>
    </div>
  )
}

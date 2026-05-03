/**
 * app/pricing/page.tsx
 *
 * FIXED: Was exported as `.ts` with no React component — Next.js threw:
 *   "The default export is not a React Component in /pricing/page"
 *
 * This file must be .tsx with a default export that is a React component.
 */

import { createClient } from "@/utils/supabase/server"
import { PLAN_LIST, limitLabel } from "@/lib/billing/plans"
import { getUserPlanId } from "@/lib/db/billing"
import { PricingCards } from "@/components/billing/PricingCards"

export const metadata = { title: "Pricing — Career Copilot" }

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentPlanId = user ? await getUserPlanId(user.id) : "free"
  const params = await searchParams

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <nav
        className="border-b h-14 flex items-center px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <a
          href="/dashboard"
          className="text-lg font-medium"
          style={{ fontFamily: "var(--font-serif)", color: "var(--gold)" }}
        >
          Career Copilot
        </a>
        {user && (
          <a
            href="/dashboard"
            className="ml-auto text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            ← Dashboard
          </a>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <h1
            className="text-white text-4xl font-medium mb-3"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Simple, honest pricing
          </h1>
          <p
            className="text-base max-w-lg mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            Built for Indian aspirants. Cancel anytime. No hidden fees.
            Pay via UPI, NetBanking, or card.
          </p>
        </div>

        {params?.error && (
          <div className="cc-alert-error mb-8 max-w-2xl mx-auto">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Pricing cards */}
        <PricingCards
          plans={PLAN_LIST}
          currentPlanId={currentPlanId}
          isLoggedIn={!!user}
        />

        {/* Feature comparison table */}
        <div className="mt-20">
          <h2
            className="text-white text-xl font-medium text-center mb-8"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Full comparison
          </h2>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="grid grid-cols-4"
              style={{
                background: "var(--bg-surface)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                className="px-5 py-3 text-xs uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                Feature
              </div>
              {PLAN_LIST.map((p) => (
                <div key={p.id} className="px-5 py-3 text-center">
                  <p className="text-white text-sm font-medium">{p.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {p.price_inr === 0 ? "Free" : `₹${p.price_inr}/mo`}
                  </p>
                </div>
              ))}
            </div>

            {/* Rows */}
            {([
              { label: "Study plans",          key: "study_plans_limit",             isLimit: true  },
              { label: "AI regenerations/mo",  key: "plan_regenerations_per_month",  isLimit: true  },
              { label: "Exam notifications",   key: "notifications_limit",           isLimit: true  },
              { label: "Eligibility matching", key: "eligibility_checks",            isLimit: false },
              { label: "AI career chat",        key: "ai_chat",                       isLimit: false },
              { label: "Course marketplace",   key: "marketplace_access",            isLimit: false },
              { label: "Download plan as PDF", key: "download_plan_pdf",             isLimit: false },
              { label: "Priority support",     key: "priority_support",              isLimit: false },
            ] as const).map((row, i) => (
              <div
                key={row.key}
                className="grid grid-cols-4"
                style={{
                  borderBottom: i < 7 ? "1px solid var(--border)" : undefined,
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                }}
              >
                <div
                  className="px-5 py-3 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {row.label}
                </div>
                {PLAN_LIST.map((p) => {
                  const val = (p.features as Record<string, unknown>)[row.key]
                  let display: string
                  if (row.isLimit) {
                    display = limitLabel(val as number)
                  } else {
                    display = val ? "✓" : "—"
                  }
                  const positive = val === true || (typeof val === "number" && val !== 0)
                  return (
                    <div key={p.id} className="px-5 py-3 text-center">
                      <span
                        className="text-sm"
                        style={{ color: positive ? "rgba(255,255,255,0.70)" : "var(--text-ghost)" }}
                      >
                        {display}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: "🔒", title: "Secure payments",  desc: "Powered by Razorpay. UPI, NetBanking, Cards accepted." },
            { icon: "↩", title: "Cancel anytime",   desc: "No lock-in. Cancel in one click. Access until period ends." },
            { icon: "₹",  title: "INR pricing",      desc: "All prices in Indian Rupees, GST inclusive." },
          ].map((t) => (
            <div key={t.title} className="flex gap-3">
              <span className="text-2xl opacity-40 shrink-0">{t.icon}</span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "rgba(255,255,255,0.70)" }}
                >
                  {t.title}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  {t.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
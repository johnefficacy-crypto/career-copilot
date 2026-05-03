import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getUserSubscription, getPaymentHistory } from "@/lib/db/billing"
import { cancelUserSubscription } from "@/actions/billing"
import { PLANS } from "@/lib/billing/plans"
import { formatDate } from "@/lib/utils/dates"

export const metadata = { title: "Billing — Career Copilot" }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { success, error } = await searchParams
  const [profileRes, subscription, payments] = await Promise.all([
    supabase.from("profiles").select("plan_id, full_name").eq("id", user.id).single(),
    getUserSubscription(user.id),
    getPaymentHistory(user.id),
  ])

  const profile    = profileRes.data
  const planId     = profile?.plan_id ?? "free"
  const plan       = PLANS[planId as keyof typeof PLANS] ?? PLANS.free
  const isFree     = planId === "free"
  const isCancelling = subscription?.cancel_at_period_end === true

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60 transition-colors mb-6 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-white text-3xl font-medium mb-8"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Billing & plan
        </h1>

        {/* Alerts */}
        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {decodeURIComponent(success)}
          </div>
        )}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {decodeURIComponent(error)}
          </div>
        )}

        {/* Current plan card */}
        <div className={`rounded-2xl border p-6 mb-5 ${
          isFree
            ? "border-white/[0.07] bg-white/[0.02]"
            : "border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.03]"
        }`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white text-xl font-medium"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {plan.name}
                </span>
                {!isFree && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#e8d5a3]/10 border border-[#e8d5a3]/20 text-[#e8d5a3]/70">
                    Active
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm">
                {isFree
                  ? "You&apos;re on the free plan"
                  : `₹${plan.price_inr}/month · billed monthly`}
              </p>
            </div>

            {!isFree && !isCancelling && (
              <Link
                href="/pricing"
                className="text-[#e8d5a3]/50 text-xs hover:text-[#e8d5a3] transition-colors"
              >
                Change plan
              </Link>
            )}
          </div>

          {/* Subscription period */}
          {subscription && !isFree && (
            <div className="flex flex-col gap-1 text-sm text-white/40 mb-4">
              {subscription.current_period_start && (
                <span>Period started: {formatDate(subscription.current_period_start as string)}</span>
              )}
              {subscription.current_period_end && (
                <span className={isCancelling ? "text-amber-300" : ""}>
                  {isCancelling ? "Access until: " : "Renews: "}
                  {formatDate(subscription.current_period_end as string)}
                </span>
              )}
            </div>
          )}

          {isCancelling && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-4">
              Your subscription is cancelled and will not renew. You&apos;ll keep access until the end of this billing period.
            </div>
          )}

          {/* Actions */}
          {isFree ? (
            <Link
              href="/pricing"
              className="inline-block px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
            >
              Upgrade to Pro →
            </Link>
          ) : !isCancelling ? (
            <form action={cancelUserSubscription}>
              <button
                type="submit"
                className="text-red-400/50 text-xs hover:text-red-400 transition-colors"
                onClick={(e) => {
                  if (!confirm("Cancel subscription? You'll keep access until the end of your billing period.")) {
                    e.preventDefault()
                  }
                }}
              >
                Cancel subscription
              </button>
            </form>
          ) : null}
        </div>

        {/* Feature summary for current plan */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">What&apos;s included</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Study plans",        val: plan.features.study_plans_limit === -1 ? "Unlimited" : plan.features.study_plans_limit },
              { label: "AI regenerations",   val: plan.features.plan_regenerations_per_month === -1 ? "Unlimited" : `${plan.features.plan_regenerations_per_month}/mo` },
              { label: "Notifications",      val: plan.features.notifications_limit === -1 ? "All exams" : `${plan.features.notifications_limit} exams` },
              { label: "AI career chat",     val: plan.features.ai_chat ? "Included" : "Not included" },
              { label: "Marketplace",        val: plan.features.marketplace_access ? "Included" : "Not included" },
              { label: "Priority support",   val: plan.features.priority_support ? "Included" : "Not included" },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                <span className="text-white/40 text-xs">{f.label}</span>
                <span className="text-white/60 text-xs">{f.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Payment history</p>
            <div className="flex flex-col gap-2">
              {payments.map((p: { id: string; created_at: string | null; razorpay_payment_id: string | null; status: string; amount_inr: number }) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white/60">{p.created_at ? formatDate(p.created_at) : "—"}</span>
                    <span className="text-white/25 text-xs ml-2 font-mono">{p.razorpay_payment_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      p.status === "captured"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {p.status}
                    </span>
                    <span className="text-white/60 tabular-nums">₹{p.amount_inr}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
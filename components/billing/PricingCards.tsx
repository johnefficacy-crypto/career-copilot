"use client"

/**
 * components/billing/PricingCards.tsx
 *
 * Renders the three plan cards (Free / Pro / Elite).
 * Handles the full Razorpay checkout flow client-side:
 *   1. User clicks "Upgrade"
 *   2. Calls initiateSubscription (server action) to create a Razorpay subscription
 *   3. Dynamically loads Razorpay checkout.js
 *   4. Opens the payment modal
 *   5. On success, refreshes the page to reflect new plan
 *
 * Design: dark premium, editorial, gold accent.
 * The Pro card is visually elevated with a gold ring and a "Most popular" badge.
 */

import { useState, useCallback } from "react"
import Link from "next/link"
import { initiateSubscription } from "@/actions/billing"
import type { Plan, PlanId } from "@/lib/billing/plans"

// ─── Razorpay local types ─────────────────────────────────────────────────────

type PricingRazorpayOptions = {
  key:             string
  subscription_id: string
  name:            string
  description:     string
  image?:          string
  prefill?: {
    name?:    string
    email?:   string
    contact?: string
  }
  theme?: { color: string }
  handler:   (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => void
  modal?: { ondismiss?: () => void; escape?: boolean }
}

interface RazorpayResponse {
  razorpay_payment_id:    string
  razorpay_subscription_id: string
  razorpay_signature:     string
}

interface RazorpayInstance {
  open:  () => void
  close: () => void
}

// ─── Feature rows shown on each card ─────────────────────────────────────────

type FeatureRow = {
  label:  string
  free:   string | boolean
  pro:    string | boolean
  elite:  string | boolean
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Exam notifications",      free: "5 exams",    pro: "All exams",   elite: "All exams"   },
  { label: "Eligibility matching",    free: true,         pro: true,          elite: true          },
  { label: "Study plans",             free: "1",          pro: "5",           elite: "Unlimited"   },
  { label: "AI plan regenerations",   free: "1 / month",  pro: "10 / month",  elite: "Unlimited"   },
  { label: "AI career chat",          free: false,        pro: true,          elite: true          },
  { label: "Course marketplace",      free: false,        pro: true,          elite: true          },
  { label: "Download plan as PDF",    free: false,        pro: true,          elite: true          },
  { label: "Priority support",        free: false,        pro: false,         elite: true          },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  plans:         Plan[]
  currentPlanId: string
  isLoggedIn:    boolean
}

// ─── Load Razorpay script once ────────────────────────────────────────────────

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement("script")
    script.src     = "https://checkout.razorpay.com/v1/checkout.js"
    script.async   = true
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// ─── PricingCards ─────────────────────────────────────────────────────────────

export function PricingCards({ plans, currentPlanId, isLoggedIn }: Props) {
  const [loadingPlanId, setLoadingPlanId] = useState<PlanId | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const handleUpgrade = useCallback(async (planId: PlanId) => {
    setError(null)
    setLoadingPlanId(planId)

    try {
      const fd = new FormData()
      fd.set("plan_id", planId)
      const result = await initiateSubscription(fd)

      if (!result.success || !result.subscriptionId || !result.keyId) {
        setError(result.error ?? "Could not initiate payment. Please try again.")
        setLoadingPlanId(null)
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setError("Could not load payment gateway. Check your connection.")
        setLoadingPlanId(null)
        return
      }

      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: PricingRazorpayOptions) => { open: () => void } }).Razorpay
      const rzp = new RazorpayConstructor({
        key:             result.keyId,
        subscription_id: result.subscriptionId,
        name:            "Career Copilot",
        description:     `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan — monthly`,
        theme:           { color: "#e8d5a3" },
        handler: () => {
          // Payment success — webhook will activate, reload to reflect new plan
          window.location.href = "/dashboard/billing?success=Subscription+activated"
        },
        modal: {
          ondismiss: () => setLoadingPlanId(null),
        },
      })

      rzp.open()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
      setLoadingPlanId(null)
    }
  }, [])

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="cc-alert-error mb-8 max-w-2xl mx-auto">
          {error}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId
          const isPro     = plan.id === "pro"
          const isElite   = plan.id === "elite"
          const isLoading = loadingPlanId === plan.id

          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={isCurrent}
              isPro={isPro}
              isElite={isElite}
              isLoading={isLoading}
              isLoggedIn={isLoggedIn}
              currentPlanId={currentPlanId}
              onUpgrade={handleUpgrade}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Individual plan card ─────────────────────────────────────────────────────

interface CardProps {
  plan:          Plan
  isCurrent:     boolean
  isPro:         boolean
  isElite:       boolean
  isLoading:     boolean
  isLoggedIn:    boolean
  currentPlanId: string
  onUpgrade:     (planId: PlanId) => void
}

function PlanCard({
  plan,
  isCurrent,
  isPro,
  isElite,
  isLoading,
  isLoggedIn,
  currentPlanId,
  onUpgrade,
}: CardProps) {
  // Determine which feature values to display
  const colKey = plan.id as "free" | "pro" | "elite"

  // Is this a downgrade?
  const planRank: Record<string, number> = { free: 0, pro: 1, elite: 2 }
  const isDowngrade = planRank[plan.id] < planRank[currentPlanId]

  return (
    <div
      className="relative rounded-2xl flex flex-col transition-all duration-200"
      style={{
        background: isPro
          ? "linear-gradient(145deg, rgba(232,213,163,0.06) 0%, rgba(232,213,163,0.02) 100%)"
          : "var(--bg-surface)",
        border: isPro
          ? "1px solid var(--gold-border-md)"
          : isElite
          ? "1px solid var(--border-md)"
          : "1px solid var(--border)",
        boxShadow: isPro ? "0 0 40px rgba(232,213,163,0.06)" : "none",
      }}
    >
      {/* Most popular badge */}
      {isPro && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium"
          style={{
            background: "var(--gold)",
            color: "#0c0c0c",
            whiteSpace: "nowrap",
          }}
        >
          Most popular
        </div>
      )}

      {/* Card header */}
      <div
        className="p-7 pb-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* Plan name */}
        <div className="flex items-center justify-between mb-5">
          <span
            className="text-xs uppercase tracking-[0.15em]"
            style={{ color: isPro ? "var(--gold)" : "var(--text-muted)" }}
          >
            {plan.name}
          </span>
          {isCurrent && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                color: "var(--success)",
              }}
            >
              Current plan
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end gap-1 mb-1">
          {plan.price_inr === 0 ? (
            <span
              className="text-4xl font-semibold"
              style={{ fontFamily: "var(--font-serif)", color: "white" }}
            >
              Free
            </span>
          ) : (
            <>
              <span
                className="text-xs mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                ₹
              </span>
              <span
                className="text-4xl font-semibold leading-none"
                style={{ fontFamily: "var(--font-serif)", color: "white" }}
              >
                {plan.price_inr.toLocaleString("en-IN")}
              </span>
              <span
                className="text-xs mb-2"
                style={{ color: "var(--text-dim)" }}
              >
                / month
              </span>
            </>
          )}
        </div>
        <p
          className="text-xs"
          style={{ color: "var(--text-ghost)" }}
        >
          {plan.price_inr === 0
            ? "No credit card required"
            : "Billed monthly · Cancel anytime · UPI / Card / NetBanking"}
        </p>

        {/* CTA button */}
        <div className="mt-5">
          <PlanCTA
            plan={plan}
            isCurrent={isCurrent}
            isDowngrade={isDowngrade}
            isLoading={isLoading}
            isLoggedIn={isLoggedIn}
            onUpgrade={onUpgrade}
          />
        </div>
      </div>

      {/* Features list */}
      <div className="p-7 pt-5 flex flex-col gap-3 flex-1">
        {FEATURE_ROWS.map((row) => {
          const val = row[colKey]
          const active = val !== false && val !== ""

          return (
            <div key={row.label} className="flex items-start gap-3">
              {/* Tick / cross */}
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 mt-0.5"
                style={{
                  background: active
                    ? isPro
                      ? "rgba(232,213,163,0.15)"
                      : "rgba(16,185,129,0.12)"
                    : "rgba(255,255,255,0.04)",
                  color: active
                    ? isPro ? "var(--gold)" : "var(--success)"
                    : "var(--text-ghost)",
                }}
              >
                {active ? "✓" : "—"}
              </div>

              <div className="flex flex-col min-w-0">
                <span
                  className="text-sm leading-snug"
                  style={{ color: active ? "rgba(255,255,255,0.75)" : "var(--text-ghost)" }}
                >
                  {row.label}
                </span>
                {typeof val === "string" && (
                  <span
                    className="text-xs mt-0.5"
                    style={{ color: isPro ? "var(--gold-dim)" : "var(--text-dim)" }}
                  >
                    {val}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CTA button per plan ──────────────────────────────────────────────────────

interface CTAProps {
  plan:        Plan
  isCurrent:   boolean
  isDowngrade: boolean
  isLoading:   boolean
  isLoggedIn:  boolean
  onUpgrade:   (planId: PlanId) => void
}

function PlanCTA({
  plan,
  isCurrent,
  isDowngrade,
  isLoading,
  isLoggedIn,
  onUpgrade,
}: CTAProps) {
  const isPro = plan.id === "pro"

  // Current plan
  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className="w-full py-3 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
        style={{
          background: "var(--bg-surface-md)",
          border: "1px solid var(--border-md)",
          color: "var(--text-muted)",
        }}
      >
        Current plan
      </button>
    )
  }

  // Free plan — not an upgrade target (downgrade or already free)
  if (plan.id === "free") {
    return (
      <button
        type="button"
        disabled
        className="w-full py-3 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-dim)",
        }}
      >
        Free plan
      </button>
    )
  }

  // Not logged in — redirect to signup
  if (!isLoggedIn) {
    return (
      <Link
        href={`/auth/signup?plan=${plan.id}`}
        className="block w-full py-3 rounded-xl text-sm font-medium text-center transition-all"
        style={
          isPro
            ? { background: "var(--gold)", color: "#0c0c0c" }
            : {
                background: "transparent",
                border: "1px solid var(--border-md)",
                color: "rgba(255,255,255,0.70)",
              }
        }
      >
        Get started →
      </Link>
    )
  }

  // Downgrade
  if (isDowngrade) {
    return (
      <button
        type="button"
        disabled
        className="w-full py-3 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed"
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--text-dim)",
        }}
      >
        Contact support to downgrade
      </button>
    )
  }

  // Upgrade — active
  return (
    <button
      type="button"
      onClick={() => onUpgrade(plan.id as PlanId)}
      disabled={isLoading}
      className="w-full py-3 rounded-xl text-sm font-medium transition-all"
      style={
        isPro
          ? {
              background: isLoading ? "rgba(232,213,163,0.6)" : "var(--gold)",
              color: "#0c0c0c",
              cursor: isLoading ? "not-allowed" : "pointer",
            }
          : {
              background: "transparent",
              border: "1px solid var(--border-md)",
              color: isLoading ? "var(--text-dim)" : "rgba(255,255,255,0.70)",
              cursor: isLoading ? "not-allowed" : "pointer",
            }
      }
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          Opening checkout…
        </span>
      ) : (
        `Upgrade to ${plan.name} →`
      )}
    </button>
  )
}

// ─── Tiny inline spinner ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <circle
        cx="7" cy="7" r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="22"
        strokeDashoffset="8"
        opacity="0.5"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}
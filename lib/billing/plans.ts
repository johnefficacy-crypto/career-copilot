/**
 * lib/billing/plans.ts
 *
 * Single source of truth for plan definitions, feature flags, and limits.
 *
 * Consumed by:
 *   - app/pricing/page.tsx           (render plan cards)
 *   - components/billing/PricingCards.tsx  (display + checkout)
 *   - components/billing/GateGuard.tsx     (feature blocking)
 *   - lib/billing/gate.ts            (server-side gate checks)
 *   - actions/study-planner.ts       (plan limit enforcement)
 *   - actions/billing.ts             (subscription initiation)
 *
 * Rules:
 *   - -1 means "unlimited" for numeric limits
 *   - All values are typed — no `any`, no cast required at call sites
 *   - Adding a new feature = add it to PlanFeatures + all three plan objects
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanId = "free" | "pro" | "elite"

export type PlanFeatures = {
  // Numeric limits (-1 = unlimited)
  study_plans_limit:            number
  plan_regenerations_per_month: number
  notifications_limit:          number   // how many exam feeds to track

  // Boolean feature flags
  eligibility_checks:    boolean
  ai_chat:               boolean
  marketplace_access:    boolean
  download_plan_pdf:     boolean
  priority_support:      boolean
}

export type Plan = {
  id:        PlanId
  name:      string
  price_inr: number   // 0 for free
  popular?:  boolean
  features:  PlanFeatures
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {

  free: {
    id:        "free",
    name:      "Free",
    price_inr: 0,
    features: {
      study_plans_limit:            1,
      plan_regenerations_per_month: 1,
      notifications_limit:          5,
      eligibility_checks:           true,
      ai_chat:                      false,
      marketplace_access:           false,
      download_plan_pdf:            false,
      priority_support:             false,
    },
  },

  pro: {
    id:        "pro",
    name:      "Pro",
    price_inr: 199,
    popular:   true,
    features: {
      study_plans_limit:            5,
      plan_regenerations_per_month: 10,
      notifications_limit:          -1,   // unlimited
      eligibility_checks:           true,
      ai_chat:                      true,
      marketplace_access:           true,
      download_plan_pdf:            true,
      priority_support:             false,
    },
  },

  elite: {
    id:        "elite",
    name:      "Elite",
    price_inr: 499,
    features: {
      study_plans_limit:            -1,   // unlimited
      plan_regenerations_per_month: -1,   // unlimited
      notifications_limit:          -1,   // unlimited
      eligibility_checks:           true,
      ai_chat:                      true,
      marketplace_access:           true,
      download_plan_pdf:            true,
      priority_support:             true,
    },
  },

}

// Ordered list — used for rendering plan cards left-to-right
export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro, PLANS.elite]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safe plan feature lookup. Falls back to free plan features if the
 * plan ID is unrecognised (e.g. null from a fresh profile row).
 */
export function getPlanFeatures(planId: string | null | undefined): PlanFeatures {
  return PLANS[planId as PlanId]?.features ?? PLANS.free.features
}

/**
 * Human-readable label for a numeric limit value.
 * -1  → "Unlimited"
 *  0  → "—"
 *  n  → String(n)
 */
export function limitLabel(value: number): string {
  if (value === -1) return "Unlimited"
  if (value === 0)  return "—"
  return String(value)
}

/**
 * Check whether a boolean feature is accessible on a given plan.
 */
export function canAccess(
  planId: string | null | undefined,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(planId)
  const val = features[feature]
  if (typeof val === "boolean") return val
  // Treat numeric limits: 0 = no access, anything else (including -1) = has access
  return (val as number) !== 0
}

/**
 * Check whether the current usage is within the plan's numeric limit.
 *
 * @param planId       - user's current plan ID
 * @param limitKey     - the feature key to check (must be a numeric limit field)
 * @param currentCount - how many the user has already used/created
 *
 * Returns true  → user can proceed
 * Returns false → limit reached, show upgrade prompt
 */
export function withinLimit(
  planId: string | null | undefined,
  limitKey: keyof PlanFeatures,
  currentCount: number
): boolean {
  const features = getPlanFeatures(planId)
  const limit    = features[limitKey] as number
  if (limit === -1) return true   // unlimited
  return currentCount < limit
}

/**
 * Returns a user-facing upgrade message for a blocked feature.
 * Used by GateGuard and server actions.
 */
export function upgradePrompt(
  planId: string | null | undefined,
  feature: keyof PlanFeatures
): string {
  const currentPlan = PLANS[planId as PlanId]?.name ?? "Free"

  const featureLabels: Record<keyof PlanFeatures, string> = {
    study_plans_limit:            "additional study plans",
    plan_regenerations_per_month: "more AI plan regenerations",
    notifications_limit:          "unlimited exam notifications",
    eligibility_checks:           "eligibility matching",
    ai_chat:                      "AI career chat",
    marketplace_access:           "the course marketplace",
    download_plan_pdf:            "PDF plan downloads",
    priority_support:             "priority support",
  }

  return `${featureLabels[feature] ?? "this feature"} requires a higher plan. You are on ${currentPlan}.`
}
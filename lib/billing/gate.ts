/**
 * Feature Gate — server-side
 *
 * Use this in Server Components and Server Actions to check
 * what a user can access before rendering or executing.
 *
 * Example:
 *   const gate = await getGate(userId)
 *   if (!gate.can("ai_chat")) return <UpgradePrompt feature="ai_chat" />
 */

import { getUserPlanId } from "@/lib/db/billing"
import { getPlanFeatures, canAccess, withinLimit, upgradePrompt, type PlanFeatures, type PlanId } from "@/lib/billing/plans"

export type Gate = {
  planId: PlanId
  features: PlanFeatures
  can: (feature: keyof PlanFeatures) => boolean
  within: (feature: keyof PlanFeatures, count: number) => boolean
  upgradePrompt: (feature: keyof PlanFeatures) => string
  isPro: boolean
  isElite: boolean
  isPaid: boolean
}

export async function getGate(userId: string): Promise<Gate> {
  const planId = (await getUserPlanId(userId)) as PlanId
  const features = getPlanFeatures(planId)

  return {
    planId,
    features,
    can:           (f) => canAccess(planId, f),
    within:        (f, count) => withinLimit(planId, f, count),
    upgradePrompt: (f) => upgradePrompt(planId, f),
    isPro:         planId === "pro",
    isElite:       planId === "elite",
    isPaid:        planId === "pro" || planId === "elite",
  }
}

/**
 * Lightweight gate — reads plan_id directly from the profile row
 * already loaded (avoids an extra DB round-trip when profile is already fetched).
 */
export function gateFromPlanId(planId: string | null | undefined): Gate {
  const id = (planId ?? "free") as PlanId
  const features = getPlanFeatures(id)
  return {
    planId: id,
    features,
    can:           (f) => canAccess(id, f),
    within:        (f, count) => withinLimit(id, f, count),
    upgradePrompt: (f) => upgradePrompt(id, f),
    isPro:         id === "pro",
    isElite:       id === "elite",
    isPaid:        id === "pro" || id === "elite",
  }
}
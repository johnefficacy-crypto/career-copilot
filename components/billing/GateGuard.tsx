import Link from "next/link"
import type { PlanFeatures } from "@/lib/billing/plans"
import { upgradePrompt } from "@/lib/billing/plans"

interface Props {
  feature: keyof PlanFeatures
  /** If true, shows the children — i.e. user has access */
  allowed: boolean
  children: React.ReactNode
  /** Optional: which plan to suggest upgrading to */
  suggestPlan?: "pro" | "elite"
  /** If true, renders nothing instead of the upgrade prompt when blocked */
  silent?: boolean
}

/**
 * Wrap any feature that requires a paid plan.
 *
 * Usage:
 *   <GateGuard feature="ai_chat" allowed={gate.can("ai_chat")}>
 *     <AiChatButton />
 *   </GateGuard>
 */
export function GateGuard({ feature, allowed, children, suggestPlan = "pro", silent = false }: Props) {
  if (allowed) return <>{children}</>
  if (silent) return null

  return (
    <div className="rounded-2xl border border-[#e8d5a3]/15 bg-[#e8d5a3]/[0.03] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[#e8d5a3]/40 text-lg">🔒</span>
        <p className="text-white/60 text-sm">{upgradePrompt(null, feature)}</p>
      </div>
      <Link
        href={`/pricing#${suggestPlan}`}
        className="inline-block self-start px-4 py-2 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-xs font-medium hover:bg-[#f0dfa8] transition-colors"
      >
        Upgrade to {suggestPlan === "elite" ? "Elite" : "Pro"} →
      </Link>
    </div>
  )
}

/**
 * Inline lock badge — for UI elements that are visible but locked.
 * Shows the feature name with a lock icon; clicking goes to pricing.
 */
export function LockBadge({ feature }: { feature: keyof PlanFeatures }) {
  return (
    <Link
      href="/pricing"
      className="inline-flex items-center gap-1.5 text-xs text-[#e8d5a3]/40 hover:text-[#e8d5a3] transition-colors border border-[#e8d5a3]/15 px-2 py-0.5 rounded-full"
    >
      <span>🔒</span>
      <span>Pro</span>
    </Link>
  )
}
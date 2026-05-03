/**
 * lib/db/billing.ts
 *
 * All billing-related DB operations.
 * Tables used: user_subscriptions, payment_history, profiles (plan_id column).
 *
 * Rules applied throughout:
 *   - Every .select() uses a single unbroken string literal (no + concatenation)
 *     so Supabase TypeScript inference works correctly and never falls back to
 *     GenericStringError.
 *   - Local row types declared explicitly as a secondary safety net.
 *   - Zero `any`.
 */

import { createClient } from "@/utils/supabase/server"

// ─── Local row types ──────────────────────────────────────────────────────────

type UserSubscriptionRow = {
  id:                       string
  user_id:                  string
  plan_id:                  string
  status:                   string
  razorpay_subscription_id: string | null
  razorpay_customer_id:     string | null
  current_period_start:     string | null
  current_period_end:       string | null
  cancel_at_period_end:     boolean | null
  created_at:               string | null
  updated_at:               string | null
}

type PaymentHistoryRow = {
  id:                  string
  user_id:             string
  subscription_id:     string | null
  razorpay_payment_id: string | null
  razorpay_order_id:   string | null
  amount_inr:          number
  status:              string
  created_at:          string | null
}

// ─── Plan ID helper ───────────────────────────────────────────────────────────

/**
 * Returns the user's current plan_id from profiles.
 * Falls back to "free" when the profile row has no plan_id yet.
 * Used by: app/pricing/page.tsx, billing page, server-side gate checks.
 */
export async function getUserPlanId(userId: string): Promise<string> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", userId)
    .maybeSingle()

  return data?.plan_id ?? "free"
}

// ─── Subscription reads ───────────────────────────────────────────────────────

/**
 * Returns the user's active or past_due subscription row, or null if none.
 * Called by: actions/billing.ts (to get razorpay_customer_id and sub ID).
 */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscriptionRow | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("user_subscriptions")
    .select("id, user_id, plan_id, status, razorpay_subscription_id, razorpay_customer_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at")
    .eq("user_id", userId)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as UserSubscriptionRow | null) ?? null
}

/**
 * Returns all subscription rows for a user (billing history page).
 */
export async function getAllUserSubscriptions(
  userId: string
): Promise<UserSubscriptionRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id, user_id, plan_id, status, razorpay_subscription_id, razorpay_customer_id, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`getAllUserSubscriptions: ${error.message}`)
  return (data as UserSubscriptionRow[]) ?? []
}

// ─── Subscription writes ──────────────────────────────────────────────────────

/**
 * Activate or refresh a subscription after the Razorpay webhook confirms payment.
 *
 * Upserts on razorpay_subscription_id to be idempotent — the webhook may
 * fire multiple times for the same event (subscription.activated then
 * payment.captured both activate the same sub).
 *
 * Also writes plan_id to profiles so gate checks don't need a join.
 */
export async function activateSubscription(opts: {
  userId:                 string
  planId:                 string
  razorpaySubscriptionId: string
  razorpayCustomerId:     string
  periodStart:            string | null
  periodEnd:              string | null
}): Promise<void> {
  const supabase = await createClient()

  const [subResult, profileResult] = await Promise.all([
    supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id:                  opts.userId,
          plan_id:                  opts.planId,
          status:                   "active",
          razorpay_subscription_id: opts.razorpaySubscriptionId,
          razorpay_customer_id:     opts.razorpayCustomerId,
          current_period_start:     opts.periodStart,
          current_period_end:       opts.periodEnd,
          cancel_at_period_end:     false,
          updated_at:               new Date().toISOString(),
        },
        { onConflict: "razorpay_subscription_id" }
      ),
    supabase
      .from("profiles")
      .update({ plan_id: opts.planId })
      .eq("id", opts.userId),
  ])

  if (subResult.error) {
    throw new Error(`activateSubscription upsert: ${subResult.error.message}`)
  }
  if (profileResult.error) {
    throw new Error(`activateSubscription profile: ${profileResult.error.message}`)
  }
}

/**
 * Update the status of a subscription row by its Razorpay subscription ID.
 * Called by the webhook for: cancelled, completed, pending → past_due.
 *
 * When status becomes terminal (cancelled / completed), also downgrades
 * profiles.plan_id back to "free" so gate checks take effect immediately.
 */
export async function updateSubscriptionStatus(
  razorpaySubscriptionId: string,
  status: string
): Promise<void> {
  const supabase = await createClient()

  // Read user_id first — needed to downgrade profile on terminal status
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .maybeSingle()

  const { error } = await supabase
    .from("user_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("razorpay_subscription_id", razorpaySubscriptionId)

  if (error) throw new Error(`updateSubscriptionStatus: ${error.message}`)

  const isTerminal = status === "cancelled" || status === "completed" || status === "expired"
  if (sub?.user_id && isTerminal) {
    await supabase
      .from("profiles")
      .update({ plan_id: "free" })
      .eq("id", sub.user_id)
  }
}

/**
 * Mark a subscription as cancel_at_period_end = true when the user clicks
 * "Cancel" in the billing page. The user retains access until the period ends.
 * The webhook's subscription.cancelled event will later call
 * updateSubscriptionStatus("cancelled") to fully deactivate.
 */
export async function markSubscriptionCancelAtPeriodEnd(
  subscriptionId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)

  if (error) throw new Error(`markSubscriptionCancelAtPeriodEnd: ${error.message}`)
}

// ─── Payment history ──────────────────────────────────────────────────────────

/**
 * Record a payment event. Called by the webhook on payment.captured
 * or payment.failed. Not idempotent at DB level — avoid duplicate calls
 * by checking razorpay_payment_id at the call site before inserting.
 */
export async function recordPayment(opts: {
  userId:             string
  subscriptionId?:    string
  razorpayPaymentId:  string
  razorpayOrderId?:   string
  amountInr:          number
  status:             string
}): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("payment_history")
    .insert({
      user_id:             opts.userId,
      subscription_id:     opts.subscriptionId  ?? null,
      razorpay_payment_id: opts.razorpayPaymentId,
      razorpay_order_id:   opts.razorpayOrderId ?? null,
      amount_inr:          opts.amountInr,
      status:              opts.status,
    })

  if (error) throw new Error(`recordPayment: ${error.message}`)
}

/**
 * Returns paginated payment history for the billing dashboard.
 */
export async function getPaymentHistory(
  userId: string,
  limit = 20
): Promise<PaymentHistoryRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payment_history")
    .select("id, user_id, subscription_id, razorpay_payment_id, razorpay_order_id, amount_inr, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getPaymentHistory: ${error.message}`)
  return (data as PaymentHistoryRow[]) ?? []
}
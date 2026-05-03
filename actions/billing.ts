"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createSubscription, cancelSubscription, createRazorpayCustomer } from "@/lib/billing/razorpay"
import { getUserSubscription } from "@/lib/db/billing"
import { PLANS, type PlanId } from "@/lib/billing/plans"

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user
}

// ─── Initiate subscription ────────────────────────────────────────────────────
/**
 * Returns the data needed for the Razorpay checkout to open client-side.
 * We create a Razorpay subscription server-side, then the client opens
 * the checkout modal with the subscription ID.
 */
export async function initiateSubscription(formData: FormData): Promise<{
  success: boolean
  subscriptionId?: string
  keyId?: string
  error?: string
}> {
  const user = await requireUser()
  const supabase = await createClient()

  const planId = formData.get("plan_id") as PlanId
  const plan = PLANS[planId]

  if (!plan || planId === "free") {
    return { success: false, error: "Invalid plan" }
  }

  if (!plan.features) {
    return { success: false, error: "Plan configuration error" }
  }

  // Get user profile for customer details
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, plan_id")
    .eq("id", user.id)
    .single()

  // Don't allow subscribing to current plan
  if (profile?.plan_id === planId) {
    return { success: false, error: "Already on this plan" }
  }

  try {
    // Get or create Razorpay customer
    let customerId: string | undefined

    const existingSub = await getUserSubscription(user.id)
    if (existingSub?.razorpay_customer_id) {
      customerId = existingSub.razorpay_customer_id
    } else {
      const customer = await createRazorpayCustomer({
        name: profile?.full_name ?? "Career Copilot User",
        email: user.email!,
        contact: profile?.phone ?? undefined,
      })
      customerId = customer.id
    }

    // Get the Razorpay plan ID from the database
    const { data: dbPlan } = await supabase
      .from("subscription_plans")
      .select("razorpay_plan_id")
      .eq("id", planId)
      .single()

    if (!dbPlan?.razorpay_plan_id) {
      return {
        success: false,
        error: "Razorpay plan not configured. Set the razorpay_plan_id in subscription_plans table.",
      }
    }

    // Create Razorpay subscription — embed user_id and plan_id in notes
    // so the webhook can identify the user
    const rSub = await createSubscription({
      razorpay_plan_id: dbPlan.razorpay_plan_id,
      customer_id: customerId,
      notes: {
        user_id: user.id,
        plan_id: planId,
        email: user.email!,
      },
    })

    return {
      success: true,
      subscriptionId: rSub.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment initiation failed"
    console.error("[initiateSubscription]", err)
    return { success: false, error: msg }
  }
}

// ─── Cancel subscription ──────────────────────────────────────────────────────

export async function cancelUserSubscription(_formData: FormData) {
  const user = await requireUser()

  const subscription = await getUserSubscription(user.id)

  if (!subscription?.razorpay_subscription_id) {
    redirect("/dashboard/billing?error=No+active+subscription+found")
  }

  try {
    // cancel_at_cycle_end=true means they keep access until period ends
    await cancelSubscription(subscription.razorpay_subscription_id, true)

    // Mark locally — webhook will confirm later
    const supabase = await createClient()
    await supabase
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)

    revalidatePath("/dashboard/billing")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cancellation failed"
    redirect(`/dashboard/billing?error=${encodeURIComponent(msg)}`)
  }

  redirect("/dashboard/billing?success=Subscription+cancelled.+You+have+access+until+the+end+of+your+billing+period.")
}
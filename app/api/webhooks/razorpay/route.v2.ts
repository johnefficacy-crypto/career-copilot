//updated route to handle marketplace payments.

/**
 * Razorpay Webhook Handler — v2
 *
 * Handles both subscription events (Phase 5) and course purchase events (Phase 6).
 * Distinguishes them via the `type` field in payment notes.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature } from "@/lib/billing/razorpay"
import {
  activateSubscription,
  updateSubscriptionStatus,
  recordPayment,
} from "@/lib/db/billing"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import type { PlanId } from "@/lib/billing/plans"

// ─── Types for webhook payloads ───────────────────────────────────────────────

type RazorpayNotes = Record<string, string>

type RazorpaySubscriptionEntity = {
  id: string
  plan_id: string
  status: string
  current_start: number | null
  current_end: number | null
  customer_id: string
  notes: RazorpayNotes
}

type RazorpayPaymentEntity = {
  id: string
  order_id: string | null
  amount: number
  notes: RazorpayNotes
}

type WebhookPayload = {
  event: string
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity }
    payment?:      { entity: RazorpayPaymentEntity }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody  = await req.text()
  const signature = req.headers.get("x-razorpay-signature") ?? ""

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[Webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const event = JSON.parse(rawBody) as WebhookPayload

  console.log(`[Webhook] ${event.event}`)

  try {
    await handleEvent(event)
  } catch (err) {
    // Log but return 200 — prevents Razorpay infinite retry
    console.error("[Webhook] Handler threw:", err)
  }

  return NextResponse.json({ received: true })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function handleEvent(event: WebhookPayload): Promise<void> {
  const subEntity     = event.payload.subscription?.entity
  const paymentEntity = event.payload.payment?.entity

  switch (event.event) {

    case "subscription.activated":
    case "subscription.charged":
      if (subEntity) await handleSubscriptionActivated(subEntity, paymentEntity)
      break

    case "subscription.cancelled":
      if (subEntity) await updateSubscriptionStatus(subEntity.id, "cancelled")
      break

    case "subscription.completed":
      if (subEntity) await updateSubscriptionStatus(subEntity.id, "completed")
      break

    case "subscription.pending":
      if (subEntity) await updateSubscriptionStatus(subEntity.id, "past_due")
      break

    case "payment.captured":
      if (paymentEntity) await handlePaymentCaptured(paymentEntity)
      break

    case "payment.failed":
      if (paymentEntity) await handlePaymentFailed(paymentEntity)
      break

    default:
      console.log(`[Webhook] Unhandled: ${event.event}`)
  }
}

// ─── Subscription handlers ────────────────────────────────────────────────────

async function handleSubscriptionActivated(
  sub: RazorpaySubscriptionEntity,
  payment: RazorpayPaymentEntity | undefined
): Promise<void> {
  const userId = sub.notes?.user_id
  const planId = sub.notes?.plan_id as PlanId | undefined

  if (!userId || !planId) {
    console.error("[Webhook] Missing user_id/plan_id in subscription notes", sub.notes)
    return
  }

  await activateSubscription({
    userId,
    planId,
    razorpaySubscriptionId: sub.id,
    razorpayCustomerId: sub.customer_id ?? "",
    periodStart: sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
    periodEnd:   sub.current_end   ? new Date(sub.current_end   * 1000).toISOString() : null,
  })

  if (payment) {
    await recordPayment({
      userId,
      razorpayPaymentId: payment.id,
      amountInr: Math.round(payment.amount / 100),
      status: "captured",
    })
  }
}

// ─── Payment handlers ─────────────────────────────────────────────────────────

async function handlePaymentCaptured(payment: RazorpayPaymentEntity): Promise<void> {
  const notes  = payment.notes
  const userId = notes?.user_id

  if (!userId) return

  const type = notes?.type

  if (type === "course_purchase") {
    await handleCoursePaymentCaptured(payment, userId)
  } else {
    // Generic capture — just record it
    await recordPayment({
      userId,
      razorpayPaymentId: payment.id,
      razorpayOrderId:   payment.order_id ?? undefined,
      amountInr:         Math.round(payment.amount / 100),
      status:            "captured",
    })
  }
}

async function handlePaymentFailed(payment: RazorpayPaymentEntity): Promise<void> {
  const userId = payment.notes?.user_id
  if (!userId) return

  await recordPayment({
    userId,
    razorpayPaymentId: payment.id,
    amountInr:         Math.round(payment.amount / 100),
    status:            "failed",
  })
}

// ─── Course purchase ──────────────────────────────────────────────────────────

async function handleCoursePaymentCaptured(
  payment: RazorpayPaymentEntity,
  userId: string
): Promise<void> {
  const courseId = payment.notes?.course_id
  if (!courseId) {
    console.error("[Webhook] course_purchase missing course_id", payment.notes)
    return
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create enrollment
  const { error: enrollErr } = await supabase.from("enrollments").upsert(
    {
      user_id:              userId,
      course_id:            courseId,
      status:               "active",
      amount_paid_inr:      Math.round(payment.amount / 100),
      razorpay_order_id:    payment.order_id,
      razorpay_payment_id:  payment.id,
    },
    { onConflict: "user_id,course_id" }
  )

  if (enrollErr) {
    console.error("[Webhook] Failed to create enrollment:", enrollErr.message)
    return
  }

  // Record in payment_history
  await recordPayment({
    userId,
    razorpayPaymentId: payment.id,
    razorpayOrderId:   payment.order_id ?? undefined,
    amountInr:         Math.round(payment.amount / 100),
    status:            "captured",
  })

  console.log(`[Webhook] Enrolled user ${userId} in course ${courseId}`)
}
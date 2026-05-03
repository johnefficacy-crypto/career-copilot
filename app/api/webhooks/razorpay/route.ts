/**
 * Razorpay Webhook Handler
 *
 * Endpoint: POST /api/webhooks/razorpay
 *
 * Configure in Razorpay Dashboard → Webhooks:
 *   URL: https://yourapp.com/api/webhooks/razorpay
 *   Events to subscribe:
 *     - subscription.activated
 *     - subscription.charged
 *     - subscription.cancelled
 *     - subscription.completed
 *     - subscription.pending
 *     - payment.captured
 *     - payment.failed
 *
 * This handler is the authoritative source for subscription state.
 * Never trust client-side callbacks alone — always verify server-side here.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature } from "@/lib/billing/razorpay"
import {
  activateSubscription,
  updateSubscriptionStatus,
  recordPayment,
} from "@/lib/db/billing"
import { type PlanId } from "@/lib/billing/plans"

// Helper: get user ID from Razorpay subscription notes
// We embed the user ID when creating the subscription
function getUserIdFromNotes(notes: Record<string, string> | null): string | null {
  return notes?.user_id ?? null
}

function getPlanIdFromNotes(notes: Record<string, string> | null): string | null {
  return notes?.plan_id ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-razorpay-signature") ?? ""

  // ── 1. Verify signature ────────────────────────────────────────────────
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[Webhook] Invalid Razorpay signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const entity = event.payload?.subscription?.entity ?? event.payload?.payment?.entity
  const paymentEntity = event.payload?.payment?.entity

  console.log(`[Webhook] Event: ${event.event}`)

  try {
    switch (event.event) {

      // ── Subscription activated (first payment successful) ────────────
      case "subscription.activated":
      case "subscription.charged": {
        const sub = entity
        const userId  = getUserIdFromNotes(sub.notes)
        const planId  = getPlanIdFromNotes(sub.notes)

        if (!userId || !planId) {
          console.error("[Webhook] Missing user_id or plan_id in notes", sub.notes)
          break
        }

        const periodStart = sub.current_start
          ? new Date(sub.current_start * 1000)
          : null
        const periodEnd = sub.current_end
          ? new Date(sub.current_end * 1000)
          : null

        await activateSubscription({
          userId,
          planId: planId as PlanId,
          razorpaySubscriptionId: sub.id,
          razorpayCustomerId: sub.customer_id ?? "",
          periodStart: periodStart?.toISOString() ?? null,
          periodEnd:   periodEnd?.toISOString() ?? null,
        })

        // Record payment if this was a charge event
        if (event.event === "subscription.charged" && paymentEntity) {
          await recordPayment({
            userId,
            razorpayPaymentId: paymentEntity.id,
            amountInr: Math.round(paymentEntity.amount / 100),
            status: "captured",
          })
        }
        break
      }

      // ── Subscription cancelled ────────────────────────────────────────
      case "subscription.cancelled": {
        const sub = entity
        await updateSubscriptionStatus(sub.id, "cancelled")
        break
      }

      // ── Subscription completed (all billing cycles done) ─────────────
      case "subscription.completed": {
        await updateSubscriptionStatus(entity.id, "completed")
        break
      }

      // ── Subscription pending (payment failed, grace period) ───────────
      case "subscription.pending": {
        await updateSubscriptionStatus(entity.id, "past_due")
        break
      }

      // ── Payment captured (could be outside a subscription) ───────────
      case "payment.captured": {
        const payment = paymentEntity
        const notes = payment.notes as Record<string, string>
        const userId = getUserIdFromNotes(notes)
        if (userId) {
          await recordPayment({
            userId,
            razorpayPaymentId: payment.id,
            razorpayOrderId: payment.order_id,
            amountInr: Math.round(payment.amount / 100),
            status: "captured",
          })
        }
        break
      }

      // ── Payment failed ────────────────────────────────────────────────
      case "payment.failed": {
        const payment = paymentEntity
        const notes = payment.notes as Record<string, string>
        const userId = getUserIdFromNotes(notes)
        if (userId) {
          await recordPayment({
            userId,
            razorpayPaymentId: payment.id,
            amountInr: Math.round(payment.amount / 100),
            status: "failed",
          })
        }
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`)
    }
  } catch (err) {
    console.error("[Webhook] Handler error:", err)
    // Return 200 to prevent Razorpay from retrying — we log the error
    // and handle via monitoring. Returning 500 causes infinite retries.
  }

  return NextResponse.json({ received: true })
}

// Razorpay requires POST only
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
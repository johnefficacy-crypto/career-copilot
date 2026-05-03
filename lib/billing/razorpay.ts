/**
 * Razorpay API client
 *
 * Handles:
 * - Creating subscription orders
 * - Verifying payment signatures (webhook + callback)
 * - Fetching subscription status
 *
 * Requires env vars:
 *   RAZORPAY_KEY_ID     — from Razorpay dashboard (rzp_live_... or rzp_test_...)
 *   RAZORPAY_KEY_SECRET — keep this server-side only, never expose to client
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID — public key for the client-side checkout script
 */

import crypto from "crypto"

const RAZORPAY_BASE = "https://api.razorpay.com/v1"

function getAuthHeader(): string {
  const key    = process.env.RAZORPAY_KEY_ID!
  const secret = process.env.RAZORPAY_KEY_SECRET!
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64")
}

async function razorpayFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Razorpay ${path} failed [${res.status}]: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RazorpayOrder = {
  id: string
  amount: number
  currency: string
  receipt: string
  status: string
}

export type RazorpaySubscription = {
  id: string
  plan_id: string
  status: string
  current_start: number | null
  current_end: number | null
  charge_at: number | null
  total_count: number
  paid_count: number
  short_url: string
}

export type RazorpayCustomer = {
  id: string
  name: string
  email: string
  contact: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function createRazorpayCustomer(input: {
  name: string
  email: string
  contact?: string
}): Promise<RazorpayCustomer> {
  return razorpayFetch<RazorpayCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// ─── One-time order (for first payment / plan upgrade) ───────────────────────

export async function createOrder(input: {
  amount_inr: number          // in whole rupees, we convert to paise
  receipt: string             // your internal order ref
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  return razorpayFetch<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount:   input.amount_inr * 100,   // paise
      currency: "INR",
      receipt:  input.receipt,
      notes:    input.notes ?? {},
    }),
  })
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function createSubscription(input: {
  razorpay_plan_id: string
  customer_id?: string
  total_count?: number        // billing cycles, default 12 (1 year)
  notes?: Record<string, string>
}): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id:     input.razorpay_plan_id,
      customer_id: input.customer_id,
      total_count: input.total_count ?? 12,
      quantity:    1,
      notes:       input.notes ?? {},
    }),
  })
}

export async function fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(`/subscriptions/${subscriptionId}`)
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(
    `/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  )
}

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verify the signature from Razorpay's payment callback.
 * Call this BEFORE updating the database.
 *
 * razorpay_payment_id + "|" + razorpay_order_id  →  HMAC-SHA256 with key_secret
 */
export function verifyPaymentSignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  const message = `${params.razorpay_order_id}|${params.razorpay_payment_id}`
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(message)
    .digest("hex")
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(params.razorpay_signature, "hex")
  )
}

/**
 * Verify the signature from Razorpay webhooks.
 * Uses the webhook secret (separate from API secret).
 *
 * RAZORPAY_WEBHOOK_SECRET env var required.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex")
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  )
}
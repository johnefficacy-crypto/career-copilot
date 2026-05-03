"use client"

import { useState } from "react"
import { initiatePurchase } from "@/actions/marketplace"
import type { InitiatePurchaseResult } from "@/actions/marketplace"

interface Props {
  courseId:         string
  courseSlug:       string
  priceInr:         number
  originalPriceInr: number | null
  isEnrolled:       boolean
  isLoggedIn:       boolean
  courseTitle:      string
}

declare global {
  interface Window { Razorpay: new (opts: RazorpayOptions) => RazorpayInstance }
}

type RazorpayOptions = {
  key:         string
  order_id:    string
  amount:      number
  currency:    string
  name:        string
  description: string
  prefill:     Record<string, string>
  theme:       { color: string }
  handler:     (response: RazorpayResponse) => void
  modal:       { ondismiss: () => void }
}

type RazorpayResponse = {
  razorpay_payment_id: string
  razorpay_order_id:   string
  razorpay_signature:  string
}

type RazorpayInstance = {
  open: () => void
  on:   (event: string, handler: (r: { error: { description: string } }) => void) => void
}

export function EnrollButton({
  courseId, courseSlug, priceInr, originalPriceInr,
  isEnrolled, isLoggedIn, courseTitle,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleEnroll() {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/marketplace/course/${courseSlug}`
      return
    }

    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.set("course_id", courseId)

    const result: InitiatePurchaseResult = await initiatePurchase(fd)

    // Free course enrolled directly on server
    if (!result.success && result.error === "FREE_ENROLLED") {
      window.location.href = `/marketplace/my-courses?success=Enrolled!`
      return
    }

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Load Razorpay checkout.js
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script")
        s.src     = "https://checkout.razorpay.com/v1/checkout.js"
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error("Razorpay script failed"))
        document.head.appendChild(s)
      })
    }

    const rzp = new window.Razorpay({
      key:         result.keyId,
      order_id:    result.orderId,
      amount:      result.amount * 100,
      currency:    "INR",
      name:        "Career Copilot",
      description: courseTitle,
      prefill:     {},
      theme:       { color: "#e8d5a3" },
      handler:     (_response: RazorpayResponse) => {
        // Webhook will create the enrollment — redirect to my courses
        window.location.href = `/marketplace/my-courses?success=Payment+successful!+Enrollment+activating.`
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    })

    rzp.on("payment.failed", (r) => {
      setError(`Payment failed: ${r.error.description}`)
      setLoading(false)
    })

    rzp.open()
    setLoading(false)
  }

  if (isEnrolled) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="text-emerald-400 text-sm font-medium mb-3">You&apos;re enrolled ✓</p>
        <a
          href={`/marketplace/learn/${courseId}`}
          className="block w-full py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium text-center hover:bg-[#f0dfa8] transition-colors"
        >
          Continue learning →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-white/[0.02] p-5">
      {error && (
        <p className="text-red-400 text-xs mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          {error}
        </p>
      )}

      {/* Price display */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-white text-3xl font-medium"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {priceInr === 0 ? "Free" : `₹${priceInr}`}
        </span>
        {originalPriceInr && originalPriceInr > priceInr && (
          <span className="text-white/30 text-base line-through">₹{originalPriceInr}</span>
        )}
      </div>

      {originalPriceInr && originalPriceInr > priceInr && (
        <p className="text-red-400 text-xs mb-4">
          {Math.round((1 - priceInr / originalPriceInr) * 100)}% off — limited time
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleEnroll}
        className="w-full py-3 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] disabled:opacity-50 transition-colors mt-3"
      >
        {loading
          ? "Opening checkout…"
          : priceInr === 0
          ? "Enrol for free"
          : `Enrol — ₹${priceInr}`}
      </button>

      <p className="text-white/20 text-xs text-center mt-2">
        30-day money-back guarantee
      </p>
    </div>
  )
}
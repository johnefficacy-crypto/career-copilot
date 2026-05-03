import { createOrder } from "@/lib/billing/razorpay"
import type { RazorpayOrder } from "@/lib/billing/razorpay"

export type CourseOrderMeta = {
  userId: string
  courseId: string
  courseTitle: string
  amountInr: number
}

/**
 * Create a Razorpay order for a one-time course purchase.
 * The receipt embeds userId + courseId for the webhook to parse.
 */
export async function createCourseOrder(meta: CourseOrderMeta): Promise<RazorpayOrder> {
  const receipt = `course_${meta.courseId.slice(0, 8)}_${meta.userId.slice(0, 8)}`

  return createOrder({
    amount_inr: meta.amountInr,
    receipt,
    notes: {
      user_id:    meta.userId,
      course_id:  meta.courseId,
      type:       "course_purchase",
    },
  })
}
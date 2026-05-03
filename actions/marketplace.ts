"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createCourseOrder } from "@/lib/billing/marketplace-payment"
import { checkEnrollment } from "@/lib/db/marketplace"
import { gateFromPlanId } from "@/lib/billing/gate"
import type { ExamTag, ContentLevel, LessonType } from "@/types/marketplace"

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user
}

async function requireInstructor() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_instructor, plan_id")
    .eq("id", user.id)
    .single()

  if (!profile?.is_instructor) {
    redirect("/marketplace/become-instructor")
  }
  return { user, profile }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export type InitiatePurchaseResult =
  | { success: true;  orderId: string; amount: number; keyId: string; courseTitle: string }
  | { success: false; error: string }

export async function initiatePurchase(formData: FormData): Promise<InitiatePurchaseResult> {
  const user = await requireUser()
  const courseId = formData.get("course_id") as string

  if (!courseId) return { success: false, error: "Missing course ID" }

  const supabase = await createClient()

  // Check already enrolled
  const alreadyEnrolled = await checkEnrollment(courseId, user.id)
  if (alreadyEnrolled) return { success: false, error: "Already enrolled" }

  // Load course price
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, title, price_inr, status")
    .eq("id", courseId)
    .eq("status", "published")
    .single()

  if (courseErr || !course) return { success: false, error: "Course not found" }

  // Check marketplace gate
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", user.id)
    .single()

  const gate = gateFromPlanId(profile?.plan_id)
  if (!gate.can("marketplace_access")) {
    return { success: false, error: gate.upgradePrompt("marketplace_access") }
  }

  // Free course — enroll directly
  if (course.price_inr === 0) {
    await supabase.from("enrollments").insert({
      user_id: user.id,
      course_id: courseId,
      status: "active",
      amount_paid_inr: 0,
    })
    revalidatePath(`/marketplace/${course.title}`)
    return { success: false, error: "FREE_ENROLLED" } // special signal for client
  }

  try {
    const order = await createCourseOrder({
      userId: user.id,
      courseId,
      courseTitle: course.title,
      amountInr: course.price_inr,
    })

    return {
      success: true,
      orderId: order.id,
      amount: course.price_inr,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
      courseTitle: course.title,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment initiation failed"
    return { success: false, error: msg }
  }
}

// ─── Progress tracking ────────────────────────────────────────────────────────

export async function completeLesson(formData: FormData) {
  const user = await requireUser()
  const lessonId = formData.get("lesson_id") as string
  const courseId = formData.get("course_id") as string

  if (!lessonId || !courseId) return

  const supabase = await createClient()
  await supabase.from("lesson_progress").upsert(
    {
      user_id:     user.id,
      lesson_id:   lessonId,
      course_id:   courseId,
      completed:   true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  )

  revalidatePath(`/marketplace/learn/${courseId}`)
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function submitReview(formData: FormData) {
  const user = await requireUser()
  const supabase = await createClient()

  const courseId = formData.get("course_id") as string
  const rating   = Number(formData.get("rating"))
  const body     = (formData.get("body") as string).trim() || null

  if (!courseId || !rating || rating < 1 || rating > 5) {
    redirect(`/marketplace/course/${formData.get("slug")}?error=Invalid+review`)
  }

  const enrolled = await checkEnrollment(courseId, user.id)
  if (!enrolled) {
    redirect(`/marketplace/course/${formData.get("slug")}?error=Must+be+enrolled+to+review`)
  }

  await supabase.from("reviews").upsert(
    { user_id: user.id, course_id: courseId, rating, body },
    { onConflict: "user_id,course_id" }
  )

  revalidatePath(`/marketplace/course/${formData.get("slug")}`)
}

// ─── Instructor: course management ───────────────────────────────────────────

export async function createCourse(formData: FormData) {
  const { user } = await requireInstructor()
  const supabase = await createClient()

  const title = formData.get("title") as string
  const slug  = title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    + "-" + Date.now().toString(36)

  const examTagsRaw = formData.get("exam_tags") as string
  const examTags: ExamTag[] = examTagsRaw
    ? (examTagsRaw.split(",").map((t) => t.trim()) as ExamTag[])
    : []

  const { data, error } = await supabase
    .from("courses")
    .insert({
      instructor_id:      user.id,
      title,
      slug,
      description:        (formData.get("description") as string) || "",
      short_description:  (formData.get("short_description") as string) || null,
      price_inr:          Number(formData.get("price_inr") ?? 0),
      original_price_inr: formData.get("original_price_inr")
        ? Number(formData.get("original_price_inr"))
        : null,
      level:              (formData.get("level") as ContentLevel) || "all",
      language:           (formData.get("language") as string) || "Hindi",
      exam_tags:          examTags,
      status:             "draft",
    })
    .select("id")
    .single()

  if (error || !data) {
    redirect(`/instructor/courses/new?error=${encodeURIComponent(error?.message ?? "Failed")}`)
  }

  redirect(`/instructor/courses/${data.id}/edit`)
}

export async function publishCourse(formData: FormData) {
  const { user } = await requireInstructor()
  const supabase = await createClient()
  const courseId = formData.get("course_id") as string

  // Verify ownership
  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id, total_lessons")
    .eq("id", courseId)
    .single()

  if (course?.instructor_id !== user.id) {
    redirect("/instructor/courses?error=Unauthorized")
  }
  if (!course?.total_lessons || course.total_lessons === 0) {
    redirect(`/instructor/courses/${courseId}/edit?error=Add+at+least+one+lesson+before+publishing`)
  }

  await supabase
    .from("courses")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", courseId)

  revalidatePath("/marketplace")
  redirect(`/instructor/courses/${courseId}/edit?success=Published`)
}

export async function addSection(formData: FormData) {
  const { user } = await requireInstructor()
  const supabase = await createClient()
  const courseId = formData.get("course_id") as string

  // Verify ownership
  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", courseId)
    .single()

  if (course?.instructor_id !== user.id) redirect("/instructor/courses")

  const { count } = await supabase
    .from("course_sections")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)

  await supabase.from("course_sections").insert({
    course_id:      courseId,
    title:          formData.get("title") as string,
    order_index:    (count ?? 0),
    is_free_preview: formData.get("is_free_preview") === "true",
  })

  revalidatePath(`/instructor/courses/${courseId}/edit`)
}

export async function addLesson(formData: FormData) {
  const { user } = await requireInstructor()
  const supabase = await createClient()
  const sectionId = formData.get("section_id") as string
  const courseId  = formData.get("course_id") as string

  // Verify ownership via course
  const { data: course } = await supabase
    .from("courses")
    .select("instructor_id")
    .eq("id", courseId)
    .single()

  if (course?.instructor_id !== user.id) redirect("/instructor/courses")

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId)

  const durationRaw = formData.get("duration_mins")

  await supabase.from("lessons").insert({
    section_id:     sectionId,
    title:          formData.get("title") as string,
    type:           (formData.get("type") as LessonType) || "video",
    order_index:    (count ?? 0),
    duration_mins:  durationRaw ? Number(durationRaw) : null,
    is_free_preview: formData.get("is_free_preview") === "true",
    content_url:    (formData.get("content_url") as string) || null,
    content_text:   (formData.get("content_text") as string) || null,
  })

  // Update total_lessons on course
  const { data: sectionRows } = await supabase
    .from("course_sections")
    .select("id")
    .eq("course_id", courseId)
  const sectionIds = (sectionRows ?? []).map((r) => r.id)
  const { count: totalLessons } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .in("section_id", sectionIds.length > 0 ? sectionIds : ["__none__"])

  await supabase
    .from("courses")
    .update({ total_lessons: totalLessons ?? 0, updated_at: new Date().toISOString() })
    .eq("id", courseId)

  revalidatePath(`/instructor/courses/${courseId}/edit`)
}
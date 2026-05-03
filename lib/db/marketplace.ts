/**
 * lib/db/marketplace.ts — FIXED
 *
 * Bug fixed: `profiles!instructor_id` join was selecting `avg_rating`
 * which does NOT exist on the profiles table (only on courses).
 * Supabase generated alias `profiles_1` and threw:
 *   "column profiles_1.avg_rating does not exist"
 *
 * Fix: remove avg_rating from the profiles join entirely.
 * InstructorProfile.avg_rating is populated separately if needed,
 * or computed from the courses table — never from profiles.
 */

import { createClient } from "@/utils/supabase/server"
import type {
  CourseListItem,
  CourseWithSections,
  SectionWithLessons,
  EnrollmentWithCourse,
  ReviewWithUser,
  InstructorProfile,
  LessonProgress,
  ExamTag,
  ContentLevel,
  CourseStatus,
} from "@/types/marketplace"

// ─── Internal Supabase row shapes ─────────────────────────────────────────────

type CourseRowWithInstructor = {
  id: string
  title: string
  slug: string
  short_description: string | null
  thumbnail_url: string | null
  price_inr: number
  original_price_inr: number | null
  level: string
  exam_tags: string[]
  avg_rating: number | null      // on courses table — correct
  total_reviews: number
  total_enrollments: number
  total_lessons: number
  total_duration_mins: number
  status: string
  profiles: {
    id: string
    full_name: string | null
    // ✅ avg_rating REMOVED — does not exist on profiles table
    // instructor avg_rating comes from aggregating course ratings, not from profiles
  } | null
}

type LessonRow = {
  id: string
  section_id: string
  title: string
  type: string
  order_index: number
  duration_mins: number | null
  is_free_preview: boolean
  content_url: string | null
  content_text: string | null
}

type SectionRow = {
  id: string
  course_id: string
  title: string
  order_index: number
  is_free_preview: boolean
  lessons: LessonRow[]
}

type ReviewRow = {
  id: string
  user_id: string
  course_id: string
  rating: number
  body: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

type EnrollmentRow = {
  id: string
  user_id: string
  course_id: string
  status: string
  amount_paid_inr: number
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  enrolled_at: string
  completed_at: string | null
  courses: {
    id: string
    instructor_id: string
    title: string
    slug: string
    description: string
    short_description: string | null
    thumbnail_url: string | null
    preview_video_url: string | null
    price_inr: number
    original_price_inr: number | null
    level: string
    language: string
    exam_tags: string[]
    status: string
    total_lessons: number
    total_duration_mins: number
    avg_rating: number | null
    total_reviews: number
    total_enrollments: number
    commission_pct: number
    created_at: string
    updated_at: string
  } | null
}

type PaymentRow = {
  amount_paid_inr: number
  courses: { commission_pct: number }
}

// ─── Browse / search ──────────────────────────────────────────────────────────

export async function listPublishedCourses(filters?: {
  examTag?: ExamTag
  level?: ContentLevel
  query?: string
  instructorId?: string
  limit?: number
  offset?: number
}): Promise<CourseListItem[]> {
  const supabase = await createClient()

  // ✅ FIXED: profiles join only selects columns that actually exist on profiles
  let q = supabase
    .from("courses")
    .select(`
      id, title, slug, short_description, thumbnail_url,
      price_inr, original_price_inr, level, exam_tags,
      avg_rating, total_reviews, total_enrollments,
      total_lessons, total_duration_mins, status,
      profiles!instructor_id (
        id, full_name
      )
    `)
    .eq("status", "published")
    .order("total_enrollments", { ascending: false })
    .limit(filters?.limit ?? 24)

  if (filters?.examTag) {
    q = q.contains("exam_tags", [filters.examTag])
  }
  if (filters?.level && filters.level !== "all") {
    q = q.eq("level", filters.level)
  }
  if (filters?.query) {
    q = q.ilike("title", `%${filters.query}%`)
  }
  if (filters?.instructorId) {
    q = q.eq("instructor_id", filters.instructorId)
  }
  if (filters?.offset) {
    q = q.range(filters.offset, (filters.offset) + (filters.limit ?? 24) - 1)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data as CourseRowWithInstructor[]).map((row) => ({
    id:                 row.id,
    title:              row.title,
    slug:               row.slug,
    short_description:  row.short_description,
    thumbnail_url:      row.thumbnail_url,
    price_inr:          row.price_inr,
    original_price_inr: row.original_price_inr,
    level:              row.level as ContentLevel,
    exam_tags:          row.exam_tags as ExamTag[],
    avg_rating:         row.avg_rating,
    total_reviews:      row.total_reviews,
    total_enrollments:  row.total_enrollments,
    total_lessons:      row.total_lessons,
    total_duration_mins: row.total_duration_mins,
    status:             row.status as CourseStatus,
    instructor: {
      id:             row.profiles?.id ?? "",
      full_name:      row.profiles?.full_name ?? null,
      // avg_rating not available from profiles — computed separately
      avg_rating:     null,
      bio:            null,
      avatar_url:     null,
      total_courses:  0,
      total_students: 0,
    },
  }))
}

// ─── Course detail ────────────────────────────────────────────────────────────

export async function getCourseBySlug(
  slug: string,
  userId?: string
): Promise<CourseWithSections | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("courses")
    .select(`
      *,
      profiles!instructor_id (
        id, full_name, instructor_bio, avatar_url
      ),
      course_sections (
        id, course_id, title, order_index, is_free_preview,
        lessons (
          id, section_id, title, type, order_index,
          duration_mins, is_free_preview,
          content_url, content_text
        )
      )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (error || !data) return null

  const row = data as {
    id: string
    instructor_id: string
    title: string
    slug: string
    description: string
    short_description: string | null
    thumbnail_url: string | null
    preview_video_url: string | null
    price_inr: number
    original_price_inr: number | null
    level: string
    language: string
    exam_tags: string[]
    status: string
    total_lessons: number
    total_duration_mins: number
    avg_rating: number | null
    total_reviews: number
    total_enrollments: number
    commission_pct: number
    created_at: string
    updated_at: string
    profiles: {
      id: string
      full_name: string | null
      instructor_bio: string | null
      avatar_url: string | null
    } | null
    course_sections: SectionRow[]
  }

  const isEnrolled = userId ? await checkEnrollment(row.id, userId) : false

  const sections: SectionWithLessons[] = (row.course_sections ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((sec) => ({
      id:             sec.id,
      course_id:      sec.course_id,
      title:          sec.title,
      order_index:    sec.order_index,
      is_free_preview: sec.is_free_preview,
      lessons: (sec.lessons ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((les) => ({
          id:             les.id,
          section_id:     les.section_id,
          title:          les.title,
          type:           les.type as import("@/types/marketplace").LessonType,
          order_index:    les.order_index,
          duration_mins:  les.duration_mins,
          is_free_preview: les.is_free_preview,
          content_url:    isEnrolled || les.is_free_preview ? les.content_url : null,
          content_text:   isEnrolled || les.is_free_preview ? les.content_text : null,
        })),
    }))

  return {
    id:                 row.id,
    instructor_id:      row.instructor_id,
    title:              row.title,
    slug:               row.slug,
    description:        row.description,
    short_description:  row.short_description,
    thumbnail_url:      row.thumbnail_url,
    preview_video_url:  row.preview_video_url,
    price_inr:          row.price_inr,
    original_price_inr: row.original_price_inr,
    level:              row.level as ContentLevel,
    language:           row.language,
    exam_tags:          row.exam_tags as ExamTag[],
    status:             row.status as CourseStatus,
    total_lessons:      row.total_lessons,
    total_duration_mins: row.total_duration_mins,
    avg_rating:         row.avg_rating,
    total_reviews:      row.total_reviews,
    total_enrollments:  row.total_enrollments,
    commission_pct:     row.commission_pct,
    created_at:         row.created_at,
    updated_at:         row.updated_at,
    instructor: {
      id:             row.profiles?.id ?? "",
      full_name:      row.profiles?.full_name ?? null,
      bio:            row.profiles?.instructor_bio ?? null,
      avatar_url:     row.profiles?.avatar_url ?? null,
      avg_rating:     null,
      total_courses:  0,
      total_students: 0,
    },
    sections,
  }
}

// ─── Enrollment helpers ───────────────────────────────────────────────────────

export async function checkEnrollment(
  courseId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  return !!data
}

export async function getUserEnrollments(
  userId: string
): Promise<EnrollmentWithCourse[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      id, user_id, course_id, status, amount_paid_inr,
      razorpay_order_id, razorpay_payment_id,
      enrolled_at, completed_at,
      courses (
        id, title, slug, short_description, thumbnail_url,
        price_inr, original_price_inr, level, exam_tags,
        avg_rating, total_reviews, total_enrollments,
        total_lessons, total_duration_mins, status,
        commission_pct, description, preview_video_url,
        language, created_at, updated_at, instructor_id
      )
    `)
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data as EnrollmentRow[]).map((row) => ({
    id:                  row.id,
    user_id:             row.user_id,
    course_id:           row.course_id,
    status:              row.status as import("@/types/marketplace").EnrollmentStatus,
    amount_paid_inr:     row.amount_paid_inr,
    razorpay_order_id:   row.razorpay_order_id,
    razorpay_payment_id: row.razorpay_payment_id,
    enrolled_at:         row.enrolled_at,
    completed_at:        row.completed_at,
    course: {
      id:                  row.courses?.id ?? "",
      instructor_id:       row.courses?.instructor_id ?? "",
      title:               row.courses?.title ?? "",
      slug:                row.courses?.slug ?? "",
      description:         row.courses?.description ?? "",
      short_description:   row.courses?.short_description ?? null,
      thumbnail_url:       row.courses?.thumbnail_url ?? null,
      preview_video_url:   row.courses?.preview_video_url ?? null,
      price_inr:           row.courses?.price_inr ?? 0,
      original_price_inr:  row.courses?.original_price_inr ?? null,
      level:               (row.courses?.level ?? "all") as ContentLevel,
      language:            row.courses?.language ?? "Hindi",
      exam_tags:           (row.courses?.exam_tags ?? []) as ExamTag[],
      status:              (row.courses?.status ?? "published") as CourseStatus,
      total_lessons:       row.courses?.total_lessons ?? 0,
      total_duration_mins: row.courses?.total_duration_mins ?? 0,
      avg_rating:          row.courses?.avg_rating ?? null,
      total_reviews:       row.courses?.total_reviews ?? 0,
      total_enrollments:   row.courses?.total_enrollments ?? 0,
      commission_pct:      row.courses?.commission_pct ?? 20,
      created_at:          row.courses?.created_at ?? "",
      updated_at:          row.courses?.updated_at ?? "",
    },
  }))
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function getCourseProgress(
  courseId: string,
  userId: string
): Promise<{ progress: LessonProgress[]; percentComplete: number }> {
  const supabase = await createClient()

  const [progressRes, sectionsRes] = await Promise.all([
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", userId),
    supabase
      .from("course_sections")
      .select("id")
      .eq("course_id", courseId),
  ])

  const sectionIds = (sectionsRes.data ?? []).map((s) => s.id)
  const totalRes = sectionIds.length > 0
    ? await supabase.from("lessons").select("id", { count: "exact", head: true }).in("section_id", sectionIds)
    : { count: 0 }

  const progress     = (progressRes.data ?? []) as LessonProgress[]
  const total        = totalRes.count ?? 0
  const completed    = progress.filter((p) => p.completed).length
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0

  return { progress, percentComplete }
}

export async function markLessonComplete(
  lessonId: string,
  courseId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()
  await supabase.from("lesson_progress").upsert(
    {
      user_id:      userId,
      lesson_id:    lessonId,
      course_id:    courseId,
      completed:    true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  )
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function getCourseReviews(courseId: string): Promise<ReviewWithUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("reviews")
    .select(`id, user_id, course_id, rating, body, created_at, profiles ( full_name )`)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  return (data as ReviewRow[]).map((r) => ({
    id:            r.id,
    user_id:       r.user_id,
    course_id:     r.course_id,
    rating:        r.rating,
    body:          r.body,
    created_at:    r.created_at,
    reviewer_name: r.profiles?.full_name ?? null,
  }))
}

// ─── Instructor dashboard ─────────────────────────────────────────────────────

export async function getInstructorCourses(instructorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("courses")
    .select(`
      id, title, slug, status, price_inr,
      total_enrollments, avg_rating, total_reviews,
      total_lessons, created_at, updated_at
    `)
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getInstructorStats(instructorId: string) {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from("courses")
    .select("id, total_enrollments, avg_rating, price_inr, commission_pct")
    .eq("instructor_id", instructorId)

  const courseIds = (courses ?? []).map((c) => c.id)
  if (courseIds.length === 0) {
    return { totalStudents: 0, totalRevenue: 0, avgRating: null, totalCourses: 0 }
  }

  const { data: payments } = await supabase
    .from("enrollments")
    .select("amount_paid_inr, courses!inner(commission_pct)")
    .in("course_id", courseIds)
    .eq("status", "active")

  const totalStudents = (courses ?? []).reduce(
    (s, c) => s + (c.total_enrollments ?? 0), 0
  )

  const totalRevenue = (payments as PaymentRow[] ?? []).reduce((s, p) => {
    const commission = p.courses.commission_pct / 100
    return s + Math.round(p.amount_paid_inr * (1 - commission))
  }, 0)

  const ratings = (courses ?? [])
    .filter((c) => c.avg_rating != null)
    .map((c) => c.avg_rating as number)

  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
    : null

  return {
    totalStudents,
    totalRevenue,
    avgRating,
    totalCourses: courses?.length ?? 0,
  }
}
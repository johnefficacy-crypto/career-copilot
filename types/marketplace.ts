/**
 * Marketplace domain types
 * Single source of truth — imported by db, actions, and UI layers.
 * Zero `any` — every shape is explicit.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type CourseStatus = "draft" | "published" | "archived"
export type LessonType   = "video" | "pdf" | "text" | "quiz"
export type ContentLevel = "beginner" | "intermediate" | "advanced" | "all"
export type EnrollmentStatus = "active" | "completed" | "refunded"
export type PayoutStatus     = "pending" | "processing" | "paid" | "failed"

// ─── Exam tags (mirrors organizations.type values) ────────────────────────────

export type ExamTag =
  | "Banking" | "UPSC" | "SSC" | "PSU"
  | "Regulatory" | "State PSC" | "Judiciary"
  | "Railways" | "Defence" | "Insurance" | "General"

// ─── Course ───────────────────────────────────────────────────────────────────

export type Course = {
  id: string
  instructor_id: string
  title: string
  slug: string
  description: string
  short_description: string | null
  thumbnail_url: string | null
  preview_video_url: string | null
  price_inr: number                 // 0 = free course
  original_price_inr: number | null // for showing strikethrough
  level: ContentLevel
  language: string
  exam_tags: ExamTag[]
  status: CourseStatus
  total_lessons: number             // denormalised count
  total_duration_mins: number       // denormalised sum
  avg_rating: number | null
  total_reviews: number
  total_enrollments: number
  commission_pct: number            // platform commission 0–100
  created_at: string
  updated_at: string
}

export type CourseWithInstructor = Course & {
  instructor: InstructorProfile
}

export type CourseWithSections = CourseWithInstructor & {
  sections: SectionWithLessons[]
}

// ─── Section ──────────────────────────────────────────────────────────────────

export type Section = {
  id: string
  course_id: string
  title: string
  order_index: number
  is_free_preview: boolean
}

export type SectionWithLessons = Section & {
  lessons: Lesson[]
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

export type Lesson = {
  id: string
  section_id: string
  title: string
  type: LessonType
  order_index: number
  duration_mins: number | null
  is_free_preview: boolean
  // content is only returned when user is enrolled or is instructor
  content_url: string | null
  content_text: string | null
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

export type Enrollment = {
  id: string
  user_id: string
  course_id: string
  status: EnrollmentStatus
  amount_paid_inr: number
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  enrolled_at: string
  completed_at: string | null
}

export type EnrollmentWithCourse = Enrollment & {
  course: Course
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type LessonProgress = {
  id: string
  user_id: string
  lesson_id: string
  course_id: string
  completed: boolean
  completed_at: string | null
  watch_seconds: number
}

// ─── Review ───────────────────────────────────────────────────────────────────

export type Review = {
  id: string
  user_id: string
  course_id: string
  rating: number          // 1–5
  body: string | null
  created_at: string
}

export type ReviewWithUser = Review & {
  reviewer_name: string | null
}

// ─── Instructor ───────────────────────────────────────────────────────────────

export type InstructorProfile = {
  id: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  total_courses: number
  total_students: number
  avg_rating: number | null
}

// ─── Payout ───────────────────────────────────────────────────────────────────

export type InstructorPayout = {
  id: string
  instructor_id: string
  amount_inr: number
  status: PayoutStatus
  period_start: string
  period_end: string
  razorpay_payout_id: string | null
  created_at: string
}

// ─── Cart / checkout ──────────────────────────────────────────────────────────

export type CartItem = {
  course_id: string
  title: string
  thumbnail_url: string | null
  price_inr: number
  instructor_name: string | null
}

// ─── Supabase row shapes (for .select() return types) ─────────────────────────
// These are the raw DB row types before any joins.

export type CourseRow = Omit<Course, "instructor">
export type SectionRow = Section
export type LessonRow = Lesson
export type EnrollmentRow = Enrollment
export type ReviewRow = Review

// ─── API response shapes ──────────────────────────────────────────────────────

export type CourseListItem = Pick<
  Course,
  | "id" | "title" | "slug" | "short_description" | "thumbnail_url"
  | "price_inr" | "original_price_inr" | "level" | "exam_tags"
  | "avg_rating" | "total_reviews" | "total_enrollments"
  | "total_lessons" | "total_duration_mins" | "status"
> & {
  instructor: Pick<InstructorProfile, "id" | "full_name" | "avg_rating">
}

export type CourseDetailResponse = CourseWithSections & {
  is_enrolled: boolean
  user_review: Review | null
}
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getCourseBySlug, checkEnrollment, getCourseReviews } from "@/lib/db/marketplace"
import { CourseHero } from "@/components/marketplace/CourseHero"
import { CourseCurriculum } from "@/components/marketplace/CourseCurriculum"
import { CourseReviews } from "@/components/marketplace/CourseReviews"
import { EnrollButton } from "@/components/marketplace/EnrollButton"

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { slug } = await params
  const { error, success } = await searchParams
  const course = await getCourseBySlug(slug, user?.id)
  if (!course) notFound()

  const [isEnrolled, reviews] = await Promise.all([
    user ? checkEnrollment(course.id, user.id) : Promise.resolve(false),
    getCourseReviews(course.id),
  ])

  const totalDurationHrs = Math.round(course.total_duration_mins / 60 * 10) / 10

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/30 mb-6">
          <a href="/marketplace" className="hover:text-white/60 transition-colors">Marketplace</a>
          <span>/</span>
          {course.exam_tags[0] && (
            <>
              <a href={`/marketplace?tag=${course.exam_tags[0]}`}
                className="hover:text-white/60 transition-colors">
                {course.exam_tags[0]}
              </a>
              <span>/</span>
            </>
          )}
          <span className="text-white/50 truncate">{course.title}</span>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {decodeURIComponent(error)}
          </div>
        )}
        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {decodeURIComponent(success)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <CourseHero course={course} totalDurationHrs={totalDurationHrs} />

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-white text-lg font-medium mb-3"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                About this course
              </h2>
              <p className="text-white/55 text-sm leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
            </div>

            {/* Curriculum */}
            <div className="mt-8">
              <CourseCurriculum sections={course.sections} isEnrolled={isEnrolled} />
            </div>

            {/* Reviews */}
            <div className="mt-8">
              <CourseReviews
                reviews={reviews}
                avgRating={course.avg_rating}
                totalReviews={course.total_reviews}
                courseId={course.id}
                courseSlug={course.slug}
                isEnrolled={isEnrolled}
                userId={user?.id ?? null}
              />
            </div>
          </div>

          {/* Sidebar: enrol card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <EnrollButton
                courseId={course.id}
                courseSlug={course.slug}
                priceInr={course.price_inr}
                originalPriceInr={course.original_price_inr}
                isEnrolled={isEnrolled}
                isLoggedIn={!!user}
                courseTitle={course.title}
              />

              {/* Meta */}
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3">
                  This course includes
                </p>
                {[
                  { label: `${course.total_lessons} lessons`, icon: "📚" },
                  { label: `${totalDurationHrs}h total content`, icon: "⏱" },
                  { label: course.language, icon: "🗣" },
                  { label: `Level: ${course.level}`, icon: "📈" },
                  { label: "Certificate on completion", icon: "🎓" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2 py-1.5 text-sm text-white/50">
                    <span className="text-base opacity-60">{m.icon}</span>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Instructor mini-card */}
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Instructor</p>
                <p className="text-white text-sm font-medium">{course.instructor.full_name}</p>
                {course.instructor.bio && (
                  <p className="text-white/40 text-xs mt-1 line-clamp-3">{course.instructor.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
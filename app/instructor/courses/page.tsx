import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getInstructorCourses, getInstructorStats } from "@/lib/db/marketplace"
import { publishCourse } from "@/actions/marketplace"
import { formatDate } from "@/lib/utils/dates"
import type { CourseStatus } from "@/types/marketplace"

export const metadata = { title: "Instructor Dashboard — Career Copilot" }

const STATUS_STYLES: Record<CourseStatus, string> = {
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  draft:     "bg-amber-500/10  text-amber-400  border-amber-500/20",
  archived:  "bg-white/5       text-white/30   border-white/10",
}

export default async function InstructorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { success, error } = await searchParams

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_instructor, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.is_instructor) redirect("/marketplace/become-instructor")

  const [courses, stats] = await Promise.all([
    getInstructorCourses(user.id),
    getInstructorStats(user.id),
  ])

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-white/30 text-sm mb-1">Welcome back, {profile.full_name}</p>
            <h1 className="text-white text-3xl font-medium"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Instructor dashboard
            </h1>
          </div>
          <Link
            href="/instructor/courses/new"
            className="px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors"
          >
            + New course
          </Link>
        </div>

        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {decodeURIComponent(success)}
          </div>
        )}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {decodeURIComponent(error)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total courses",  value: stats.totalCourses },
            { label: "Total students", value: stats.totalStudents.toLocaleString("en-IN") },
            { label: "Avg rating",     value: stats.avgRating ? `${stats.avgRating}★` : "—" },
            { label: "Net earnings",   value: `₹${stats.totalRevenue.toLocaleString("en-IN")}` },
          ].map((s) => (
            <div key={s.label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <p className="text-white/35 text-xs uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-white text-xl font-medium"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Course list */}
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] px-8 py-16 text-center">
            <p className="text-white/40 mb-4">No courses yet. Create your first one.</p>
            <Link href="/instructor/courses/new"
              className="inline-block px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
              Create course
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {courses.map((course) => {
              const status = course.status as CourseStatus
              return (
                <div key={course.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{course.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/35">
                      <span>{course.total_lessons} lessons</span>
                      <span>·</span>
                      <span>{course.total_enrollments} students</span>
                      {course.avg_rating && (
                        <><span>·</span><span>{Number(course.avg_rating).toFixed(1)}★</span></>
                      )}
                      <span>·</span>
                      <span>Updated {formatDate(course.updated_at as string)}</span>
                    </div>
                  </div>

                  <span className={`border text-xs px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/instructor/courses/${course.id}/edit`}
                      className="text-white/40 text-xs hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/[0.05]"
                    >
                      Edit
                    </Link>
                    {status === "draft" && (
                      <form action={publishCourse}>
                        <input type="hidden" name="course_id" value={course.id} />
                        <button
                          type="submit"
                          className="text-[#e8d5a3]/60 text-xs hover:text-[#e8d5a3] transition-colors px-2 py-1"
                        >
                          Publish
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
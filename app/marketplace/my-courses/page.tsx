// ═══════════════════════════════════════════════════════════════
// app/marketplace/my-courses/page.tsx — Learner's enrolled courses
// ═══════════════════════════════════════════════════════════════

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { getUserEnrollments, getCourseProgress } from "@/lib/db/marketplace"
import { formatDate } from "@/lib/utils/dates"

export const metadata = { title: "My Courses — Career Copilot" }

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { success } = await searchParams
  const enrollments = await getUserEnrollments(user.id)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/marketplace" className="text-white/30 text-sm hover:text-white/60 transition-colors">
              ← Marketplace
            </Link>
            <h1 className="text-white text-3xl font-medium mt-2"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              My courses
            </h1>
          </div>
        </div>

        {success && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {decodeURIComponent(success)}
          </div>
        )}

        {enrollments.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-8 py-16 text-center">
            <p className="text-white/40 text-base mb-2">No courses yet</p>
            <Link href="/marketplace"
              className="inline-block px-5 py-2.5 rounded-xl bg-[#e8d5a3] text-[#0f0f0f] text-sm font-medium hover:bg-[#f0dfa8] transition-colors">
              Browse courses →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrollments.map(async (enrollment) => {
              const { percentComplete } = await getCourseProgress(enrollment.course_id, user.id)
              const course = enrollment.course

              return (
                <div key={enrollment.id}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title}
                      className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-white/[0.04] flex items-center justify-center">
                      <span className="text-white/10 text-3xl">📚</span>
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="text-white text-sm font-medium mb-1 line-clamp-2">
                      {course.title}
                    </h3>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mt-3 mb-3">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e8d5a3] rounded-full"
                          style={{ width: `${percentComplete}%` }}
                        />
                      </div>
                      <span className="text-white/40 text-xs tabular-nums">{percentComplete}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-white/25 text-xs">
                        Enrolled {formatDate(enrollment.enrolled_at)}
                      </p>
                      <Link
                        href={`/marketplace/learn/${enrollment.course_id}`}
                        className="text-[#e8d5a3]/60 text-xs hover:text-[#e8d5a3] transition-colors"
                      >
                        {percentComplete > 0 ? "Continue →" : "Start →"}
                      </Link>
                    </div>
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
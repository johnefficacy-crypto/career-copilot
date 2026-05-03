import { listPublishedCourses } from "@/lib/db/marketplace"
import { CourseCard } from "@/components/marketplace/CourseCard"
import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import type { ExamTag, ContentLevel } from "@/types/marketplace"

export const metadata = { title: "Course Marketplace — Career Copilot" }

const EXAM_TAGS: ExamTag[] = [
  "Banking", "UPSC", "SSC", "PSU",
  "Regulatory", "State PSC", "Judiciary", "Railways", "Defence",
]

const LEVELS: { value: ContentLevel; label: string }[] = [
  { value: "all",          label: "All levels"    },
  { value: "beginner",     label: "Beginner"      },
  { value: "intermediate", label: "Intermediate"  },
  { value: "advanced",     label: "Advanced"      },
]

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; level?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { tag: rawTag, level: rawLevel, q: query } = await searchParams
  const tag   = rawTag   as ExamTag | undefined
  const level = rawLevel as ContentLevel | undefined

  const courses = await listPublishedCourses({
    examTag:  tag,
    level:    level && level !== "all" ? level : undefined,
    query:    query,
    limit:    24,
  })

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0f0f0f]/90 backdrop-blur-md h-14 flex items-center px-6 gap-4">
        <Link href="/dashboard"
          className="text-[#e8d5a3] font-semibold text-lg shrink-0"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Career Copilot
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-white/50 text-sm">Marketplace</span>
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/marketplace/my-courses"
              className="text-white/40 text-sm hover:text-white transition-colors">
              My courses
            </Link>
            <Link href="/instructor/courses"
              className="text-white/40 text-sm hover:text-white transition-colors">
              Teach
            </Link>
            <Link href="/dashboard"
              className="text-white/40 text-sm hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        ) : (
          <Link href="/login"
            className="px-4 py-1.5 rounded-lg border border-white/[0.1] text-white/60 text-sm hover:text-white hover:border-white/[0.2] transition-colors">
            Sign in
          </Link>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-white text-3xl font-medium mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Courses by toppers &amp; educators
          </h1>
          <p className="text-white/40 text-sm">
            Hand-picked for UPSC, Banking, SSC, SEBI, RBI and more.
            {!user && " "}
            {!user && (
              <Link href="/signup" className="text-[#e8d5a3]/70 hover:text-[#e8d5a3] transition-colors ml-1">
                Sign up free to enrol →
              </Link>
            )}
          </p>
        </div>

        {/* Trust + disclosure */}
        <div className="mb-6 rounded-2xl border border-[#e8d5a3]/20 bg-[#e8d5a3]/[0.06] p-4">
          <p className="text-[#e8d5a3] text-xs font-medium tracking-wide uppercase mb-1">Trust & disclosure</p>
          <ul className="text-white/60 text-xs space-y-1 list-disc pl-4">
            <li>Verified mentor/course labels indicate completed identity + quality checks.</li>
            <li>Promoted listings are explicitly disclosed and never replace trust or relevance ranking.</li>
            <li>Always compare price, outcomes, and free alternatives before purchase.</li>
          </ul>
        </div>

        {/* Filters */}
        <MarketplaceFilters
          examTags={EXAM_TAGS}
          levels={LEVELS}
          activeTag={tag}
          activeLevel={level}
          query={query}
        />

        {/* Results */}
        {courses.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-white/40 text-base">No courses found.</p>
            <p className="text-white/25 text-sm mt-1">
              Try removing filters or broadening your search.
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/30 text-xs mb-5">
              {courses.length} course{courses.length !== 1 ? "s" : ""}
              {tag ? ` for ${tag}` : ""}
              {query ? ` matching "${query}"` : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
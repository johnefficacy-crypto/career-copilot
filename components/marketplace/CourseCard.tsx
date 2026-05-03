// ═══════════════════════════════════════════════════════════════
// components/marketplace/CourseCard.tsx
// ═══════════════════════════════════════════════════════════════
// Save this block as: components/marketplace/CourseCard.tsx

import Link from "next/link"
import type { CourseListItem } from "@/types/marketplace"

interface CourseCardProps { course: CourseListItem }

export function CourseCard({ course }: CourseCardProps) {
  const stars = course.avg_rating ?? 0

  return (
    <Link
      href={`/marketplace/course/${course.slug}`}
      className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/[0.14] transition-colors"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-white/[0.04] relative overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/10 text-4xl">📚</span>
          </div>
        )}
        {course.original_price_inr && course.original_price_inr > course.price_inr && (
          <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-medium">
            {Math.round((1 - course.price_inr / course.original_price_inr) * 100)}% off
          </span>
        )}
        {course.price_inr === 0 && (
          <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-white font-medium">
            Free
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {course.exam_tags.slice(0, 2).map((tag) => (
            <span key={tag}
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white/40">
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-white text-sm font-medium leading-snug line-clamp-2">
          {course.title}
        </h3>

        {/* Instructor */}
        <p className="text-white/35 text-xs">{course.instructor.full_name}</p>

        <div className="flex flex-wrap gap-1">
          {course.total_reviews >= 15 && (course.avg_rating ?? 0) >= 4.2 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
              Verified quality
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/[0.04] text-white/50">
              New / limited reviews
            </span>
          )}
          {course.price_inr === 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/30 bg-sky-500/10 text-sky-300">
              Budget-first option
            </span>
          )}
        </div>

        {/* Rating */}
        {course.total_reviews > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-amber-400 font-medium">{stars.toFixed(1)}</span>
            <StarRating rating={stars} />
            <span className="text-white/25">({course.total_reviews})</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-white font-medium text-base">
            {course.price_inr === 0 ? "Free" : `₹${course.price_inr}`}
          </span>
          {course.original_price_inr && course.original_price_inr > course.price_inr && (
            <span className="text-white/25 text-xs line-through">
              ₹{course.original_price_inr}
            </span>
          )}
        </div>

        <div className="text-white/25 text-xs">
          {course.total_lessons} lessons · {Math.round(course.total_duration_mins / 60 * 10) / 10}h
        </div>
      </div>
    </Link>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={rating >= n ? "text-amber-400" : rating >= n - 0.5 ? "text-amber-400 opacity-60" : "text-white/15"}>
          ★
        </span>
      ))}
    </div>
  )
}
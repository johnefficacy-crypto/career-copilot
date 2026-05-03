// Save as: components/marketplace/CourseReviews.tsx
 
import { submitReview } from "@/actions/marketplace"
import type { ReviewWithUser } from "@/types/marketplace"
 
interface ReviewsProps {
  reviews:      ReviewWithUser[]
  avgRating:    number | null
  totalReviews: number
  courseId:     string
  courseSlug:   string
  isEnrolled:   boolean
  userId:       string | null
}
 
export function CourseReviews({
  reviews, avgRating, totalReviews, courseId, courseSlug, isEnrolled, userId,
}: ReviewsProps) {
  const userReview = userId ? reviews.find((r) => r.user_id === userId) : null
 
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-medium"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Reviews
        </h2>
        {avgRating && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-medium">{avgRating.toFixed(1)}</span>
            <span className="text-amber-400">★</span>
            <span className="text-white/30 text-xs">({totalReviews})</span>
          </div>
        )}
      </div>
 
      {/* Write a review */}
      {isEnrolled && !userReview && (
        <form action={submitReview}
          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 mb-5">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="slug"      value={courseSlug} />
 
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">
            Write a review
          </p>
 
          <div className="mb-3">
            <label className="text-white/30 text-xs mb-1 block">Rating</label>
            <select name="rating" required
              className="bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#e8d5a3]/40 transition-colors">
              <option value="">Select rating</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>
              ))}
            </select>
          </div>
 
          <div className="mb-3">
            <label className="text-white/30 text-xs mb-1 block">Your review (optional)</label>
            <textarea name="body" rows={3}
              placeholder="Share your experience with this course…"
              className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 resize-none transition-colors"
            />
          </div>
 
          <button type="submit"
            className="px-4 py-2 rounded-lg bg-[#e8d5a3] text-[#0f0f0f] text-xs font-medium hover:bg-[#f0dfa8] transition-colors">
            Submit review
          </button>
        </form>
      )}
 
      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-white/30 text-sm">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm font-medium">
                  {r.reviewer_name ?? "Anonymous"}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n}
                      className={n <= r.rating ? "text-amber-400" : "text-white/15"}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
              {r.body && <p className="text-white/45 text-sm leading-relaxed">{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
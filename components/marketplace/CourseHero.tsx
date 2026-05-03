import type { CourseWithSections } from "@/types/marketplace"
 
interface HeroProps {
  course:            CourseWithSections
  totalDurationHrs:  number
}
 
export function CourseHero({ course, totalDurationHrs }: HeroProps) {
  return (
    <div>
      {course.thumbnail_url && (
        <div className="rounded-2xl overflow-hidden aspect-video mb-5">
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
 
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {course.exam_tags.map((tag) => (
          <a key={tag} href={`/marketplace?tag=${tag}`}
            className="text-xs px-2.5 py-1 rounded-full bg-[#e8d5a3]/[0.08] border border-[#e8d5a3]/20 text-[#e8d5a3]/70 hover:text-[#e8d5a3] transition-colors">
            {tag}
          </a>
        ))}
      </div>
 
      {/* Title */}
      <h1 className="text-white text-2xl font-medium leading-snug mb-2"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {course.title}
      </h1>
 
      {/* Short desc */}
      {course.short_description && (
        <p className="text-white/50 text-sm mb-4">{course.short_description}</p>
      )}
 
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
        {course.avg_rating && (
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-medium">{course.avg_rating.toFixed(1)}</span>
            <span className="text-amber-400">★</span>
            <span>({course.total_reviews} reviews)</span>
          </span>
        )}
        <span>{course.total_enrollments.toLocaleString("en-IN")} students</span>
        <span>{course.total_lessons} lessons</span>
        <span>{totalDurationHrs}h total</span>
        <span className="capitalize">{course.level}</span>
        <span>{course.language}</span>
      </div>
    </div>
  )
}
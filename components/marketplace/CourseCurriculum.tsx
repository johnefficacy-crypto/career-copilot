// Save as: components/marketplace/CourseCurriculum.tsx
// (can be a separate file — included here for delivery efficiency)
 
"use client"
 
import { useState } from "react"
import type { SectionWithLessons } from "@/types/marketplace"
 
const LESSON_TYPE_ICON: Record<string, string> = {
  video:     "▶",
  pdf:       "📄",
  text:      "📝",
  quiz:      "❓",
}
 
interface CurriculumProps {
  sections:   SectionWithLessons[]
  isEnrolled: boolean
}
 
export function CourseCurriculum({ sections, isEnrolled }: CurriculumProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(sections.slice(0, 1).map((s) => s.id))
  )
 
  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
 
  const totalLessons = sections.reduce((s, sec) => s + sec.lessons.length, 0)
  const freeLessons  = sections.reduce(
    (s, sec) => s + sec.lessons.filter((l) => l.is_free_preview).length, 0
  )
 
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-medium"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Curriculum
        </h2>
        <p className="text-white/30 text-xs">
          {totalLessons} lessons
          {!isEnrolled && freeLessons > 0 && ` · ${freeLessons} free preview`}
        </p>
      </div>
 
      <div className="flex flex-col gap-2">
        {sections.map((sec) => {
          const isOpen   = openSections.has(sec.id)
          const secMins  = sec.lessons.reduce((s, l) => s + (l.duration_mins ?? 0), 0)
 
          return (
            <div key={sec.id}
              className="border border-white/[0.07] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-white/80 text-sm font-medium">{sec.title}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-white/25 text-xs">
                    {sec.lessons.length} lesson{sec.lessons.length !== 1 ? "s" : ""}
                    {secMins > 0 ? ` · ${secMins}m` : ""}
                  </span>
                  <span className={`text-white/30 text-sm transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </div>
              </button>
 
              {isOpen && (
                <div className="border-t border-white/[0.05]">
                  {sec.lessons.map((lesson) => {
                    const locked = !isEnrolled && !lesson.is_free_preview
                    return (
                      <div key={lesson.id}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b border-white/[0.04] last:border-0 ${
                          locked ? "opacity-40" : ""
                        }`}
                      >
                        <span className="text-white/30 text-xs w-4 shrink-0">
                          {locked ? "🔒" : LESSON_TYPE_ICON[lesson.type] ?? "•"}
                        </span>
                        <span className="flex-1 text-white/60 truncate">{lesson.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {lesson.is_free_preview && !isEnrolled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              Preview
                            </span>
                          )}
                          {lesson.duration_mins && (
                            <span className="text-white/25 text-xs tabular-nums">
                              {lesson.duration_mins}m
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
 
"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import type { ExamTag, ContentLevel } from "@/types/marketplace"

interface FiltersProps {
  examTags: ExamTag[]
  levels:   { value: ContentLevel; label: string }[]
  activeTag?:   ExamTag
  activeLevel?: ContentLevel
  query?:       string
}

export function MarketplaceFilters({
  examTags, levels, activeTag, activeLevel, query,
}: FiltersProps) {
  const router  = useRouter()
  const path    = usePathname()
  const [pending, startTransition] = useTransition()

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    if (activeTag)   params.set("tag",   activeTag)
    if (activeLevel && activeLevel !== "all") params.set("level", activeLevel)
    if (query)       params.set("q",     query)

    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all") params.set(k, v)
      else params.delete(k)
    }

    startTransition(() => {
      router.push(`${path}?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-col gap-3 mb-8">
      {/* Search */}
      <input
        type="search"
        defaultValue={query}
        placeholder="Search courses…"
        className="w-full max-w-md bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#e8d5a3]/40 transition-colors"
        onChange={(e) => updateParams({ q: e.target.value || undefined })}
      />

      {/* Tag pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateParams({ tag: undefined })}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !activeTag
              ? "border-[#e8d5a3]/40 bg-[#e8d5a3]/[0.08] text-[#e8d5a3]"
              : "border-white/[0.08] text-white/40 hover:border-white/[0.16] hover:text-white/60"
          }`}
        >
          All exams
        </button>
        {examTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => updateParams({ tag: tag === activeTag ? undefined : tag })}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeTag === tag
                ? "border-[#e8d5a3]/40 bg-[#e8d5a3]/[0.08] text-[#e8d5a3]"
                : "border-white/[0.08] text-white/40 hover:border-white/[0.16] hover:text-white/60"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Level select */}
      <div className="flex items-center gap-2">
        <span className="text-white/30 text-xs shrink-0">Level:</span>
        <div className="flex gap-2">
          {levels.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => updateParams({ level: l.value === activeLevel ? undefined : l.value })}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                (activeLevel ?? "all") === l.value
                  ? "border-white/[0.2] text-white/70 bg-white/[0.05]"
                  : "border-white/[0.06] text-white/30 hover:text-white/50"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        {pending && <span className="text-white/20 text-xs">Loading…</span>}
      </div>
    </div>
  )
}
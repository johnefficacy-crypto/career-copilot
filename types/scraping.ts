/**
 * types/scraping.ts
 * Career Copilot — Scraping domain types
 *
 * Single source of truth for types shared between:
 *   - lib/scraping/extractor.ts      (Next.js server side)
 *   - lib/scraping/runner.ts         (legacy runner)
 *   - supabase/functions/scheduled-scraper/index.ts (Deno — defines its own
 *     local copy since ESM imports across function boundaries are not supported)
 *
 * DO NOT import from @/types/delete-scraping — that module was a placeholder
 * and has been deleted. Use @/types/scraping instead.
 */

// ─── Post (sub-item of a recruitment) ─────────────────────────────────────────

export type ExtractedPost = {
  post_name:           string
  group_type:          "A" | "B" | "C" | "D" | null
  pay_level:           string | null
  vacancies:           number | null
  min_age:             number | null
  max_age:             number | null
  education_required:  string | null
  disciplines:         string[] | null
}

// ─── Main extracted recruitment shape ─────────────────────────────────────────
//
// This is what Claude returns from the extraction prompt.
// The `confidence` field is stripped before saving to scrape_queue.extracted_data
// — see extractor.ts where { confidence: _c, ...data } is destructured.
//
// When saving to Supabase jsonb:
//   cast as Record<string, Json> — see runner.ts
// The `posts` field is typed as ExtractedPost[] here for safety, but when
// reading back from jsonb it must be re-cast via a type guard.

export type ExtractedRecruitment = {
  title:                     string
  organization_name:         string
  org_type:                  string
  notification_date:         string | null
  apply_start_date:          string | null
  apply_end_date:            string | null
  total_vacancies:           number | null
  year:                      number
  official_notification_url: string
  source_pdf_url:            string | null
  /** Typed as ExtractedPost[] at extraction time. Cast from unknown[] when reading back from jsonb. */
  posts:                     ExtractedPost[]
}

// ─── Type guard for jsonb → ExtractedRecruitment ──────────────────────────────
//
// Supabase returns jsonb columns as Json (recursive union). Use this guard
// before casting to avoid `as any`.

export function isExtractedRecruitment(v: unknown): v is ExtractedRecruitment {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.title             === "string" &&
    typeof o.organization_name === "string" &&
    typeof o.year              === "number"
  )
}

// ─── Json-safe version for Supabase inserts ───────────────────────────────────
//
// Supabase's generated Json type does not accept unknown[].
// Cast posts to Json[] before inserting into scrape_queue.extracted_data.

export type ExtractedRecruitmentJson = Omit<ExtractedRecruitment, "posts"> & {
  posts: Record<string, unknown>[]
}

export function toJsonSafe(data: ExtractedRecruitment): ExtractedRecruitmentJson {
  return {
    ...data,
    posts: (data.posts ?? []).map(p => p as Record<string, unknown>),
  }
}
/**
 * GET /api/exams/summary
 *
 * Returns personalized exam summary cards for the authenticated user.
 * Backed by the exam_user_summary view (migration 028).
 *
 * Each card includes:
 *   examId, slug, title, currentCycleLabel, vacancyTrend,
 *   eligibleCount, conditionalCount, blockedCount, formStatus, detailHref
 */

import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { computeFormStatus } from "@/lib/exams/form-status"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("exam_user_summary")
    .select("*")
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const cards = (data ?? []).map((row) => ({
    examId:             row.exam_id,
    slug:               row.slug,
    title:              row.title,
    currentCycleLabel:  row.current_cycle_label ?? null,
    vacancyTrend:       row.vacancy_trend as "up" | "down" | "flat" | "insufficient",
    eligibleCount:      row.eligible_count   ?? 0,
    conditionalCount:   row.conditional_count ?? 0,
    blockedCount:       row.blocked_count     ?? 0,
    formStatus:         computeFormStatus({
                          filledAt:    row.filled_at   ?? null,
                          declinedAt:  row.declined_at ?? null,
                          firstShownAt: null,
                        }),
    detailHref:         `/dashboard/exams/${row.slug}`,
  }))

  return NextResponse.json({ cards })
}

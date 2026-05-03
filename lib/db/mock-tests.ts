"use server"

import { createClient } from "@/utils/supabase/server"

export interface MockTest {
  id:                   string
  user_id:              string
  plan_id:              string | null
  exam_name:            string
  test_name:            string | null
  attempted_at:         string
  total_marks:          number | null
  scored_marks:         number | null
  total_questions:      number | null
  attempted_questions:  number | null
  correct_answers:      number | null
  wrong_answers:        number | null
  unattempted:          number | null
  duration_mins:        number | null
  percentile:           number | null
  rank_in_series:       number | null
  notes:                string | null
  created_at:           string
  breakdowns?:          MockSubjectBreakdown[]
}

export interface MockSubjectBreakdown {
  id:               string
  mock_test_id:     string
  subject:          string
  total_marks:      number | null
  scored_marks:     number | null
  total_questions:  number | null
  correct_answers:  number | null
  wrong_answers:    number | null
  unattempted:      number | null
  time_spent_mins:  number | null
}

export async function getUserMockTests(userId: string, planId?: string): Promise<MockTest[]> {
  const supabase = await createClient()
  let q = supabase
    .from("mock_tests")
    .select("*, breakdowns:mock_subject_breakdowns(*)")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false })
    .limit(50)

  if (planId) q = q.eq("plan_id", planId)

  const { data, error } = await q
  if (error) throw new Error(`getUserMockTests: ${error.message}`)
  return (data ?? []) as unknown as MockTest[]
}

export async function getMockTest(id: string, userId: string): Promise<MockTest | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("mock_tests")
    .select("*, breakdowns:mock_subject_breakdowns(*)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(`getMockTest: ${error.message}`)
  return data as MockTest | null
}

export async function createMockTest(
  userId: string,
  input: {
    exam_name:            string
    plan_id?:             string
    test_name?:           string
    attempted_at?:        string
    total_marks?:         number
    scored_marks?:        number
    total_questions?:     number
    attempted_questions?: number
    correct_answers?:     number
    wrong_answers?:       number
    unattempted?:         number
    duration_mins?:       number
    percentile?:          number
    rank_in_series?:      number
    notes?:               string
    breakdowns?:          Omit<MockSubjectBreakdown, "id" | "mock_test_id">[]
  }
): Promise<MockTest> {
  const supabase = await createClient()
  const { breakdowns, ...testInput } = input

  const { data: test, error } = await supabase
    .from("mock_tests")
    .insert({ ...testInput, user_id: userId })
    .select()
    .single()

  if (error) throw new Error(`createMockTest: ${error.message}`)

  if (breakdowns && breakdowns.length > 0) {
    const { error: bdErr } = await supabase
      .from("mock_subject_breakdowns")
      .insert(breakdowns.map((b) => ({ ...b, mock_test_id: test.id })))
    if (bdErr) throw new Error(`createMockTest breakdowns: ${bdErr.message}`)
  }

  return test as MockTest
}

export async function deleteMockTest(id: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("mock_tests")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
  if (error) throw new Error(`deleteMockTest: ${error.message}`)
}

export interface MockTestStats {
  totalAttempts: number
  avgScore:      number | null
  bestScore:     number | null
  avgPercentile: number | null
  trend:         "improving" | "declining" | "stable" | null
}

export async function getMockTestStats(userId: string, planId?: string): Promise<MockTestStats> {
  const supabase = await createClient()
  let q = supabase
    .from("mock_tests")
    .select("scored_marks, total_marks, percentile, attempted_at")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: true })

  if (planId) q = q.eq("plan_id", planId)
  const { data } = await q

  if (!data || data.length === 0) {
    return { totalAttempts: 0, avgScore: null, bestScore: null, avgPercentile: null, trend: null }
  }

  const scores = data
    .filter((d) => d.scored_marks != null && d.total_marks != null && d.total_marks > 0)
    .map((d) => Math.round((d.scored_marks! / d.total_marks!) * 100))

  const percentiles = data.filter((d) => d.percentile != null).map((d) => d.percentile!)

  const avgScore     = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const bestScore    = scores.length > 0 ? Math.max(...scores) : null
  const avgPercentile = percentiles.length > 0
    ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length)
    : null

  let trend: MockTestStats["trend"] = null
  if (scores.length >= 3) {
    const recent = scores.slice(-3)
    const older  = scores.slice(0, -3)
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg  = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg
    if (recentAvg > olderAvg + 3) trend = "improving"
    else if (recentAvg < olderAvg - 3) trend = "declining"
    else trend = "stable"
  }

  return { totalAttempts: data.length, avgScore, bestScore, avgPercentile, trend }
}

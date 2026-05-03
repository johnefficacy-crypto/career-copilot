import { createClient } from "@/utils/supabase/server"

export interface RankedRecruitment {
  user_id:           string
  recruitment_id:    string
  recruitment_name:  string
  apply_end_date:    string | null
  lifecycle_status:  string
  publish_status:    string
  organization_name: string
  organization_type: string
  eligibility_score: number
  urgency_score:     number
  relevance_score:   number
  total_score:       number
}

export async function getRankedRecruitments(
  userId: string,
  limit = 10
): Promise<RankedRecruitment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_recruitment_ranking")
    .select("*")
    .eq("user_id", userId)
    .order("total_score", { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as RankedRecruitment[]
}

export async function getTopMatchScore(userId: string): Promise<number> {
  const top = await getRankedRecruitments(userId, 1)
  return top[0]?.total_score ?? 0
}

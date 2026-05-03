import { createClient } from "@/utils/supabase/server"

export type ApplicationStatus =
  | "not_started"
  | "opened"
  | "in_progress"
  | "submitted"
  | "skipped"
  | "not_applicable"

export type UserApplication = {
  id: string
  user_id: string
  recruitment_id: string
  status: ApplicationStatus
  application_number: string | null
  fee_paid: boolean | null
  fee_amount: number | null
  payment_reference: string | null
  documents_pending: string[] | null
  notes: string | null
  submitted_at: string | null
  updated_at: string
  created_at: string
  // joined
  recruitment?: {
    id: string
    name: string
    status: string
    apply_end_date: string | null
    organization: { name: string } | null
  }
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  not_started:    "Not started",
  opened:         "Form opened",
  in_progress:    "In progress",
  submitted:      "Submitted",
  skipped:        "Skipped",
  not_applicable: "Not applicable",
}

export const STATUS_ORDER: ApplicationStatus[] = [
  "in_progress", "opened", "submitted", "not_started", "skipped", "not_applicable",
]

export async function getUserApplications(userId: string): Promise<UserApplication[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_recruitment_applications")
    .select(`
      id, user_id, recruitment_id, status, application_number,
      fee_paid, fee_amount, payment_reference, documents_pending,
      notes, submitted_at, updated_at, created_at,
      recruitment:recruitments (
        id, name, status, apply_end_date,
        organization:organizations ( name )
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  return (data ?? []) as unknown as UserApplication[]
}

export async function getApplication(
  userId: string,
  recruitmentId: string
): Promise<UserApplication | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_recruitment_applications")
    .select("*")
    .eq("user_id", userId)
    .eq("recruitment_id", recruitmentId)
    .single()
  return (data ?? null) as UserApplication | null
}

export async function upsertApplication(
  userId: string,
  recruitmentId: string,
  patch: Partial<Omit<UserApplication, "id" | "user_id" | "recruitment_id" | "created_at" | "updated_at" | "recruitment">>
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("user_recruitment_applications")
    .upsert(
      { user_id: userId, recruitment_id: recruitmentId, ...patch } as never,
      { onConflict: "user_id,recruitment_id" }
    )
}

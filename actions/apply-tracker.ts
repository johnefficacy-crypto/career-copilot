"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { upsertApplication } from "@/lib/db/apply-tracker"
import type { ApplicationStatus } from "@/lib/db/apply-tracker"

const VALID_STATUSES: ApplicationStatus[] = [
  "not_started", "opened", "in_progress", "submitted", "skipped", "not_applicable",
]

export async function updateApplicationStatus(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const recruitmentId = formData.get("recruitment_id") as string
  const status = formData.get("status") as ApplicationStatus

  if (!recruitmentId || !VALID_STATUSES.includes(status)) {
    redirect(`/dashboard/tracker?error=Invalid+input`)
  }

  await upsertApplication(user.id, recruitmentId, {
    status,
    ...(status === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
  })

  revalidatePath("/dashboard/tracker")
  revalidatePath(`/dashboard/recruitments/${recruitmentId}`)
}

export async function updateApplicationDetails(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const recruitmentId    = formData.get("recruitment_id") as string
  const applicationNumber = (formData.get("application_number") as string) || null
  const notes             = (formData.get("notes") as string) || null
  const feePaid           = formData.get("fee_paid") === "true"
  const feeAmount         = formData.get("fee_amount") ? Number(formData.get("fee_amount")) : null
  const paymentReference  = (formData.get("payment_reference") as string) || null

  if (!recruitmentId) redirect("/dashboard/tracker?error=Missing+recruitment")

  await upsertApplication(user.id, recruitmentId, {
    application_number: applicationNumber,
    notes,
    fee_paid: feePaid,
    fee_amount: feeAmount,
    payment_reference: paymentReference,
  })

  revalidatePath("/dashboard/tracker")
  revalidatePath(`/dashboard/recruitments/${recruitmentId}`)
  redirect(`/dashboard/tracker?success=Details+saved`)
}

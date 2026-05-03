/**
 * GET  /api/notifications/preferences  — fetch user's notification preferences
 * POST /api/notifications/preferences  — save user's notification preferences
 *
 * Required before broad email rollout so users can opt out or change cadence
 * before they start receiving emails. Backed by notification_preferences table.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preferences: data ?? null })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 })
  }

  const allowed = [
    "email_enabled",
    "email_digest_frequency",
    "min_priority_email",
    "in_app_enabled",
    "quiet_hours_start",
    "quiet_hours_end",
  ] as const

  const update: Record<string, unknown> = { user_id: user.id }
  for (const key of allowed) {
    if (key in (body as Record<string, unknown>)) {
      update[key] = (body as Record<string, unknown>)[key]
    }
  }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(update as never, { onConflict: "user_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

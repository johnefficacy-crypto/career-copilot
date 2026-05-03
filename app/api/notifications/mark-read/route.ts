/**
 * app/api/notifications/mark-read/route.ts
 *
 * PATCH /api/notifications/mark-read
 * Body: { alertId: string }   — mark one
 *       { all: true }          — mark all for the session user
 *
 * Used by the notification bell in DashboardNav which is a client component
 * and needs a fetch-based endpoint (server actions can't be called from
 * arbitrary fetch calls).
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/utils/supabase/server"
import { markAlertRead, markAllAlertsRead } from "@/lib/db/notifications"

export async function PATCH(req: NextRequest) {
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  try {
    if (b.all === true) {
      await markAllAlertsRead(user.id)
      return NextResponse.json({ ok: true, action: "all" })
    }

    if (typeof b.alertId === "string") {
      await markAlertRead(b.alertId, user.id)
      return NextResponse.json({ ok: true, action: "one", alertId: b.alertId })
    }

    return NextResponse.json({ error: "Provide alertId or all:true" }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
/**
 * POST /api/events
 *
 * Ingests a user interaction event for telemetry and behavioral ranking.
 * Writes to the user_events table (migration 029).
 *
 * Body:
 *   entity_type  — "recruitment" | "exam" | "marketplace_item" | "alert" | "dashboard"
 *   entity_id    — UUID of the entity
 *   event_type   — "impression" | "click" | "open_alert" | "save" | "unsave" |
 *                  "apply_click" | "mark_applied" | "dismiss" | "decline_form" | "submit_form"
 *   metadata     — optional JSON object
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

const VALID_ENTITY_TYPES = new Set([
  "recruitment", "exam", "marketplace_item", "alert", "dashboard",
])

const VALID_EVENT_TYPES = new Set([
  "impression", "click", "open_alert", "save", "unsave",
  "apply_click", "mark_applied", "dismiss", "decline_form", "submit_form",
])

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

  const { entity_type, entity_id, event_type, metadata } = body as Record<string, unknown>

  if (typeof entity_type !== "string" || !VALID_ENTITY_TYPES.has(entity_type)) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 })
  }
  if (typeof entity_id !== "string" || !entity_id) {
    return NextResponse.json({ error: "entity_id is required" }, { status: 400 })
  }
  if (typeof event_type !== "string" || !VALID_EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 })
  }

  const { error } = await supabase.from("user_events").insert({
    user_id:     user.id,
    entity_type,
    entity_id,
    event_type,
    metadata:    (typeof metadata === "object" && metadata !== null ? metadata : {}) as never,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

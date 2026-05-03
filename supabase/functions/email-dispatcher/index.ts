/**
 * supabase/functions/email-dispatcher/index.ts
 * Career Copilot — Phase 3C: Email Notifications
 *
 * Dispatches pending email notifications to users who have opted in.
 *
 * Flow:
 *   1. Fetch notification_alerts where email_sent = false AND sent_at is recent
 *      OR digest window has passed, filtered by user's email_digest_frequency.
 *   2. For each user, batch unsent alerts respecting min_priority_email.
 *   3. Send via Resend API.
 *   4. Mark email_sent = true on successfully delivered rows.
 *
 * Triggered by pg_cron — recommended schedule:
 *   instant digest : every 5 minutes
 *   daily digest   : daily at 8:00am IST (02:30 UTC)
 *   weekly digest  : Mondays 8:00am IST
 *
 * DPDP Act compliance:
 *   - Only sends to users where notification_preferences.email_enabled = true.
 *   - Respects email_digest_frequency (off = never send).
 *   - Includes unsubscribe link in every email.
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   APP_URL  (e.g. https://career-copilot.vercel.app — for links in email)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")              ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")            ?? ""
const APP_URL          = Deno.env.get("APP_URL")                   ?? "https://career-copilot.vercel.app"

const FROM_ADDRESS = "Career Copilot <notifications@career-copilot.in>"

// Alerts older than this are dropped — avoids sending stale notifications.
const STALE_THRESHOLD_HOURS = 72

type DigestFrequency = "instant" | "daily" | "weekly" | "off"
type Priority        = "low" | "medium" | "high" | "critical"

const PRIORITY_ORDER: Record<Priority, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
}

function priorityAtLeast(actual: string, minimum: string): boolean {
  return (PRIORITY_ORDER[actual as Priority] ?? 0) >=
         (PRIORITY_ORDER[minimum as Priority] ?? 0)
}

// ─── Feed row type (matches v_notification_feed view columns) ─────────────────

export type FeedRow = {
  id:               string
  user_id:          string
  alert_type:       string
  priority:         number
  recruitment_id:   string | null
  recruitment_name: string | null
  org_name:         string | null
  apply_end_date:   string | null
  days_to_deadline: number | null
  email_sent:       string | null
}

export function buildSubject(alert: FeedRow): string {
  if (alert.alert_type === "deadline") {
    return `Deadline approaching: ${alert.recruitment_name ?? "Opportunity"}`
  }
  return `Career Copilot update: ${alert.recruitment_name ?? "Opportunity"}`
}

export function buildBody(alert: FeedRow): string {
  const fragments = [
    alert.org_name         ?? "Career Copilot",
    alert.recruitment_name ?? "Opportunity update",
    alert.apply_end_date   ? `Apply by ${alert.apply_end_date}` : null,
    alert.days_to_deadline != null ? `${alert.days_to_deadline} days remaining` : null,
  ].filter(Boolean)
  return fragments.join(" • ")
}

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// ─── Request body ─────────────────────────────────────────────────────────────
// The function accepts an optional `mode` param so pg_cron can target a
// specific digest window without running all three in every invocation.
type DispatchMode = "instant" | "daily" | "weekly" | "all"

// ─── Resend API ───────────────────────────────────────────────────────────────

async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    FROM_ADDRESS,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { success: false, error: `Resend ${res.status}: ${body}` }
  }
  return { success: true }
}

// ─── Email template ───────────────────────────────────────────────────────────

function renderDigestEmail(opts: {
  userName: string
  userId: string
  alerts: Array<{ title: string; body: string; priority: string; recruitment_id: string | null }>
  isInstant: boolean
}): { subject: string; html: string } {
  const { userName, userId, alerts, isInstant } = opts
  const unsubUrl = `${APP_URL}/dashboard/notifications/preferences?uid=${userId}`
  const notifUrl = `${APP_URL}/dashboard/notifications`

  const subject = isInstant
    ? `New exam notification — ${alerts[0]?.title ?? "Career Copilot"}`
    : `Your exam digest — ${alerts.length} update${alerts.length === 1 ? "" : "s"} | Career Copilot`

  const alertHtml = alerts.map((a) => {
    const priorityColor =
      a.priority === "critical" ? "#ef4444"
      : a.priority === "high"   ? "#f97316"
      : a.priority === "medium" ? "#eab308"
      :                           "#6b7280"

    return `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #1f2937;">
          <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #f9fafb;">
            ${escHtml(a.title)}
          </p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #9ca3af; line-height: 1.5;">
            ${escHtml(a.body)}
          </p>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px;
                       font-size: 11px; font-weight: 500; color: ${priorityColor};
                       background: ${priorityColor}18; border: 1px solid ${priorityColor}30;">
            ${escHtml(a.priority.toUpperCase())}
          </span>
        </td>
      </tr>`
  }).join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 32px;">
              <p style="margin:0; font-size:20px; font-weight:700; color:#e8d5a3;
                         font-family: Georgia, 'Times New Roman', serif;">
                Career Copilot
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 0 24px;">
              <p style="margin:0; font-size:16px; color:#d1d5db;">
                Hi ${escHtml(userName)},
              </p>
              <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">
                ${isInstant
                  ? "A new exam notification matched your profile."
                  : `You have ${alerts.length} exam update${alerts.length === 1 ? "" : "s"} since your last digest.`
                }
              </p>
            </td>
          </tr>

          <!-- Alerts table -->
          <tr>
            <td style="background:#111827; border:1px solid #1f2937; border-radius:12px; padding:0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${alertHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 24px 0;">
              <a href="${notifUrl}"
                 style="display:inline-block; background:#e8d5a3; color:#0a0a0a;
                        font-size:14px; font-weight:600; padding:12px 24px;
                        border-radius:8px; text-decoration:none;">
                View all notifications →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0 0; border-top: 1px solid #1f2937;">
              <p style="margin:0; font-size:12px; color:#4b5563; line-height:1.6;">
                You're receiving this because you enabled email notifications on Career Copilot.<br>
                <a href="${unsubUrl}" style="color:#6b7280; text-decoration:underline;">
                  Manage notification preferences
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  let mode: DispatchMode = "all"
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.mode && ["instant", "daily", "weekly", "all"].includes(body.mode)) {
      mode = body.mode as DispatchMode
    }
  } catch { /* non-fatal */ }

  const supabase = db()

  // ── 0. Kill-switch check ─────────────────────────────────────────────────
  const { data: killSetting } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "notifications_paused")
    .maybeSingle()
  if (killSetting?.value === "true") {
    return new Response(
      JSON.stringify({ dispatched: 0, errors: 0, message: "Notifications paused by admin kill-switch" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  const staleDate = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000)

  // ── 1. Fetch users who have email enabled ────────────────────────────────
  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_digest_frequency, min_priority_email")
    .eq("email_enabled", true)
    .neq("email_digest_frequency", "off")

  if (prefsError) {
    return new Response(
      JSON.stringify({ error: prefsError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  // Filter by mode
  const targetPrefs = (prefs ?? []).filter((p) => {
    if (mode === "all") return true
    if (mode === "instant") return p.email_digest_frequency === "instant"
    if (mode === "daily")   return p.email_digest_frequency === "daily"
    if (mode === "weekly")  return p.email_digest_frequency === "weekly"
    return false
  })

  if (targetPrefs.length === 0) {
    return new Response(
      JSON.stringify({ dispatched: 0, errors: 0, message: "No eligible users for this mode" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  let dispatched = 0
  let errors     = 0
  const errList: string[] = []

  for (const pref of targetPrefs) {
    // ── 2. Fetch unsent alerts from v_notification_feed ──────────────────
    const { data: feedRows } = await supabase
      .from("v_notification_feed")
      .select(`
        id,
        user_id,
        alert_type,
        priority,
        recruitment_id,
        recruitment_name,
        org_name,
        apply_end_date,
        days_to_deadline,
        email_sent
      `)
      .eq("user_id", pref.user_id)
      .is("email_sent", null)
      .gte("created_at", staleDate.toISOString())
      .order("priority", { ascending: false })
      .limit(20)

    if (!feedRows || feedRows.length === 0) continue

    // Filter by min_priority_email (numeric priority: higher = more urgent)
    const minPriority = pref.min_priority_email ?? "medium"
    const eligible = (feedRows as FeedRow[]).filter((row) => {
      // Map numeric priority from feed to label for comparison
      const numericToLabel = (n: number): Priority =>
        n >= 5 ? "critical" : n >= 4 ? "high" : n >= 3 ? "medium" : "low"
      return priorityAtLeast(numericToLabel(row.priority ?? 0), minPriority)
    })
    if (eligible.length === 0) continue

    // ── 3. Fetch user email from auth.users ──────────────────────────────
    const { data: authUser } = await supabase.auth.admin.getUserById(pref.user_id)
    const email    = authUser?.user?.email
    const userName = authUser?.user?.user_metadata?.full_name
      ?? authUser?.user?.email?.split("@")[0]
      ?? "there"

    if (!email) continue

    // ── 4. Render and send ────────────────────────────────────────────────
    const isInstant = pref.email_digest_frequency === "instant"
    const { subject, html } = renderDigestEmail({
      userName,
      userId: pref.user_id,
      alerts: eligible.map((row) => ({
        title:          buildSubject(row),
        body:           buildBody(row),
        priority:       row.priority >= 5 ? "critical"
                      : row.priority >= 4 ? "high"
                      : row.priority >= 3 ? "medium"
                      : "low",
        recruitment_id: row.recruitment_id ?? null,
      })),
      isInstant,
    })

    const result = await sendEmail({ to: email, subject, html })

    if (result.success) {
      // ── 5. Mark rows as email_sent ───────────────────────────────────
      await supabase
        .from("notification_alerts")
        .update({ email_sent: true })
        .in("id", eligible.map((r) => r.id))

      dispatched++
    } else {
      errors++
      errList.push(`${pref.user_id}: ${result.error}`)
    }
  }

  return new Response(
    JSON.stringify({ dispatched, errors, errList }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})

/**
 * app/admin/sources/guide/page.tsx
 * Career Copilot — Source Registry: Field Detection Guide
 *
 * Static reference page. No data fetching needed.
 * Links to /admin/sources/inspect for the interactive inspector.
 */

import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"

export const metadata = { title: "Field Detection Guide — Admin" }

export default async function SourceGuide() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("sources") } catch { redirect("/dashboard") }

  const css = {
    gold:    "var(--gold)",
    surface: "var(--bg-surface)",
    border:  "var(--border)",
    text:    "var(--text-base)",
    muted:   "var(--text-muted)",
    ghost:   "var(--text-ghost)",
    danger:  "var(--danger)",
    success: "var(--success)",
    warning: "var(--warning)",
  }

  const steps = [
    {
      n: 1,
      title: "Reachability + SSL check",
      detail: "Fetch the URL. HTTP 200 + valid cert = proceed. SSL error = mark source disabled, set anti_bot_risk=blocked.",
    },
    {
      n: 2,
      title: "Check for JSON API",
      detail: "Try /wp-json/wp/v2/posts, /api/notifications, /api/jobs. If JSON returns recruitment data → adapter_type=json, fill api_url.",
    },
    {
      n: 3,
      title: "Check for RSS/Atom feed",
      detail: "Try /rss.xml, /feed, /feed.xml, /atom.xml. Also look for <link rel='alternate' type='application/rss+xml'> in the HTML <head>. Found → adapter_type=rss, fill rss_url.",
    },
    {
      n: 4,
      title: "HTML server-render check",
      detail: "Fetch the URL without JS. If body contains recruitment keywords (vacancy, notification, apply) → adapter_type=html. If body is empty → likely SPA → requires_playwright=true.",
    },
    {
      n: 5,
      title: "PDF-only detection",
      detail: "If >60% of links in the page are .pdf → adapter_type=pdf, pdf_only=true, fill pdf_bulletin_url.",
    },
    {
      n: 6,
      title: "Anti-bot risk assessment",
      detail: "Check response headers for Cloudflare, Akamai, Incapsula. Time two back-to-back requests — if second is 10× slower → medium risk. Blocked = don't scrape.",
    },
    {
      n: 7,
      title: "CAPTCHA signal detection",
      detail: "Look for reCAPTCHA, hCaptcha, cf-turnstile scripts in the page source. Found → has_captcha=true. Does NOT auto-disable — some CAPTCHAs are only on login pages.",
    },
    {
      n: 8,
      title: "robots.txt check",
      detail: "Fetch /robots.txt. If Disallow: / for all agents → note in source notes, consider manual adapter. Check Crawl-Delay and respect it in the scraper jitter.",
    },
    {
      n: 9,
      title: "Set adapter_type priority",
      detail: "json > rss > html > pdf > playwright (ascending implementation cost). Never use html when json or rss is available — ETag caching works best with rss/json.",
    },
    {
      n: 10,
      title: "Populate all fields + mark verified",
      detail: "Fill source_name, short_code, category, tier, trust_score, scrape_interval_hours. Set is_verified=true once the source is confirmed to be working.",
    },
  ]

  const riskRows = [
    { risk: "none",    jitter: "100–500ms",   desc: "Government static servers, no WAF detected",             color: css.success },
    { risk: "low",     jitter: "300–900ms",   desc: "Some rate limiting possible, no WAF",                   color: css.success },
    { risk: "medium",  jitter: "2–5s",        desc: "Cloudflare/Akamai detected, occasional blocks",          color: css.warning },
    { risk: "high",    jitter: "5–15s",       desc: "Active bot detection, frequent blocks",                  color: css.danger  },
    { risk: "blocked", jitter: "skip",        desc: "SSL expired or consistent 403/429 — do not scrape",      color: css.danger  },
  ]

  return (
    <div className="p-6 max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: css.text, fontFamily: "'Playfair Display', Georgia, serif" }}>
            Field Detection Guide
          </h1>
          <p className="text-sm mt-1" style={{ color: css.muted }}>
            10-step workflow for populating source_registry fields correctly.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/sources/inspect"
            className="text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: "rgba(201,153,42,0.12)", color: css.gold, border: "1px solid rgba(201,153,42,0.25)" }}>
            Open Inspector →
          </Link>
          <Link href="/admin/sources"
            className="text-sm px-4 py-2 rounded-xl"
            style={{ background: css.surface, color: css.muted, border: `1px solid ${css.border}` }}>
            ← Sources
          </Link>
        </div>
      </div>

      {/* Adapter decision tree */}
      <div className="rounded-2xl p-6 space-y-3"
        style={{ background: css.surface, border: `1px solid ${css.border}` }}>
        <p className="text-sm font-semibold" style={{ color: css.gold }}>Adapter Type — Decision Priority</p>
        <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: css.text }}>
          {["json", "rss", "html", "pdf", "playwright"].map((t, i, arr) => (
            <span key={t} className="flex items-center gap-2">
              <code className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.07)", color: css.gold }}>{t}</code>
              {i < arr.length - 1 && <span style={{ color: css.ghost }}>›</span>}
            </span>
          ))}
        </div>
        <p className="text-xs" style={{ color: css.ghost }}>
          Always prefer json or rss — ETag caching skips Claude when content unchanged, saving ~60% API cost.
          Playwright is last resort (not implemented in Edge Functions yet).
        </p>
      </div>

      {/* Anti-bot risk table */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: css.muted }}>Anti-Bot Risk → Jitter Mapping</p>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${css.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-surface-md)", borderBottom: `1px solid ${css.border}` }}>
                {["Risk Level", "Jitter Range", "When to Use"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: css.ghost }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riskRows.map((row, i) => (
                <tr key={row.risk} style={{ borderBottom: i < riskRows.length - 1 ? `1px solid ${css.border}` : "none" }}>
                  <td className="px-4 py-3">
                    <code className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: row.color }}>{row.risk}</code>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: css.muted }}>{row.jitter}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: css.ghost }}>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10-step workflow */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-4" style={{ color: css.muted }}>10-Step Workflow</p>
        <div className="space-y-3">
          {steps.map(step => (
            <div key={step.n} className="flex gap-4 rounded-xl p-4"
              style={{ background: css.surface, border: `1px solid ${css.border}` }}>
              <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(201,153,42,0.15)", color: css.gold }}>
                {step.n}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: css.text }}>{step.title}</p>
                <p className="text-xs mt-1" style={{ color: css.ghost }}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SQL update template */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: css.surface, border: `1px solid ${css.border}` }}>
        <p className="text-sm font-semibold" style={{ color: css.gold }}>Quick SQL Fix Template</p>
        <pre className="text-xs p-4 rounded-xl overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.3)", color: css.muted, fontFamily: "monospace" }}>
{`UPDATE source_registry
SET notification_url = 'https://correct-url-here',
    is_verified      = true,
    consecutive_fails = 0,
    updated_at       = now()
WHERE short_code = 'UPSC';

-- Or use the /admin/sources UI:
-- Search source → Edit → Update URL → Toggle Verified → Save`}
        </pre>
      </div>
    </div>
  )
}
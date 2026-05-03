/**
 * supabase/functions/scheduled-scraper/index.ts
 * Career Copilot — Scraper v4
 *
 * Changes vs v3 (Phase 2):
 *  TASK 2  — Explicit Playwright guard: skips instead of silently falling through to HTML
 *  TASK 4  — Anti-bot jitter: per-risk ranges (none=100-500ms, low=300-900ms, medium=2-5s, high=5-15s)
 *  TASK 5  — Exponential backoff on consecutive_fails: 2^n * interval, capped at 168h
 *  TASK 6  — Time-budget loop (42s) instead of hard MAX_SOURCES=20 constant
 *  TASK 9  — RSS auto-discovery: HTML adapter upgrades source when RSS link found in page
 *  TASK 10 — Webhook notification on run completion (SCRAPER_WEBHOOK_URL env var)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── Env ──────────────────────────────────────────────────────────────────────
// SUPABASE_URL is a reserved Supabase system var — auto-injected at runtime.
// SB_PROJECT_URL is a user-settable fallback for projects where auto-injection
// is absent (e.g. CLI not linked). Set via: supabase secrets set SB_PROJECT_URL=...
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY")        ?? ""
const GEMINI_KEY       = Deno.env.get("GEMINI_API_KEY")           ?? ""
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")              ||
                         Deno.env.get("SB_PROJECT_URL")            || ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

// ── Model config ──────────────────────────────────────────────────────────────
// LLM primary   = Anthropic Claude Haiku (paid, model-list fallback).
// LLM secondary = Gemini 2.0 Flash (free-tier, rate-capped).
// RSS direct extraction bypasses LLM entirely — zero cost.
const CLAUDE_MODELS = [
  "claude-haiku-4-5-20251001",   // current — Tier-1 universal access, ~$0.00025/source
  "claude-haiku-3-5-20241022",   // last-known-good backup if current 404s/401s
] as const

const PROMPT_VERSION = "v1"

const PLAYWRIGHT_WORKER_URL   = Deno.env.get("PLAYWRIGHT_WORKER_URL")   ?? ""
const PLAYWRIGHT_WORKER_TOKEN = Deno.env.get("PLAYWRIGHT_WORKER_TOKEN") ?? ""

// Module-scope state — resets per cold start. Tracks which model is active
// and whether Anthropic has been fully disabled for this run.
let _claudeModelIdx = 0
let _claudeDisabled = false

function currentClaudeModel(): string | null {
  if (_claudeDisabled) return null
  return CLAUDE_MODELS[_claudeModelIdx] ?? null
}

function markClaudeModelDead(reason: string, sourceName: string): void {
  console.error(`[${sourceName}] Claude model ${CLAUDE_MODELS[_claudeModelIdx]} dead (${reason})`)
  _claudeModelIdx++
  if (_claudeModelIdx >= CLAUDE_MODELS.length) {
    _claudeDisabled = true
    console.error(`[anthropic] ALL models exhausted — Anthropic disabled for this run`)
  }
}

const GEMINI_MODEL    = "gemini-2.0-flash"
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const SYSTEM_PROMPT   = `You are a specialist data extraction agent for Indian government recruitment notifications.
Return ONLY valid JSON with a top-level 'recruitments' array. Never return markdown or explanation.

HARD RULES:
- Extract ONLY factual information present in the text. Never fabricate data.
- Dates → ISO 8601 (YYYY-MM-DD). Month-only? Use the 1st.
- If a field is genuinely not mentioned, set it to null. But SEARCH THE ENTIRE
  document before returning null — eligibility details are often in a separate
  "Eligibility Criteria" / "Age Limit" / "Educational Qualification" section far
  from the post list.
- Vacancies = total across categories unless the text clearly separates posts.
- org_type ∈ {UPSC, SSC, Banking, Railway, State, Insurance, Defence, Other}.

EXTRACTION HEURISTICS (most extractions fail because these are skipped):

Age — look for these phrases ANYWHERE in the text:
  "age between X and Y years" · "minimum X, maximum Y" · "not less than X and not more than Y"
  "X to Y years as on <date>" · "upper age limit: Y" · Category tables with General/OBC/SC/ST columns
  → Use the GENERAL / unreserved row for min_age and max_age. The engine
     applies category-wise relaxation separately (do NOT pre-relax).
  If only "upper age limit" is given and no lower bound is stated, min_age=null.

Education — look for "Educational Qualification", "Essential Qualification",
  "Minimum Qualification". Phrases: "Bachelor's degree", "Graduate from a
  recognised university", "Post-graduate degree in X", "Diploma in Engineering",
  "10+2 pass", "Matriculation", "Class X", "B.E./B.Tech", "CA/CMA", "LLB".
  Put the RAW phrase into education_required. If disciplines are listed, put
  them into the disciplines array.

Posts — one notification often has many posts with different criteria (e.g.
  "Assistant Manager", "Chief Manager", "PO"). Extract each separately. If all
  posts share the same age/education, REPEAT those values on each post rather
  than leaving null. Missing post-level criteria is the #1 cause of eligibility
  false-negatives downstream.`
const REQUEST_TIMEOUT = 18_000
const CLAUDE_TIMEOUT  = 32_000

// ── LLM input budget ──────────────────────────────────────────────────────────
// Haiku handles 200K tokens; 25K chars ≈ 6K tokens ≈ $0.0015 per call.
// 12K was cutting off notifications that live below large navigation menus.
// 25K is the empirical sweet-spot for Indian govt notification pages: captures
// the full notifications section on UPSC/SSC/banking/state PSC without doubling
// cost. At 66 sources × 4 runs/day that's ~$0.4/day ≈ $12/month — economical.
const MAX_LLM_INPUT_CHARS = 25_000

// ── Gemini rate limiter ───────────────────────────────────────────────────────
// Free tier limit: 15 RPM. We enforce 5 s minimum gap between calls (~12 RPM)
// to absorb bursts caused by sources with multiple linked PDFs.
// Module-level state — shared across ALL callGemini* invocations in one run.
const GEMINI_MIN_GAP_MS   = 5_000   // 60s / 5s = 12 RPM (safe under 15 RPM cap)
const GEMINI_RETRY_WAIT   = 5_000   // after a 429, wait 5s then retry once; keep budget for other sources
let   _geminiLastCallMs           = 0
let   _geminiDailyQuotaExhausted  = false  // set true on confirmed daily quota; skip all subsequent calls this run

async function geminiRateLimit(): Promise<void> {
  const elapsed = Date.now() - _geminiLastCallMs
  if (elapsed < GEMINI_MIN_GAP_MS) await sleep(GEMINI_MIN_GAP_MS - elapsed)
  _geminiLastCallMs = Date.now()
}

// ── Anthropic rate limiter ────────────────────────────────────────────────────
// Claude Haiku tier-1 paid allows ~5 req/sec. We enforce 800ms min gap between
// ALL Anthropic calls (text + PDF) to avoid 429 cascades when processing
// sources with multiple linked PDFs. Cheaper than retrying and prevents the
// Gemini-fallback cascade that burned our daily quota.
const ANTHROPIC_MIN_GAP_MS = 800
let   _anthropicLastCallMs = 0

async function anthropicRateLimit(): Promise<void> {
  const elapsed = Date.now() - _anthropicLastCallMs
  if (elapsed < ANTHROPIC_MIN_GAP_MS) await sleep(ANTHROPIC_MIN_GAP_MS - elapsed)
  _anthropicLastCallMs = Date.now()
}
// TASK 6: time budget — 42s of the ~50s Edge Function wall-clock limit
const RUN_BUDGET_MS     = 42_000

// ── Deploy observability ──────────────────────────────────────────────────────
// Stamp every run + every startup log line with the deployed SHA so logs can be
// matched to a commit. Set via: supabase secrets set GIT_SHA=$(git rev-parse --short HEAD)
const FUNCTION_VERSION = "scheduled-scraper@" + (Deno.env.get("GIT_SHA") ?? "dev")

// ── Provider health (run-level circuit breaker) ───────────────────────────────
type ProviderHealth = "available" | "degraded" | "down"

function providersState(): { anthropic: ProviderHealth; gemini: ProviderHealth } {
  return {
    anthropic: !ANTHROPIC_KEY ? "down" : _claudeDisabled ? "down" : "available",
    gemini:    !GEMINI_KEY    ? "down" : _geminiDailyQuotaExhausted ? "down" : "available",
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceRecord {
  id:                    string
  source_name:           string
  short_code:            string | null
  source_type:           string
  category:              string
  official_url:          string
  notification_url:      string | null
  rss_url:               string | null
  api_url:               string | null
  pdf_bulletin_url:      string | null
  adapter_type:          string
  parser_config:         Record<string, unknown>
  scrape_interval_hours: number
  tier:                  number
  trust_score:           number
  anti_bot_risk:         string
  requires_playwright:   boolean
  is_active:             boolean
  last_scraped_at:       string | null
  last_success_at:       string | null
  consecutive_fails:     number
  insecure_tls?:         boolean
  selectors?:            Record<string, unknown> | null
}

interface ETagRecord {
  source_id:     string
  etag:          string | null
  last_modified: string | null
  content_hash:  string | null
}

interface ExtractedRecruitment {
  title:                     string
  organization_name:         string
  org_type:                  string
  notification_date:         string | null
  apply_start_date:          string | null
  apply_end_date:            string | null
  total_vacancies:           number | null
  year:                      number
  official_notification_url: string
  source_pdf_url:            string | null
  posts:                     Record<string, unknown>[]
  confidence:                number
  _provider?:                string   // anthropic | gemini | rss_direct | selectors
  _model?:                   string | null
}

interface RunError {
  source: string
  error:  string
  at:     string
}

interface AcquireResult {
  text:       string
  url:        string
  skipped:    boolean          // true = ETag matched or Playwright pending
  headers:    Record<string, string>
  pdfBytes?:  Uint8Array       // set by pdf adapter; triggers PDF extraction
  linkedPdfs?: Uint8Array[]    // PDFs discovered in HTML pages
  rssItems?:  ExtractedRecruitment[]  // set when RSS direct extraction succeeds — bypasses LLM
  rawHtml?:     string                // raw HTML kept for selector-based extraction
  snapshotHash?: string               // SHA-256 of the raw fetched bytes (HTML/RSS/JSON/PDF)
}

// ─── Supabase client ──────────────────────────────────────────────────────────

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// ─── Startup env validation ───────────────────────────────────────────────────
// Called once at handler start — logs clearly instead of failing mid-run.

function validateEnv(): { ok: boolean; warnings: string[] } {
  const warnings: string[] = []
  if (!SUPABASE_URL)     warnings.push("SUPABASE_URL / SB_PROJECT_URL not set — all DB ops will fail")
  if (!SERVICE_ROLE_KEY) warnings.push("SUPABASE_SERVICE_ROLE_KEY not set — all DB ops will fail")
  if (!ANTHROPIC_KEY && !GEMINI_KEY) {
    warnings.push("Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set — ALL extractions will return empty (items_found=0). Set at least one.")
  } else {
    const primary  = ANTHROPIC_KEY ? `Anthropic (${CLAUDE_MODELS.join(" → ")}) — paid primary` : "—"
    const fallback = GEMINI_KEY    ? `Gemini ${GEMINI_MODEL} (free tier) — secondary`        : "none"
    console.log(`[env] LLM: primary=${primary}  secondary=${fallback}`)
  }
  warnings.forEach(w => console.error(`[env] ⚠ ${w}`))
  const ok = !!(SUPABASE_URL && SERVICE_ROLE_KEY && (GEMINI_KEY || ANTHROPIC_KEY))
  if (ok) console.log("[env] ✓ All required env vars present")
  return { ok, warnings }
}

// ─── Idempotency guard ────────────────────────────────────────────────────────

async function isAlreadyRunning(): Promise<boolean> {
  // Edge Function wall-clock limit is ~50s, so any row still marked 'running'
  // after 2 minutes is definitionally dead (the function was killed before
  // it could mark status='failed'). Using a 10-minute window previously
  // meant a single crashed run blocked scheduling for 10 minutes — and
  // wedged rows from retired-model 404 runs blocked indefinitely until
  // manually cleaned up in SQL. Tighten to 2 minutes: real overlaps are
  // impossible (function dies at 50s), zombie rows age out automatically.
  const { data } = await db()
    .from("scrape_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(1)
  return (data?.length ?? 0) > 0
}

// ─── TASK 5: Exponential backoff isDue ────────────────────────────────────────

function isDue(src: SourceRecord, now: Date): boolean {
  if (!src.last_scraped_at) return true

  // Exponential backoff: 2^fails × base_interval, capped at 7 days (168h)
  // 1 fail → 2×, 2 fails → 4×, 3 fails → 8×, 5 fails → 32× (still retries)
  const backoffMultiplier = src.consecutive_fails > 0
    ? Math.min(Math.pow(2, src.consecutive_fails), 168)
    : 1

  const last     = new Date(src.last_scraped_at).getTime()
  const interval = src.scrape_interval_hours * 3_600_000 * backoffMultiplier
  const grace    = src.tier === 1 ? 0.75 : 1.0

  return now.getTime() - last >= interval * grace
}

// ─── TASK 4: Anti-bot jitter ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function jitter(src: SourceRecord): number {
  const ranges: Record<string, [number, number]> = {
    none:    [100,    500],
    low:     [300,    900],
    medium:  [2000,  5000],
    high:    [5000, 15000],
    blocked: [0,       0],
  }
  const [min, max] = ranges[src.anti_bot_risk] ?? [300, 900]
  if (min === 0) return 0
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(start: string | null, end: string | null): string {
  const now = new Date()
  const e   = end   ? new Date(end)   : null
  const s   = start ? new Date(start) : null
  if (e && e < now) return "closed"
  if (s && s > now) return "upcoming"
  if (s && s <= now) return "open"
  return "upcoming"
}

async function sha256hex(data: string | Uint8Array): Promise<string> {
  const buf  = typeof data === "string" ? new TextEncoder().encode(data) : data
  const hash = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
}

// ─── RSS parsing ──────────────────────────────────────────────────────────────

function parseRssItems(xml: string): string {
  const items: string[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block   = match[1]
    const title   = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? ""
    const link    = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? ""
    const desc    = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() ?? ""
    if (title) items.push(`Title: ${title}\nLink: ${link}\nDesc: ${desc.slice(0, 300)}`)
    if (items.length >= 20) break
  }
  return items.join("\n\n")
}

// ─── RSS direct extraction (LLM-free) ────────────────────────────────────────
// Converts RSS <item> elements directly to ExtractedRecruitment objects without
// any LLM call. Works for well-structured feeds (Employment News, UPSC, SSC,
// most banking RSS). Saves ~1,500 Gemini calls/day at 66+ RSS sources.
// confidence=0.55: we have title+org+date but rarely post-level age/education.

function extractRssDirect(
  xml:        string,
  sourceUrl:  string,
  sourceName: string,
  orgType:    string,
  year:       number
): ExtractedRecruitment[] {
  const results: ExtractedRecruitment[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi

  // Recruitment-signal keywords — NEW job openings only.
  // IMPORTANT: lifecycle update terms (result, admit card, shortlist, cutoff,
  // interview, merit list, answer key, appointment order, medical list) are
  // intentionally excluded. Those are post-recruitment artefacts, not vacancies.
  const RECRUITMENT_SIGNALS = [
    "recruit", "vacancy", "vacancies", "advt", "advertisement", "notification",
    "exam", "post", "posts", "appointment", "hiring", "career", "job", "opening",
    "apply", "applications invited", "invitation", "invited",
  ]
  // Hard-exclude: if the title/description ONLY contains these lifecycle terms
  // and zero recruitment signals, the item is a status update — not a new vacancy.
  const LIFECYCLE_ONLY_TERMS = [
    "result", "results", "admit card", "hall ticket", "merit list",
    "cutoff", "cut-off", "cut off", "shortlist", "shortlisted",
    "interview schedule", "interview letter", "interview call",
    "answer key", "answerkey", "appointment order", "joining letter",
    "medical examination", "medical list", "document verification",
    "roll number", "allotment", "allotted",
  ]

  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block   = match[1]
    const title   = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? ""
    const link    = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? sourceUrl
    const desc    = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim() ?? ""
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? null

    if (!title) continue

    // Only include items with at least one recruitment signal
    const combined = (title + " " + desc).toLowerCase()
    const hasSignal = RECRUITMENT_SIGNALS.some(s => combined.includes(s))
    if (!hasSignal) continue

    // Skip items that are purely lifecycle updates (result/admit card/shortlist/etc.)
    // and have NO recruitment-opening signal. These are status updates on existing
    // recruitments — scraping them creates phantom "recruitments" in the queue.
    const hasLifecycleOnly =
      LIFECYCLE_ONLY_TERMS.some(t => combined.includes(t)) &&
      !RECRUITMENT_SIGNALS.some(s => combined.includes(s))
    if (hasLifecycleOnly) continue

    // Parse publication date
    let notificationDate: string | null = null
    if (pubDate) {
      const d = new Date(pubDate)
      if (!isNaN(d.getTime())) notificationDate = d.toISOString().slice(0, 10)
    }

    // Best-effort vacancy extraction from title + description
    const vacancyMatch = combined.match(/(\d[\d,]+)\s*(?:posts?|vacancies|positions?|seats?)/i)
    const totalVacancies = vacancyMatch ? parseInt(vacancyMatch[1].replace(/,/g, ""), 10) : null

    // Best-effort apply end date from description
    let applyEndDate: string | null = null
    const datePatterns = [
      /last\s*date[^:]*:\s*(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{4})/i,
      /apply\s*(?:before|by|till|upto)[^:]*:\s*(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{4})/i,
      /(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{4})/,  // fallback: first date found in desc
    ]
    for (const pat of datePatterns) {
      const m = desc.match(pat)
      if (m) {
        const d = new Date(m[1])
        if (!isNaN(d.getTime())) {
          applyEndDate = d.toISOString().slice(0, 10)
          break
        }
      }
    }

    results.push({
      title,
      organization_name: sourceName,
      org_type:          orgType,
      notification_date: notificationDate,
      apply_start_date:  null,
      apply_end_date:    applyEndDate,
      total_vacancies:   totalVacancies,
      year,
      official_notification_url: link || sourceUrl,
      source_pdf_url:    null,
      posts:             [],
      confidence:        0.55,  // structural extraction: title+org+date but no post-level detail
      _provider:         "rss_direct",
      _model:            null,
    })

    if (results.length >= 20) break
  }

  return results
}

// ─── JSON adapter ─────────────────────────────────────────────────────────────

function flattenJson(json: unknown, src: SourceRecord): string {
  const cfg        = src.parser_config
  const itemsField = (cfg?.items_field as string) ?? "results"
  const titleField = (cfg?.title_field as string) ?? "title"
  const linkField  = (cfg?.link_field  as string) ?? "link"

  try {
    const root  = json as Record<string, unknown>
    const items = (Array.isArray(json) ? json : (root[itemsField] ?? [])) as Record<string, unknown>[]
    return items.slice(0, 20).map(obj => {
      const getVal = (field: string): string => {
        const parts = field.split(".")
        let val: unknown = obj
        for (const p of parts) val = (val as Record<string, unknown>)?.[p]
        return String(val ?? "")
      }
      return `Title: ${getVal(titleField)}\nLink: ${getVal(linkField)}`
    }).join("\n\n")
  } catch {
    return JSON.stringify(json).slice(0, 8000)
  }
}

// ─── Base64 helper (chunked — avoids stack overflow for large PDFs) ───────────

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ─── Validate PDF magic bytes ────────────────────────────────────────────────
// Servers sometimes return 200 OK with an HTML error page for missing PDFs.
// Sending that HTML as base64 to Anthropic's PDF API produces a 400
// "PDF specified was not valid" which then wastes our Gemini fallback quota.
// Real PDFs start with the ASCII string "%PDF-" — verify before base64 encoding.

function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  // "%PDF-"  =  0x25 0x50 0x44 0x46 0x2D
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
         bytes[3] === 0x46 && bytes[4] === 0x2D
}

// ─── Shared extraction prompt ─────────────────────────────────────────────────

function makeExtractionPrompt(sourceUrl: string, sourceName: string, year: number): string {
  const minYear = year - 1
  return `Extract CURRENT recruitment notifications (job openings) from this content from ${sourceName} (${sourceUrl}).

Current year is ${year}. Extract ONLY notifications where:
  • year is ${minYear} or ${year} (skip anything older), AND
  • the recruitment is a NEW job opening — NOT a shortlist, admit card, result,
    answer key, cut-off, interview letter, appointment order, or medical list.

There may be multiple separate notifications on this page. Extract EACH one.

Return a JSON object with a "recruitments" array:
{
  "recruitments": [
    {
      "title":                     "full recruitment name exactly as printed",
      "organization_name":         "issuing body, e.g. 'Union Public Service Commission'",
      "org_type":                  "UPSC|SSC|Banking|Railway|State|Insurance|Defence|Other",
      "notification_date":         "YYYY-MM-DD or null",
      "apply_start_date":          "YYYY-MM-DD or null",
      "apply_end_date":            "YYYY-MM-DD or null",
      "total_vacancies":           number or null,
      "year":                      ${year},
      "source_pdf_url":            "string or null (direct PDF link if present)",
      "official_notification_url": "direct URL or ${sourceUrl}",
      "confidence":                0.0-1.0,
      "posts": [{
        "post_name":          "exact post title",
        "group_type":         "A|B|C|D or null",
        "pay_level":          "string or null (e.g. 'Level-7', 'Pay Matrix 10', '56100-177500')",
        "vacancies":          number or null,
        "min_age":            number or null,  // UNRESERVED/GENERAL category, years
        "max_age":            number or null,  // UNRESERVED/GENERAL category, years
        "education_required": "raw phrase or null (e.g. 'Bachelor\\'s degree from a recognised university')",
        "disciplines":        ["string"] or null
      }]
    }
  ]
}

Rules:
- confidence=1.0 only when title, org, dates, vacancies AND post-level age/education are all present.
- Set year to the actual year of the recruitment (extract from title/dates) — NOT always ${year}.
- If no current-year recruitments found, return {"recruitments": []}.
- Return ONLY valid JSON, never markdown or explanation.`
}

// ─── Parse Claude's recruitment JSON response ─────────────────────────────────

function stampProvenance(items: ExtractedRecruitment[], provider: string, model: string | null): ExtractedRecruitment[] {
  for (const it of items) { it._provider = provider; it._model = model }
  return items
}

function parseClaudeRecruitmentResponse(raw: string): ExtractedRecruitment[] {
  const clean = raw.replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim()
  const jsonStart = clean.indexOf("{")
  const jsonEnd   = clean.lastIndexOf("}")
  if (jsonStart === -1) return []

  // Try full parse first; on failure (truncated response) try closing the JSON
  const attempts = jsonEnd !== -1
    ? [clean.slice(jsonStart, jsonEnd + 1), clean.slice(jsonStart) + "]}"]
    : [clean.slice(jsonStart) + "]}"]

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as { recruitments?: unknown[] }
      const list   = Array.isArray(parsed.recruitments) ? parsed.recruitments : []
      return list.filter((r): r is ExtractedRecruitment =>
        typeof r === "object" && r !== null &&
        typeof (r as Record<string, unknown>).title === "string" &&
        (r as Record<string, unknown>).title !== ""
      )
    } catch { /* try next */ }
  }
  return []
}

// ─── Claude extraction on PDF bytes (Anthropic PDF beta API) ─────────────────
// Sends the raw PDF directly to Claude — handles compressed streams, CIDFont,
// and scanned pages that naive BT/ET regex completely misses.

// Returns null on API error (caller should try Gemini fallback).
// Returns [] if the model ran OK but found no recruitments, OR if the bytes
// aren't a valid PDF (returning [] here avoids burning the Gemini fallback
// quota on a data error that would also fail at Gemini).
async function callClaudeOnPdf(
  pdfBytes:   Uint8Array,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[] | null> {
  if (!ANTHROPIC_KEY) return null
  const model = currentClaudeModel()
  if (!model) return null
  if (pdfBytes.length > 20_000_000) {
    console.log(`[${sourceName}] PDF too large (${(pdfBytes.length / 1e6).toFixed(1)} MB) — skipping`)
    return []
  }
  if (!looksLikePdf(pdfBytes)) {
    console.log(`[${sourceName}] fetched bytes are not a valid PDF (first bytes: ${[...pdfBytes.slice(0, 5)].map(b => b.toString(16)).join(" ")}) — skipping`)
    return []  // not null — don't trigger Gemini fallback for a data error
  }

  const base64 = toBase64(pdfBytes)

  try {
    await anthropicRateLimit()
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system:     SYSTEM_PROMPT,
        messages: [{
          role:    "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text",     text: makeExtractionPrompt(sourceUrl, sourceName, year) },
          ],
        }],
      }),
      signal: AbortSignal.timeout(CLAUDE_TIMEOUT),
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10)
      const wait = Math.min(retryAfter, 10) * 1000
      console.warn(`[${sourceName}] Anthropic PDF 429 rate limit — retrying in ${wait / 1000}s`)
      await sleep(wait)
      await anthropicRateLimit()
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({ model, max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }, { type: "text", text: makeExtractionPrompt(sourceUrl, sourceName, year) }] }] }),
        signal: AbortSignal.timeout(CLAUDE_TIMEOUT),
      })
      // If still rate-limited on retry, return [] (not null) so the cross-provider
      // Gemini fallback does NOT trigger — Gemini has a much tighter daily quota
      // and cascading rate-limits from Anthropic to Gemini will exhaust it fast.
      if (res2.status === 429) {
        console.warn(`[${sourceName}] Anthropic PDF still 429 after retry — dropping source (not cascading to Gemini)`)
        return []
      }
      if (!res2.ok) { console.error(`[${sourceName}] Anthropic PDF retry ${res2.status}`); return null }
      const data2 = await res2.json() as { content?: Array<{ type: string; text: string }> }
      return stampProvenance(parseClaudeRecruitmentResponse(data2.content?.find(b => b.type === "text")?.text ?? ""), "anthropic", model)
    }
    if (res.status === 404 || res.status === 401) {
      const body = await res.text().catch(() => "")
      console.error(`[${sourceName}] Anthropic PDF ${res.status} body=${body.slice(0, 300)}`)
      markClaudeModelDead(String(res.status), sourceName)
      // Retry once with the next model in the fallback list (same call).
      return await callClaudeOnPdf(pdfBytes, sourceUrl, sourceName, year)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[${sourceName}] Anthropic PDF ${res.status} body=${body.slice(0, 300)}`)
      return null
    }

    const data    = await res.json() as { content?: Array<{ type: string; text: string }> }
    const raw     = data.content?.find(b => b.type === "text")?.text ?? ""
    const results = stampProvenance(parseClaudeRecruitmentResponse(raw), "anthropic", model)
    console.log(`[${sourceName}] Anthropic PDF: ${results.length} recruitment(s)`)
    return results
  } catch (err) {
    console.error(`[${sourceName}] callClaudeOnPdf error:`, err)
    return null
  }
}

// ─── Isolate main content zone BEFORE tag stripping ─────────────────────────
// On listing sites like sarkariresult.com (~500KB raw HTML) the first 25KB
// of stripped text is dominated by the header menu + syllabus/answer-key/admit
// sidebar. The actual recruitment list is past that window. This helper finds
// the densest content container (main/article/div#content/etc) and returns
// just that subtree so the truncation budget is spent on notifications.
//
// Strategy: find the first recognised content-start marker + the nearest
// content-end marker, and slice between them. If the slice is too small to be
// meaningful (< 500 chars), fall back to the full HTML.

function extractContentZone(html: string): string {
  // Drop <head>...</head> unconditionally — it has no recruitment content
  // but does consume chars and can leak meta-description text that looks
  // like a notification to the LLM.
  html = html.replace(/<head\b[\s\S]*?<\/head>/i, " ")

  const startMarkers: RegExp[] = [
    /<main\b[^>]*>/i,
    /<article\b[^>]*>/i,
    /<section\b[^>]*\b(?:id|class)=["'][^"']*(?:notifications?|recruit|vacanc|career|content|main)[^"']*["'][^>]*>/i,
    /<div\b[^>]*\b(?:id|class)=["'][^"']*(?:main[-_]?content|maincontent|primary[-_]?content|content[-_]?wrapper|page[-_]?content|content-area|site-content)[^"']*["'][^>]*>/i,
    /<div\b[^>]*role=["']main["'][^>]*>/i,
    /<div\b[^>]*\bid=["'](?:content|main|primary|body|page-content|middle)["'][^>]*>/i,
    /<body\b[^>]*>/i,   // fallback — at minimum skip <head>
  ]
  let start = -1
  for (const re of startMarkers) {
    const m = html.match(re)
    if (m && m.index !== undefined) { start = m.index; break }
  }
  if (start === -1) return html

  // Find the NEAREST end marker after start. This is a best-effort boundary —
  // HTML doesn't need balanced tags in practice on govt sites, so we use
  // pragmatic landmarks: the next <footer>, </main>, </article>, or </body>.
  const afterStart = html.slice(start + 50)
  const endMarkers: RegExp[] = [/<footer\b/i, /<\/main>/i, /<\/article>/i, /<\/body>/i]
  let end = html.length
  for (const re of endMarkers) {
    const m = afterStart.match(re)
    if (m && m.index !== undefined) {
      end = Math.min(end, start + 50 + m.index)
    }
  }

  const slice = html.slice(start, end)
  return slice.length > 500 ? slice : html
}

// ─── Smart HTML → LLM-ready text ─────────────────────────────────────────────
// Aggressive tag-stripping (the old approach) destroyed the semantic structure
// that Claude needs to identify notifications. For govt pages, the recruitment
// signal lives in anchor text + href patterns — not prose. This preserves:
//   • Anchor text annotated with abs URL:  "Civil Services 2026 [PDF:/upload/notif.pdf]"
//   • Heading hierarchy:                   "## Current Recruitments"
//   • List bullets:                        "• Advt No. 01/2026..."
// And strips nav/header/footer/aside/script/style — the sections that dominate
// the first N KB of raw HTML on Indian govt sites and previously caused the
// 12K truncation window to never reach actual notifications.

function htmlToLlmText(html: string, baseUrl: string): string {
  let base: URL
  try { base = new URL(baseUrl) } catch { return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim() }

  return html
    // Strip irrelevant blocks whole — before they consume the truncation budget
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")

    // Preserve anchors with absolute href — single most important signal.
    // Drops javascript:/mailto:/tel: pseudo-anchors (common on JS-heavy govt
    // portals like MPPSC) which carry no extraction value and just burn tokens.
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      if (!text) return " "
      if (/^\s*(javascript:|mailto:|tel:|#)/i.test(href)) return ` ${text} `
      let abs: string
      try { abs = new URL(href, base.href).href } catch { return ` ${text} ` }
      const isPdfLike =
        /\.pdf(\?|#|$)/i.test(abs) ||
        /\/(download|viewer|attachment|file)[^"']*[?&](file|id|doc|attachment|name)=/i.test(abs) ||
        /\/pdf\//i.test(abs) ||
        /\/upload[^"']*\.pdf/i.test(abs)
      return ` ${text} [${isPdfLike ? "PDF" : "LINK"}:${abs}] `
    })

    // Preserve heading hierarchy (limit to h1-h3 — below that is usually sidebar)
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, _n: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      return text ? `\n### ${text}\n` : " "
    })

    // Preserve list items — notification pages are usually <ul>/<li>
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      return text ? `\n• ${text}` : " "
    })

    // Preserve table rows — many govt sites tabulate notifications.
    // Split cells with " | " then strip any remaining inner tags.
    .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_m, inner: string) => {
      const text = inner
        .replace(/<\/?(?:td|th)[^>]*>/gi, " | ")   // cell boundaries
        .replace(/<[^>]+>/g, " ")                  // strip remaining tags
        .replace(/\s+/g, " ")
        .replace(/\s*\|\s*\|\s*/g, " | ")          // collapse empty cells
        .replace(/^\s*\|\s*|\s*\|\s*$/g, "")       // trim leading/trailing pipes
        .trim()
      return text ? `\n${text}` : " "
    })

    // Strip remaining tags and normalise entities + whitespace
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ─── Selector-based extractor (zero-LLM, deterministic) ─────────────────────
// Regex-based to avoid bundling a DOM library in Deno Edge Functions.
// Opt-in per-source via source_registry.selectors (jsonb).

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Parse a selector like "li.notification-item" or "div#content" into a tag + attr/value.
function parseSelector(sel: string): { tag: string; attr: "class" | "id" | null; value: string | null } | null {
  const m = sel.trim().match(/^([a-zA-Z][a-zA-Z0-9]*)(?:\.([A-Za-z0-9_-]+)|#([A-Za-z0-9_-]+))?$/)
  if (!m) return null
  return {
    tag:   m[1].toLowerCase(),
    attr:  m[2] ? "class" : m[3] ? "id" : null,
    value: m[2] ?? m[3] ?? null,
  }
}

// Find the first block matching parsed selector. Best-effort: uses a greedy
// regex keyed on the tag name; good enough for listing markup on govt sites.
function findFirstBlock(html: string, parsed: ReturnType<typeof parseSelector>): string | null {
  if (!parsed) return null
  const tag = parsed.tag
  let open: RegExp
  if (parsed.attr === "class" && parsed.value) {
    open = new RegExp(`<${tag}\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegex(parsed.value)}\\b[^"']*["'][^>]*>`, "i")
  } else if (parsed.attr === "id" && parsed.value) {
    open = new RegExp(`<${tag}\\b[^>]*\\bid=["']${escapeRegex(parsed.value)}["'][^>]*>`, "i")
  } else {
    open = new RegExp(`<${tag}\\b[^>]*>`, "i")
  }
  const m = html.match(open)
  if (!m || m.index === undefined) return null
  const after = html.slice(m.index + m[0].length)
  const close = new RegExp(`</${tag}>`, "i")
  const c = after.match(close)
  return c && c.index !== undefined ? after.slice(0, c.index) : after
}

// Find all blocks matching parsed selector inside the given html.
function findAllBlocks(html: string, parsed: ReturnType<typeof parseSelector>): string[] {
  if (!parsed) return []
  const tag = parsed.tag
  let pattern: RegExp
  if (parsed.attr === "class" && parsed.value) {
    pattern = new RegExp(`<${tag}\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegex(parsed.value)}\\b[^"']*["'][^>]*>([\\s\\S]*?)</${tag}>`, "gi")
  } else if (parsed.attr === "id" && parsed.value) {
    pattern = new RegExp(`<${tag}\\b[^>]*\\bid=["']${escapeRegex(parsed.value)}["'][^>]*>([\\s\\S]*?)</${tag}>`, "gi")
  } else {
    pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi")
  }
  const out: string[] = []
  let m
  while ((m = pattern.exec(html)) !== null) { out.push(m[1]); if (out.length >= 40) break }
  return out
}

// Evaluate a selector spec against a block. Supports:
//   "a"       → text content of first <a>
//   "a@href"  → href attribute of first <a>
//   { selector: "...", regex: "..." } → apply regex to extracted text
function evalSelector(block: string, spec: unknown): string | null {
  if (typeof spec === "string") {
    const [selPart, attrPart] = spec.split("@")
    const parsed = parseSelector(selPart)
    if (!parsed) return null
    if (attrPart) {
      const open = new RegExp(`<${parsed.tag}\\b[^>]*\\b${escapeRegex(attrPart)}=["']([^"']+)["'][^>]*>`, "i")
      const m = block.match(open)
      return m?.[1] ?? null
    }
    const inner = findFirstBlock(block, parsed)
    if (inner == null) return null
    return inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null
  }
  if (spec && typeof spec === "object") {
    const obj = spec as Record<string, unknown>
    const sel = typeof obj.selector === "string" ? obj.selector : null
    const re  = typeof obj.regex    === "string" ? obj.regex    : null
    const text = sel ? evalSelector(block, sel) : block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (!text) return null
    if (re) { try { const m = text.match(new RegExp(re)); return m?.[1] ?? m?.[0] ?? null } catch { return null } }
    return text
  }
  return null
}

function extractFromSelectors(html: string, sourceUrl: string, src: SourceRecord, year: number): ExtractedRecruitment[] {
  const cfg = src.selectors as Record<string, unknown> | null | undefined
  if (!cfg || typeof cfg !== "object" || typeof cfg.item !== "string") return []
  try {
    const scope = typeof cfg.container === "string"
      ? (findFirstBlock(html, parseSelector(cfg.container)) ?? html)
      : html
    const itemBlocks = findAllBlocks(scope, parseSelector(cfg.item))
    if (itemBlocks.length === 0) return []

    let base: URL
    try { base = new URL(sourceUrl) } catch { return [] }

    const results: ExtractedRecruitment[] = []
    for (const block of itemBlocks) {
      const title = cfg.title ? evalSelector(block, cfg.title) : null
      if (!title) continue
      let link = cfg.link ? evalSelector(block, cfg.link) : null
      if (link) { try { link = new URL(link, base.href).href } catch { /* keep raw */ } }
      const endDate = cfg.apply_end_date ? evalSelector(block, cfg.apply_end_date) : null
      let parsedEnd: string | null = null
      if (endDate) { const d = new Date(endDate); if (!isNaN(d.getTime())) parsedEnd = d.toISOString().slice(0, 10) }

      results.push({
        title,
        organization_name: src.source_name,
        org_type:          src.source_type ?? "Other",
        notification_date: null,
        apply_start_date:  null,
        apply_end_date:    parsedEnd,
        total_vacancies:   null,
        year,
        official_notification_url: link ?? sourceUrl,
        source_pdf_url:    null,
        posts:             [],
        confidence:        0.75,
        _provider:         "selectors",
        _model:            null,
      })
      if (results.length >= 20) break
    }
    return results
  } catch { return [] }
}

// ─── Find RECRUITMENT PDF links in HTML ──────────────────────────────────────
// Scores each PDF link by how likely it is to be a recruitment notification.
// Only returns PDFs with positive recruitment signals — avoids annual reports,
// citizen charters, product brochures, and other irrelevant govt documents.

function findPdfLinksInHtml(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)

  // Signals a NEW recruitment notification (job opening) — not a post-recruitment
  // artefact like shortlists, admit cards, or results. Extracting the latter wastes
  // LLM calls and pollutes the queue with non-actionable items.
  const URL_POSITIVE = [
    "notification", "recruitment", "advt", "advertisement", "vacancy", "vacancies",
    "circular", "career", "employment", "opening", "hiring", "invite",
    "invitation", "application_invited", "call_for_applications", "appointment_of",
  ]
  const TEXT_POSITIVE = [
    "notification", "recruitment", "vacancy", "vacancies", "advertisement", "advt",
    "career", "employment", "opening", "invitation", "invited", "hiring",
    "applications are invited", "apply online", "post of", "appointment of",
  ]
  // Hard exclude — skip these PDFs even if they match positive signals.
  // Shortlists/results/admit-cards are UPDATES to existing recruitments; we
  // haven't even extracted the original recruitment yet, so they're useless
  // at this stage and just burn API budget (as seen with New India Assurance).
  const URL_NEGATIVE = [
    // Non-recruitment govt documents
    "annual_report", "best_practice", "citizen_charter", "citizen_char",
    "product", "tender", "vendor", "price_list", "rate_contract",
    "manual", "guideline", "policy", "brochure", "ar_", "_ar_",
    "dar.pdf", "rti", "award", "grievance", "press_release", "tariff",
    "schedule_of_charges", "form_", "_form", "proforma", "norms",
    // Post-recruitment artefacts (track later as status updates, not here)
    "shortlist", "shortlisted", "provisionally", "provisional_list",
    "interview_schedule", "interview_call", "interview_letter",
    "merit_list", "final_list", "select_list", "selected_candidates",
    "answer_key", "answerkey", "answer-key",
    "admit_card", "admitcard", "admit-card", "hall_ticket", "hallticket",
    "result", "cutoff", "cut_off", "cut-off",
    "allotment", "allotted", "appointment_order", "joining_letter",
    "medical_examination", "medical-examination", "medical_test",
    "document_verification", "doc_verification", "dv_notice",
    "roll_number", "rollnumber", "roll-number",
    "pre-employment", "preemployment",
    // Accessibility/theme anchors that sometimes have href patterns matching PDF regex
    "#main", "#content", "skiptocontent",
  ]

  interface ScoredLink { url: string; score: number }
  const candidates = new Map<string, ScoredLink>()

  // Recognise PDF links beyond just ".pdf" in the URL. Govt sites often serve
  // PDFs via /download?file=..., /viewer.php?id=..., /pdf/<slug>, or
  // /upload/notifications/xxx.pdf?token=...
  const PDF_LIKE_HREF =
    /\.pdf(?:\?[^"']*)?(?:#[^"']*)?$|\/(?:download|viewer|attachment|file|getfile)[^"']*[?&](?:file|id|doc|attachment|name|fname)=|\/pdf\/[^"']+|\/uploads?\/[^"']*\.pdf/i

  // Match ALL anchors (not only ones containing `.pdf`) and score their href.
  // This catches UPSC/SSC style `/download?file=notif.pdf` and viewer.php wrappers.
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi
  let m
  while ((m = anchorRe.exec(html)) !== null) {
    const rawHref  = m[1]
    const linkText = m[2].replace(/<[^>]+>/g, " ").trim().toLowerCase()

    if (!PDF_LIKE_HREF.test(rawHref)) continue

    try {
      const url      = new URL(rawHref, base.href).href
      const urlLower = url.toLowerCase()

      // Hard exclude: non-recruitment document types
      if (URL_NEGATIVE.some(kw => urlLower.includes(kw))) continue

      let score = 0
      for (const kw of URL_POSITIVE)  if (urlLower.includes(kw))  score += 2
      for (const kw of TEXT_POSITIVE) if (linkText.includes(kw)) score += 3

      // Must have at least one positive signal to be considered
      if (score === 0) continue

      const existing = candidates.get(url)
      if (!existing || score > existing.score) candidates.set(url, { url, score })
    } catch { /* invalid URL — skip */ }
  }

  // Return top 3 by relevance score (highest first)
  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.url)
}

// ─── Freshness filter ────────────────────────────────────────────────────────
// Drops closed/historical recruitments post-extraction. The LLM sometimes
// returns 2023/2024 items from archived sections even when the prompt asks
// for current-year only — this is the deterministic backstop.

function isFreshRecruitment(item: ExtractedRecruitment, currentYear: number): boolean {
  // Rule 1: apply_end_date in the past → closed, skip
  if (item.apply_end_date) {
    const end = new Date(item.apply_end_date)
    if (!isNaN(end.getTime())) {
      const now = new Date()
      // Give 3-day grace in case timezone/parsing skew marks today as closed
      const threshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      if (end < threshold) return false
    }
  }
  // Rule 2: year older than currentYear - 1 → historical
  // (currentYear-1 is kept because many notifications issued in Dec span into
  //  the next calendar year for exams/application windows.)
  if (item.year && item.year < currentYear - 1) return false

  // Rule 3: title contains obvious post-recruitment artefact words → skip
  const t = (item.title ?? "").toLowerCase()
  const staleMarkers = [
    "shortlist", "shortlisted", "provisionally shortlisted",
    "answer key", "answer-key",
    "result of", "final result", "cut-off", "cut off", "cutoff",
    "admit card", "hall ticket",
    "merit list", "final list", "select list", "selected candidates",
    "interview schedule", "interview letter", "interview call",
    "appointment order", "joining letter",
    "medical examination", "document verification",
    "roll number", "allotted",
  ]
  if (staleMarkers.some(w => t.includes(w))) return false

  return true
}

// ─── Data quality scoring ─────────────────────────────────────────────────────
// Scores extracted data 0–100 based on field completeness.
// High score = admin can approve with confidence; low = needs manual review.

// ─── Deterministic field validators ──────────────────────────────────────────
// Catches mis-parsed dates / out-of-range ages that slip past confidence + quality.
function validateFields(r: ExtractedRecruitment, year: number): string[] {
  const errs: string[] = []
  if (r.apply_start_date && r.apply_end_date &&
      new Date(r.apply_end_date) < new Date(r.apply_start_date)) errs.push("apply_end_date before apply_start_date")
  if (r.apply_end_date) {
    const endYear = new Date(r.apply_end_date).getFullYear()
    if (endYear < year - 1 || endYear > year + 2) errs.push(`apply_end_date year ${endYear} outside plausible range`)
  }
  if (r.total_vacancies != null && r.total_vacancies < 0)       errs.push("negative vacancies")
  if (r.total_vacancies != null && r.total_vacancies > 100_000) errs.push("implausible vacancy count")
  for (const p of (r.posts ?? []) as Record<string, unknown>[]) {
    const minA = p.min_age as number | null | undefined
    const maxA = p.max_age as number | null | undefined
    if (typeof minA === "number" && (minA < 16 || minA > 60)) errs.push(`min_age ${minA} out of [16,60]`)
    if (typeof maxA === "number" && (maxA < 18 || maxA > 70)) errs.push(`max_age ${maxA} out of [18,70]`)
    if (typeof minA === "number" && typeof maxA === "number" && minA > maxA) errs.push("min_age > max_age")
  }
  return errs
}

// ─── Auto-approve gate ────────────────────────────────────────────────────────
// Confidence alone isn't safe: a high-confidence extraction with a mis-parsed
// end_date still becomes a wrong deadline in a user's alert feed. Require
// source-trust, quality score, and basic field validity as well.
function canAutoApprove(
  r: ExtractedRecruitment,
  quality: number,
  src: SourceRecord,
): boolean {
  if (src.trust_score < 0.80)                                  return false
  if ((r.confidence ?? 0) < 0.90)                              return false
  if (quality < 70)                                            return false
  if (!r.apply_end_date)                                       return false
  if (!r.title || r.title.length < 10)                         return false
  if (r.apply_start_date && r.apply_end_date &&
      new Date(r.apply_end_date) < new Date(r.apply_start_date)) return false
  if (validateFields(r, new Date().getFullYear()).length > 0)     return false
  return true
}

function computeDataQualityScore(item: ExtractedRecruitment): number {
  let score = 0
  if ((item.title?.trim().length ?? 0) > 5)                           score += 15
  if ((item.organization_name?.trim().length ?? 0) > 2)               score += 15
  if (item.apply_end_date)                                             score += 20
  if (item.apply_start_date)                                           score += 10
  if (item.total_vacancies != null && item.total_vacancies > 0)        score += 10
  if (Array.isArray(item.posts) && item.posts.length > 0)              score += 10
  if (item.posts?.some(p => (p as Record<string,unknown>).min_age || (p as Record<string,unknown>).max_age)) score += 10
  if (item.posts?.some(p => (p as Record<string,unknown>).education_required))                               score += 10
  return score   // 0–100
}

// ─── Playwright worker client ────────────────────────────────────────────────
// External HTTP service renders JS-heavy pages (RBI, UPSC SPA, MPPSC, etc).
// Contract: POST {url, wait_for, timeout_ms} → {html, status, final_url}.
// Returns null on any failure so the caller can mark the source as skipped
// rather than hanging the whole run.

async function renderViaPlaywright(url: string, sourceName: string): Promise<string | null> {
  if (!PLAYWRIGHT_WORKER_URL) return null
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (PLAYWRIGHT_WORKER_TOKEN) headers["x-worker-token"] = PLAYWRIGHT_WORKER_TOKEN
    const res = await fetch(`${PLAYWRIGHT_WORKER_URL.replace(/\/$/, "")}/render`, {
      method:  "POST",
      headers,
      body:    JSON.stringify({ url, wait_for: "networkidle", timeout_ms: 25_000 }),
      signal:  AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.error(`[${sourceName}] Playwright worker ${res.status}`)
      return null
    }
    const body = await res.json() as { html?: string }
    return typeof body.html === "string" && body.html.length > 0 ? body.html : null
  } catch (err) {
    console.error(`[${sourceName}] Playwright worker error:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Content acquisition ──────────────────────────────────────────────────────

async function acquireContent(
  supabase: ReturnType<typeof db>,
  src:      SourceRecord,
  year:     number,
): Promise<AcquireResult> {
  const targetUrl = src.notification_url ?? src.rss_url ?? src.api_url ?? src.official_url

  // Per-source TLS posture — only opt in to cert-ignore when the admin has
  // flagged the source (e.g. NIC subdomains with expired certs).
  const httpClient = src.insecure_tls
    ? Deno.createHttpClient({ unsafelyIgnoreCertificateErrors: true })
    : undefined

  // ── TASK 2: Playwright guard ───────────────────────────────────────────────
  // Delegate to external Playwright worker (Fly.io / Browserless / etc).
  // If the worker URL is unset or returns null, skip the source explicitly.
  if (src.adapter_type === "playwright" || src.requires_playwright) {
    const rendered = await renderViaPlaywright(targetUrl, src.source_name)
    if (!rendered) {
      await supabase.from("source_registry").update({
        last_scraped_at: new Date().toISOString(),
        last_error:      PLAYWRIGHT_WORKER_URL
          ? "Playwright worker returned null — source skipped"
          : "Playwright worker not configured — source skipped",
      }).eq("id", src.id)
      console.log(`[${src.source_name}] SKIP — Playwright unavailable`)
      return { text: "", url: targetUrl, skipped: true, headers: {} }
    }
    // Feed the rendered HTML through the normal HTML content-zone + strip pipeline.
    const contentZone = extractContentZone(rendered)
    const stripped    = htmlToLlmText(contentZone, targetUrl)
    const snapshotHash = await sha256hex(rendered)
    return { text: stripped, url: targetUrl, skipped: false, headers: {}, rawHtml: rendered, snapshotHash }
  }

  // ── RSS adapter ────────────────────────────────────────────────────────────
  if (src.adapter_type === "rss" || src.rss_url) {
    const rssUrl = src.rss_url ?? targetUrl
    const { data: cached } = await supabase
      .from("scrape_source_etags")
      .select("etag,last_modified,content_hash")
      .eq("source_id", src.id)
      .single()

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; CareerCopilot/1.0)",
    }
    if ((cached as ETagRecord | null)?.etag) headers["If-None-Match"] = (cached as ETagRecord).etag!
    if ((cached as ETagRecord | null)?.last_modified) headers["If-Modified-Since"] = (cached as ETagRecord).last_modified!

    const res = await fetch(rssUrl, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT), client: httpClient })
    if (res.status === 304) return { text: "", url: rssUrl, skipped: true, headers: {} }

    const xml  = await res.text()
    const hash = await sha256hex(xml)
    if ((cached as ETagRecord | null)?.content_hash === hash) return { text: "", url: rssUrl, skipped: true, headers: {} }

    const etag = res.headers.get("etag")
    const lm   = res.headers.get("last-modified")
    await supabase.from("scrape_source_etags").upsert({
      source_id:     src.id,
      etag:          etag ?? null,
      last_modified: lm   ?? null,
      content_hash:  hash,
      checked_at:    new Date().toISOString(),
    })

    // Try direct LLM-free extraction first.
    // If it yields results, return them in rssItems — main loop skips LLM entirely.
    // Fall back to text-for-LLM only when direct extraction finds nothing.
    const direct = extractRssDirect(xml, rssUrl, src.source_name, src.source_type ?? "Other", year)
    if (direct.length > 0) {
      console.log(`[${src.source_name}] RSS direct: ${direct.length} item(s) (no LLM used)`)
      return { text: "", url: rssUrl, skipped: false, headers: {}, rssItems: direct, snapshotHash: hash }
    }

    // Direct extraction found nothing — fall through to LLM with formatted text
    return { text: parseRssItems(xml), url: rssUrl, skipped: false, headers: {}, snapshotHash: hash }
  }

  // ── JSON adapter ───────────────────────────────────────────────────────────
  if (src.adapter_type === "json" && src.api_url) {
    const res  = await fetch(src.api_url, {
      headers:{ "User-Agent": "CareerCopilot/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      client: httpClient,
    })
    if (!res.ok) throw new Error(`JSON fetch ${res.status}`)
    const json = await res.json()
    const jsonHash = await sha256hex(JSON.stringify(json))
    return { text: flattenJson(json, src), url: src.api_url, skipped: false, headers: {}, snapshotHash: jsonHash }
  }

  // ── PDF adapter ────────────────────────────────────────────────────────────
  // Stage 2: replaced naive BT/ET regex with Anthropic PDF API.
  // Returns raw bytes so the main loop can call callClaudeOnPdf().
  if (src.adapter_type === "pdf" && src.pdf_bulletin_url) {
    const res  = await fetch(src.pdf_bulletin_url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT), client: httpClient })
    if (!res.ok) throw new Error(`PDF fetch ${res.status}`)
    const buf   = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    const pdfHash = await sha256hex(bytes)
    return { text: "", url: src.pdf_bulletin_url, skipped: false, headers: {}, pdfBytes: bytes, snapshotHash: pdfHash }
  }

  // ── HTML adapter ───────────────────────────────────────────────────────────
  {
    const { data: cached } = await supabase
      .from("scrape_source_etags")
      .select("etag,last_modified,content_hash")
      .eq("source_id", src.id)
      .single()

    const reqHeaders: Record<string, string> = {
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9",
    }
    if ((cached as ETagRecord | null)?.etag) reqHeaders["If-None-Match"] = (cached as ETagRecord).etag!
    if ((cached as ETagRecord | null)?.last_modified) reqHeaders["If-Modified-Since"] = (cached as ETagRecord).last_modified!

    const res = await fetch(targetUrl, { headers: reqHeaders, signal: AbortSignal.timeout(REQUEST_TIMEOUT), client: httpClient })
    if (res.status === 304) return { text: "", url: targetUrl, skipped: true, headers: {} }
    if (!res.ok) throw new Error(`HTML fetch ${res.status}`)

    const rawHtml = await res.text()
    const hash    = await sha256hex(rawHtml)
    if ((cached as ETagRecord | null)?.content_hash === hash) return { text: "", url: targetUrl, skipped: true, headers: {} }

    const etag = res.headers.get("etag")
    const lm   = res.headers.get("last-modified")
    await supabase.from("scrape_source_etags").upsert({
      source_id:     src.id,
      etag:          etag ?? null,
      last_modified: lm   ?? null,
      content_hash:  hash,
      checked_at:    new Date().toISOString(),
    })

    // ── TASK 9: RSS auto-discovery ─────────────────────────────────────────
    // If this HTML source has an RSS link declared in the page <head>,
    // auto-upgrade it to the rss adapter to save Claude API costs in future.
    if (src.adapter_type === "html" && !src.rss_url) {
      const rssMatch =
        rawHtml.match(/application\/(?:rss|atom)\+xml[^>]*href="([^"]+)"/i) ||
        rawHtml.match(/href="([^"]+)"[^>]*type="application\/(?:rss|atom)\+xml"/i)

      if (rssMatch?.[1]) {
        const discovered = rssMatch[1].startsWith("http")
          ? rssMatch[1]
          : `${new URL(targetUrl).origin}${rssMatch[1]}`

        await supabase
          .from("source_registry")
          .update({
            rss_url:      discovered,
            adapter_type: "rss",
            notes:        `RSS auto-discovered ${new Date().toISOString().slice(0, 10)}. Was: html.`,
            updated_at:   new Date().toISOString(),
          })
          .eq("id", src.id)

        console.log(`[${src.source_name}] RSS auto-upgraded → ${discovered}`)
      }
    }

    // Isolate main content first so the truncation budget is spent on
    // notifications, not on site chrome / sidebars. Sarkari Result was the
    // canonical failure case: 494KB raw HTML, first 25K was nav only.
    const contentZone = extractContentZone(rawHtml)
    // Convert HTML → LLM-ready text preserving anchors, headings, list items.
    // This replaces naive tag stripping which destroyed the semantic signals
    // (anchor text + href) that are the highest-value content on govt pages.
    let stripped = htmlToLlmText(contentZone, targetUrl)

    // Skip LLM call if the stripped output is clearly an unrendered JS shell.
    // Angular-style {{expr}} placeholders or sub-200-char pages carry no
    // extractable content and just burn Anthropic spend until the source is
    // upgraded to Playwright. Flag it in last_error so admin can see the queue.
    const jsTemplateMatches = (stripped.match(/\{\{[^}]+\}\}/g) ?? []).length
    if (stripped.length < 200 || (stripped.length < 2000 && jsTemplateMatches >= 3)) {
      console.log(`[${src.source_name}] HTML appears unrendered (len=${stripped.length}, {{expr}}=${jsTemplateMatches}) — skipping LLM call`)
      stripped = ""   // main loop treats empty text + no pdfs as "skip"
    }

    // ── Stage 2: PDF link detection ───────────────────────────────────────────
    // Many govt pages (UPSC, SSC, IBPS) show only a summary in HTML and put the
    // full eligibility matrix in a linked PDF. Fetch up to 3 linked PDFs so
    // Claude gets complete post-level data (age limits, education, vacancies).
    const linkedPdfs: Uint8Array[] = []
    if (src.adapter_type !== "pdf") {
      const pdfLinks = findPdfLinksInHtml(rawHtml, targetUrl)
      console.log(`[${src.source_name}] PDF links detected: ${pdfLinks.length} (text=${stripped.length}ch)`)
      // Cap at 2 PDFs/source (down from 3) to preserve the 42s time budget —
      // each PDF round-trip is 2-4s fetch + 8-15s LLM. With 2 PDFs we still
      // get the primary notification + one supplementary, and processing fits.
      for (const pdfUrl of pdfLinks.slice(0, 2)) {
        try {
          const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) })
          if (!pdfRes.ok) continue
          // Content-Type sanity: servers sometimes serve HTML error pages with
          // .pdf URLs and 200 OK. Trust the magic-byte check below over the header
          // (some govt servers send application/octet-stream for valid PDFs).
          const ct = pdfRes.headers.get("content-type")?.toLowerCase() ?? ""
          if (ct.includes("text/html")) {
            console.log(`[${src.source_name}] Skipped HTML-typed response masquerading as PDF: ${pdfUrl}`)
            continue
          }
          const buf = await pdfRes.arrayBuffer()
          if (buf.byteLength >= 20_000_000) continue  // skip PDFs > 20 MB
          const bytes = new Uint8Array(buf)
          if (!looksLikePdf(bytes)) {
            console.log(`[${src.source_name}] Skipped invalid PDF (missing %PDF- header): ${pdfUrl}`)
            continue
          }
          linkedPdfs.push(bytes)
          console.log(`[${src.source_name}] Fetched linked PDF: ${pdfUrl} (${(buf.byteLength / 1024).toFixed(0)} KB)`)
        } catch { /* non-fatal — HTML text still goes to Claude */ }
      }
    }

    return { text: stripped, url: targetUrl, skipped: false, headers: {}, linkedPdfs, rawHtml, snapshotHash: hash }
  }
}

// ─── Claude extraction ────────────────────────────────────────────────────────
// Returns ALL recruitments found on a page (Employment News / UPSC Current
// Openings can have 10–30 separate notifications — the old single-object
// approach silently dropped all but the first).

// ─── Gemini low-level fetch (with rate limiter + one retry on 429) ────────────

async function geminiFetch(body: object, sourceName: string, label: string): Promise<Response | null> {
  // Short-circuit: if we already confirmed daily quota is gone this run, don't waste time
  if (_geminiDailyQuotaExhausted) {
    console.warn(`[${sourceName}] Gemini ${label} — daily quota exhausted this run, skipping`)
    return null
  }

  await geminiRateLimit()

  let res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(CLAUDE_TIMEOUT),
  })

  if (res.status === 429) {
    // Per-minute rate limit — wait briefly and retry once before giving up on Gemini.
    console.warn(`[${sourceName}] Gemini ${label} rate limited (429) — retrying in ${GEMINI_RETRY_WAIT / 1000}s`)
    await sleep(GEMINI_RETRY_WAIT)
    _geminiLastCallMs = 0  // force rate limiter to allow immediate retry
    await geminiRateLimit()
    res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_KEY}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(CLAUDE_TIMEOUT),
      
    })
  }

  if (res.status === 429) {
    // Distinguish genuine daily quota from a persistent per-minute throttle.
    // Gemini emits both as 429 + RESOURCE_EXHAUSTED — the difference is in the
    // quotaMetric / quotaId field inside the error body. Daily metrics contain
    // "PerDay"; per-minute metrics contain "PerMinute". Matching bare "quota"
    // (the previous heuristic) was a false positive because every 429 body
    // mentions the word "quota", which disabled Gemini for the whole run after
    // one per-minute hiccup.
    const errBody = await res.clone().text().catch(() => "")
    const isDaily =
      /PerDay/i.test(errBody) ||
      /per[\s-]?day/i.test(errBody) ||
      /daily[\s_-]?limit/i.test(errBody) ||
      /daily[\s_-]?quota/i.test(errBody)
    if (isDaily) {
      _geminiDailyQuotaExhausted = true
      console.warn(`[${sourceName}] Gemini ${label} DAILY quota exhausted — disabling Gemini for this run. Wait until midnight Pacific for reset.`)
    } else {
      console.warn(`[${sourceName}] Gemini ${label} persistent per-minute rate limit — skipping source (Gemini remains enabled for other sources)`)
    }
    return null
  }
  if (!res.ok) {
    console.error(`[${sourceName}] Gemini ${label} API ${res.status} — skipping`)
    return null
  }
  return res
}

// ─── Gemini extraction — text ─────────────────────────────────────────────────
// Returns null ONLY on genuine failure (exhausted retries, not a transient 429).
// Returns [] when the model ran OK but found no recruitments.

async function callGemini(
  text:       string,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[] | null> {
  if (!GEMINI_KEY) return null

  const prompt    = makeExtractionPrompt(sourceUrl, sourceName, year)
  const truncated = text.slice(0, MAX_LLM_INPUT_CHARS)

  try {
    const res = await geminiFetch({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\nTEXT:\n${truncated}` }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    }, sourceName, "text")

    if (!res) return null

    const data    = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw     = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    const results = stampProvenance(parseClaudeRecruitmentResponse(raw), "gemini", GEMINI_MODEL)
    console.log(`[${sourceName}] Gemini text: ${results.length} recruitment(s) (in=${truncated.length}ch)`)
    if (results.length === 0) {
      console.log(`[${sourceName}] Gemini 0-result sample: ${truncated.slice(0, 300).replace(/\s+/g, " ")}`)
    }
    return results
  } catch (err) {
    console.error(`[${sourceName}] callGemini error:`, err)
    return null
  }
}

// ─── Gemini extraction — PDF ──────────────────────────────────────────────────

async function callGeminiOnPdf(
  pdfBytes:   Uint8Array,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[] | null> {
  if (!GEMINI_KEY) return null
  if (pdfBytes.length > 20_000_000) return null  // >20 MB — skip

  const base64 = toBase64(pdfBytes)
  const prompt  = makeExtractionPrompt(sourceUrl, sourceName, year)

  try {
    const res = await geminiFetch({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
    }, sourceName, "PDF")

    if (!res) return null

    const data    = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw     = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    const results = stampProvenance(parseClaudeRecruitmentResponse(raw), "gemini", GEMINI_MODEL)
    console.log(`[${sourceName}] Gemini PDF: ${results.length} recruitment(s)`)
    return results
  } catch (err) {
    console.error(`[${sourceName}] callGeminiOnPdf error:`, err)
    return null
  }
}

// ─── Unified extraction wrappers ──────────────────────────────────────────────
// Anthropic is PRIMARY (paid, reliable, no rate limit at typical scraping volume).
// Gemini is FALLBACK — activates only when Anthropic key is absent or API errors.
// null from either function = "I can't handle this call, try the other one".
// [] from either function = "I ran fine, there's simply nothing to extract".

async function extractFromText(
  text:       string,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[]> {
  if (ANTHROPIC_KEY) {
    const result = await callClaude(text, sourceUrl, sourceName, year)
    if (result !== null) return result   // null = API error → try Gemini
  }
  // Gemini fallback (free tier, rate-limited)
  return await callGemini(text, sourceUrl, sourceName, year) ?? []
}

async function extractFromPdf(
  pdfBytes:   Uint8Array,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[]> {
  if (ANTHROPIC_KEY) {
    const result = await callClaudeOnPdf(pdfBytes, sourceUrl, sourceName, year)
    if (result !== null) return result
  }
  // Gemini PDF fallback
  return await callGeminiOnPdf(pdfBytes, sourceUrl, sourceName, year) ?? []
}

// ─── Anthropic extraction — text (primary) ────────────────────────────────────
// Returns null on API error so extractFromText() can try Gemini fallback.
// Returns [] when the model ran OK but found no recruitments on the page.

async function callClaude(
  text:       string,
  sourceUrl:  string,
  sourceName: string,
  year:       number
): Promise<ExtractedRecruitment[] | null> {
  if (!ANTHROPIC_KEY) return null  // no key → caller will try Gemini
  const model = currentClaudeModel()
  if (!model) return null

  const prompt    = makeExtractionPrompt(sourceUrl, sourceName, year)
  const truncated = text.slice(0, MAX_LLM_INPUT_CHARS)

  try {
    await anthropicRateLimit()
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: `${prompt}\n\nTEXT:\n${truncated}` }],
      }),
      signal: AbortSignal.timeout(CLAUDE_TIMEOUT),

    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "10", 10)
      const wait = Math.min(retryAfter, 10) * 1000
      console.warn(`[${sourceName}] Anthropic text 429 rate limit — retrying in ${wait / 1000}s`)
      await sleep(wait)
      await anthropicRateLimit()
      // single retry
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: `${makeExtractionPrompt(sourceUrl, sourceName, year)}\n\nTEXT:\n${text.slice(0, MAX_LLM_INPUT_CHARS)}` }] }),
        signal: AbortSignal.timeout(CLAUDE_TIMEOUT),
      })
      // If still rate-limited on retry, return [] (not null) so the cross-provider
      // Gemini fallback does NOT trigger — the cascading 429 → Gemini path is
      // exactly what burned our daily quota in earlier runs.
      if (res2.status === 429) {
        console.warn(`[${sourceName}] Anthropic text still 429 after retry — dropping source (not cascading to Gemini)`)
        return []
      }
      if (!res2.ok) { console.error(`[${sourceName}] Anthropic text retry ${res2.status}`); return null }
      const data2 = await res2.json() as { content?: Array<{ type: string; text: string }> }
      return stampProvenance(parseClaudeRecruitmentResponse(data2.content?.find(b => b.type === "text")?.text ?? ""), "anthropic", model)
    }
    if (res.status === 404 || res.status === 401) {
      const body = await res.text().catch(() => "")
      console.error(`[${sourceName}] Anthropic text ${res.status} body=${body.slice(0, 300)}`)
      markClaudeModelDead(String(res.status), sourceName)
      // Retry once with the next model in the fallback list (same call).
      return await callClaude(text, sourceUrl, sourceName, year)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[${sourceName}] Anthropic text ${res.status} body=${body.slice(0, 300)} — trying Gemini fallback`)
      return null
    }

    const data    = await res.json() as { content?: Array<{ type: string; text: string }> }
    const raw     = data.content?.find(b => b.type === "text")?.text ?? ""
    const results = stampProvenance(parseClaudeRecruitmentResponse(raw), "anthropic", model)
    console.log(`[${sourceName}] Anthropic text: ${results.length} recruitment(s) (in=${truncated.length}ch)`)
    // Diagnostic: when extraction yields 0 and we sent meaningful content, log
    // a sample so we can tell whether the page is JS-empty vs content-present.
    if (results.length === 0) {
      console.log(`[${sourceName}] Anthropic 0-result sample: ${truncated.slice(0, 300).replace(/\s+/g, " ")}`)
    }
    return results
  } catch (err) {
    console.error(`[${sourceName}] callClaude error:`, err)
    return null
  }
}

// ─── Evidence helpers ─────────────────────────────────────────────────────────
// findEvidenceSnippet: locate a value's source text within the raw document.
// Never hallucinates — returns null evidence_text when no match is found.

function findEvidenceSnippet(
  rawText: string,
  value:   unknown,
  _fieldName: string,
): { evidence_text: string | null; char_start: number | null; char_end: number | null } {
  if (value === null || value === undefined || rawText.length === 0) {
    return { evidence_text: null, char_start: null, char_end: null }
  }

  const CONTEXT = 250  // chars of surrounding context each side
  const MAX_SNIPPET = 500

  // Candidates to search for (string value + common Indian date formats)
  const candidates: string[] = []

  if (typeof value === "string" && value.length >= 2) {
    candidates.push(value)
    // ISO date → try DD/MM/YYYY and DD-Mon-YYYY variants
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
      const day  = isoMatch[3]
      const mon  = parseInt(isoMatch[2], 10) - 1
      const yr   = isoMatch[1]
      candidates.push(`${day}/${isoMatch[2]}/${yr}`)
      candidates.push(`${day}-${months[mon]}-${yr}`)
      candidates.push(`${parseInt(day, 10)} ${months[mon]} ${yr}`)
    }
  } else if (typeof value === "number") {
    candidates.push(String(value))
    if (value > 100) candidates.push(value.toLocaleString("en-IN"))
  } else if (Array.isArray(value)) {
    const flat = (value as unknown[]).filter(v => typeof v === "string").join(" ")
    if (flat.length >= 2) candidates.push(flat.slice(0, 60))
  }

  for (const candidate of candidates) {
    if (candidate.length < 2) continue
    const idx = rawText.indexOf(candidate)
    if (idx === -1) continue
    const start   = Math.max(0, idx - CONTEXT)
    const end     = Math.min(rawText.length, idx + candidate.length + CONTEXT)
    const snippet = rawText.slice(start, end).slice(0, MAX_SNIPPET)
    return { evidence_text: snippet, char_start: idx, char_end: idx + candidate.length }
  }

  return { evidence_text: null, char_start: null, char_end: null }
}

// buildEvidenceRows: generate extracted_field_evidence insert payloads for all
// important fields of an ExtractedRecruitment.

interface EvidenceInsert {
  document_id:         string
  scrape_queue_id:     string | null
  entity_type:         string
  entity_key:          string | null
  field_name:          string
  extracted_value:     unknown
  evidence_text:       string | null
  char_start:          number | null
  char_end:            number | null
  extraction_method:   string
  model:               string | null
  confidence:          number | null
  reviewer_status:     string
}

function buildEvidenceRows(
  documentId:    string,
  queueItemId:   string | null,
  extracted:     ExtractedRecruitment,
  rawText:       string,
  provider:      string,
  model:         string | null,
  promptVersion: string | null,
): EvidenceInsert[] {
  void promptVersion
  const method = provider === "rss_direct" ? "rss_direct"
    : provider === "selectors"             ? "selector"
    : provider === "anthropic"             ? "anthropic"
    : provider === "gemini"                ? "gemini"
    : "system"

  const rows: EvidenceInsert[] = []

  const addField = (
    entityType: string,
    entityKey:  string | null,
    fieldName:  string,
    value:      unknown,
  ) => {
    if (value === null || value === undefined) return
    if (typeof value === "string" && value.trim() === "") return
    if (Array.isArray(value) && value.length === 0) return

    const { evidence_text, char_start, char_end } = findEvidenceSnippet(rawText, value, fieldName)

    rows.push({
      document_id:       documentId,
      scrape_queue_id:   queueItemId,
      entity_type:       entityType,
      entity_key:        entityKey,
      field_name:        fieldName,
      extracted_value:   typeof value === "object" ? value : { value },
      evidence_text,
      char_start,
      char_end,
      extraction_method: method,
      model,
      confidence:        extracted.confidence ?? null,
      reviewer_status:   "unverified",
    })
  }

  // Recruitment-level fields
  addField("recruitment", null, "title",                     extracted.title)
  addField("recruitment", null, "organization_name",         extracted.organization_name)
  addField("recruitment", null, "notification_date",         extracted.notification_date)
  addField("recruitment", null, "apply_start_date",          extracted.apply_start_date)
  addField("recruitment", null, "apply_end_date",            extracted.apply_end_date)
  addField("recruitment", null, "total_vacancies",           extracted.total_vacancies)
  addField("recruitment", null, "official_notification_url", extracted.official_notification_url)
  addField("recruitment", null, "source_pdf_url",            extracted.source_pdf_url)

  // Post-level fields
  for (const post of (extracted.posts ?? []) as Record<string, unknown>[]) {
    const postName = typeof post.post_name === "string" ? post.post_name : null
    addField("post", postName, "post_name",          post.post_name)
    addField("post", postName, "group_type",         post.group_type)
    addField("post", postName, "pay_level",          post.pay_level)
    addField("post", postName, "vacancies",          post.vacancies)
    addField("age_criteria",   postName, "min_age",  post.min_age)
    addField("age_criteria",   postName, "max_age",  post.max_age)
    addField("education_criteria", postName, "education_required", post.education_required)
    addField("education_criteria", postName, "disciplines",        post.disciplines)
  }

  return rows
}

// upsertNotificationDocument: insert a notification_documents row and return its id.
// Deduplicates on content_hash — ON CONFLICT returns the existing id.

async function upsertNotificationDocument(
  supabase:     ReturnType<typeof db>,
  params: {
    sourceId:     string
    runId:        string | null
    sourceUrl:    string
    finalUrl:     string | null
    documentType: "html" | "pdf" | "rss" | "json" | "unknown"
    contentHash:  string
    httpStatus:   number | null
    etag:         string | null
    lastModified: string | null
    rawText:      string | null
    metadata:     Record<string, unknown>
  },
): Promise<string | null> {
  try {
    // Try insert first; on hash conflict, select the existing row.
    const { data: inserted, error: insErr } = await supabase
      .from("notification_documents")
      .insert({
        source_id:       params.sourceId,
        scrape_run_id:   params.runId,
        source_url:      params.sourceUrl,
        final_url:       params.finalUrl,
        document_type:   params.documentType,
        content_hash:    params.contentHash,
        fetched_at:      new Date().toISOString(),
        http_status:     params.httpStatus,
        etag:            params.etag,
        last_modified:   params.lastModified,
        raw_text:        params.rawText ? params.rawText.slice(0, 100_000) : null,
        metadata:        params.metadata,
      })
      .select("id")
      .single()

    if (!insErr) return inserted?.id ?? null

    // Duplicate content_hash — fetch existing id
    if (insErr.code === "23505") {
      const { data: existing } = await supabase
        .from("notification_documents")
        .select("id")
        .eq("content_hash", params.contentHash)
        .single()
      return existing?.id ?? null
    }

    console.error("[upsertNotificationDocument]", insErr.message)
    return null
  } catch (e) {
    console.error("[upsertNotificationDocument] unexpected:", e)
    return null
  }
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

function fingerprintKey(orgName: string, year: number, title: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  return `${norm(orgName)}-${year}-${norm(title).slice(0, 30)}`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const body        = req.method === "POST"
    ? await req.json().catch(() => ({})) as Record<string, unknown>
    : {}
  // ── Startup env validation ────────────────────────────────────────────────
  const { warnings: envWarnings } = validateEnv()

  const triggeredBy = (body.triggered_by as string) ?? "scheduled"
  const forceRun    = body.force === true

  // Idempotency guard (skip for admin force runs)
  if (!forceRun && triggeredBy === "scheduled" && await isAlreadyRunning()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "run_already_in_progress" }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  const supabase   = db()
  const now        = new Date()
  const year       = now.getFullYear()
  console.log(`[run] version=${FUNCTION_VERSION} year=${year}`)
  const errors:    RunError[] = []
  let totalFound   = 0
  let totalNew     = 0
  let totalDup     = 0
  let totalSkipped = 0
  let totalFanout  = 0
  const runStart   = Date.now()

  // ── Create run record ──────────────────────────────────────────────────────
  const { data: run } = await supabase
    .from("scrape_runs")
    .insert({ status: "running", triggered_by: triggeredBy, function_version: FUNCTION_VERSION })
    .select("id")
    .single()
  const runId = run?.id as string | null

  // ── TASK 6: Load sources without hard limit — time budget controls instead ──
  const { data: allSources } = await supabase
    .from("source_registry")
    .select("*")
    .eq("is_active", true)
    .lt("consecutive_fails", 10)
    .order("tier",            { ascending: true })
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(100)  // safety cap: never load the entire table, but not an artificial limit

  const dueSources = ((allSources ?? []) as SourceRecord[]).filter(s => isDue(s, now))

  // ── Load existing fingerprints for dedup ────────────────────────────────────
  const { data: existingRecs } = await supabase
    .from("recruitments")
    .select("id, name, year, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(500)

  const existingFps = new Map<string, string>()
  for (const r of existingRecs ?? []) {
    const orgName = (r.organizations as { name: string } | null)?.name ?? ""
    existingFps.set(fingerprintKey(orgName, r.year, r.name), r.id)
  }

  // ── Process each source ────────────────────────────────────────────────────
  for (const src of dueSources) {
    // TASK 6: time budget check before each source
    if (Date.now() - runStart > RUN_BUDGET_MS) {
      console.log(`[scraper] Time budget (${RUN_BUDGET_MS}ms) reached after processing ${dueSources.indexOf(src)} sources`)
      break
    }

    // Abort-early: if both LLM providers are dead, stop grinding sources to
    // zero output. This also flips the run into "failed" downstream.
    if (_claudeDisabled && _geminiDailyQuotaExhausted) {
      const remaining = dueSources.length - dueSources.indexOf(src)
      console.error(`[scraper] Both LLMs down — aborting remaining ${remaining} source(s)`)
      errors.push({ source: "*", error: "All LLM providers exhausted", at: now.toISOString() })
      break
    }

    const startMs = Date.now()

    try {
      // TASK 4: source-aware jitter
      await sleep(jitter(src))

      const { text, url, skipped, pdfBytes, linkedPdfs, rssItems, rawHtml, snapshotHash } = await acquireContent(supabase, src, year)

      // ── Store document snapshot (non-fatal) ────────────────────────────────
      // Upsert a notification_documents row so every extracted value can be
      // traced back to its source document. Deduplicates on content_hash.
      let documentId: string | null = null
      if (!skipped && snapshotHash) {
        const docType: "html" | "pdf" | "rss" | "json" | "unknown" =
          pdfBytes        ? "pdf"
          : rssItems      ? "rss"
          : src.adapter_type === "json" ? "json"
          : src.adapter_type === "html" || src.adapter_type === "playwright" ? "html"
          : "unknown"

        documentId = await upsertNotificationDocument(supabase, {
          sourceId:     src.id,
          runId:        runId,
          sourceUrl:    url,
          finalUrl:     null,
          documentType: docType,
          contentHash:  snapshotHash,
          httpStatus:   200,
          etag:         null,
          lastModified: null,
          rawText:      rssItems ? null : (text ?? rawHtml ?? null),
          metadata: {
            adapter_type:       src.adapter_type,
            source_name:        src.source_name,
            snapshotHash,
            linked_pdf_count:   linkedPdfs?.length ?? 0,
            playwright_used:    src.requires_playwright || src.adapter_type === "playwright",
          },
        })
      }

      // rawText for evidence lookup: prefer stripped text, fall back to rawHtml
      const rawTextForEvidence = text || rawHtml || ""

      if (skipped) {
        totalSkipped++
        await supabase.from("source_registry").update({ last_scraped_at: now.toISOString() }).eq("id", src.id)
        await supabase.from("source_health_metrics").insert({
          source_registry_id: src.id,
          source_id:          src.id,
          fetch_duration_ms:  Date.now() - startMs,
          http_status:        304,
          parse_success:      true,
          items_extracted:    0,
          confidence_avg:     null,
        })
        continue
      }

      if (!text.trim() && !pdfBytes && !rssItems && (!linkedPdfs || linkedPdfs.length === 0)) {
        totalSkipped++
        // Still update the timestamp so the source isn't retried immediately on
        // every run. An empty-extractable source is a data-shape issue, not a
        // fetch failure — don't increment consecutive_fails here.
        await supabase.from("source_registry").update({
          last_scraped_at: now.toISOString(),
          last_error:      "Empty content after stripping — likely JS-rendered, needs Playwright",
        }).eq("id", src.id)
        continue
      }

      // ── Stage 2: Route to extractor ──────────────────────────────────────────
      // RSS direct: no LLM, zero cost — structured data already parsed.
      // PDF: Gemini (primary) or Anthropic (fallback) PDF extraction.
      // HTML/RSS-text: Gemini (primary) or Anthropic (fallback) text extraction.
      let extractedList: ExtractedRecruitment[] = []

      if (rssItems) {
        // RSS direct extraction — LLM completely bypassed
        extractedList = rssItems
      } else if (pdfBytes) {
        // Dedicated PDF source — send bytes directly (Gemini → Anthropic fallback)
        extractedList = await extractFromPdf(pdfBytes, url, src.source_name, year)
      } else {
        // Try deterministic selectors first — zero LLM cost. Falls through to LLM on empty.
        if (rawHtml && src.selectors) {
          const viaSelectors = extractFromSelectors(rawHtml, url, src, year)
          if (viaSelectors.length > 0) {
            console.log(`[${src.source_name}] Selectors: ${viaSelectors.length} item(s) (no LLM used)`)
            extractedList = viaSelectors
          }
        }
        if (extractedList.length === 0 && text.trim()) {
          extractedList = await extractFromText(text, url, src.source_name, year)
        }
        // Also extract from any linked PDFs and merge (dedup by title fingerprint)
        for (const pdf of (linkedPdfs ?? [])) {
          const pdfResults = await extractFromPdf(pdf, url, src.source_name, year)
          for (const r of pdfResults) {
            const fp = fingerprintKey(r.organization_name, r.year, r.title)
            if (!extractedList.some(e => fingerprintKey(e.organization_name, e.year, e.title) === fp)) {
              extractedList.push(r)
            }
          }
        }
      }

      // Apply freshness filter BEFORE confidence filter so stale-but-high-confidence
      // items (e.g. 2024 shortlists) don't waste slots in the approval queue.
      const beforeFresh = extractedList.length
      const freshItems  = extractedList.filter(r => isFreshRecruitment(r, year))
      const droppedStale = beforeFresh - freshItems.length
      if (droppedStale > 0) {
        console.log(`[${src.source_name}] Freshness filter dropped ${droppedStale} stale/closed item(s)`)
      }

      // Health metric: now includes actual item count and avg confidence
      const validItems = freshItems.filter(r => r.title && (r.confidence ?? 0) >= 0.30)
      await supabase.from("source_health_metrics").insert({
        source_registry_id: src.id,
        source_id:          src.id,  // legacy FK — kept until migration fully applied
        fetch_duration_ms:  Date.now() - startMs,
        http_status:        200,
        parse_success:      validItems.length > 0,
        items_extracted:    validItems.length,
        confidence_avg:     validItems.length > 0
          ? validItems.reduce((s, r) => s + (r.confidence ?? 0), 0) / validItems.length
          : null,
      })

      if (validItems.length === 0) {
        totalSkipped++
        // Diagnostic: surface input characteristics so admin can tell whether
        // this is a JS-rendered shell (needs Playwright) vs a valid page whose
        // notifications simply didn't match the confidence threshold.
        const textLen   = text?.length ?? 0
        const linkedCnt = linkedPdfs?.length ?? 0
        const reason    = textLen < 500 && linkedCnt === 0
          ? "likely JS-rendered SPA — needs Playwright adapter"
          : `extracted ${extractedList.length} items, all below confidence 0.30`
        console.log(`[${src.source_name}] 0-extraction — text=${textLen}ch, linkedPdfs=${linkedCnt}, ${reason}`)
        // Do NOT increment consecutive_fails — 0-result is a data-shape issue,
        // not a fetch failure. Incrementing here triggered exponential backoff
        // that hid JS-rendered sources behind ever-longer retry intervals and
        // eventually disabled them (consecutive_fails >= 10 filters them out).
        // True fetch/API failures still fall through to the catch block below.
        await supabase.from("source_registry").update({
          last_scraped_at: now.toISOString(),
          last_error:      `No recruitments extracted (${reason})`,
        }).eq("id", src.id)
        continue
      }

      // Process each recruitment extracted from this source
      let sourceHadNew = false

      for (const extracted of validItems) {
        totalFound++

        // ── Stage 3: Data quality score ─────────────────────────────────────
        const qualityScore = computeDataQualityScore(extracted)

        const fp          = fingerprintKey(extracted.organization_name, extracted.year, extracted.title)
        const dupId       = existingFps.get(fp) ?? null
        const isDup       = Boolean(dupId)

        // RSS-direct items must never auto-approve: they have posts=[] and no
        // post-level age/education data — promoting them creates phantom
        // recruitments that the eligibility engine can't evaluate.
        const isRssDirect = extracted._provider === "rss_direct"
        const queueStatus = isDup ? "duplicate"
          : (isRssDirect || !canAutoApprove(extracted, qualityScore, src)) ? "pending"
          : "approved"

        // extraction_status: RSS/selectors → unverified; LLM → unverified (needs review)
        const extractionStatus = isDup ? "duplicate"
          : isRssDirect              ? "unverified"
          : (extracted._provider === "selectors") ? "unverified"
          : "unverified"

        console.log(`[${src.source_name}] "${extracted.title.slice(0, 50)}" conf=${(extracted.confidence ?? 0).toFixed(2)} quality=${qualityScore} status=${queueStatus} provider=${extracted._provider ?? "?"}`)

        if (isDup) {
          totalDup++
        } else {
          totalNew++
          sourceHadNew = true
          existingFps.set(fp, "queued")
        }

        const { confidence: _conf, _provider: _p, _model: _m, ...dataWithoutConf } = extracted
        void _conf; void _p; void _m

        let aggregatorListingId: string | null = null
        let candidateId: string | null = null

        const toHost = (raw: string | null | undefined): string | null => {
          if (!raw) return null
          try {
            const withProto = raw.startsWith("http") ? raw : `https://${raw}`
            return new URL(withProto).hostname.replace(/^www\./, "").toLowerCase()
          } catch {
            return null
          }
        }
        const sourceHost = toHost(url) ?? toHost(src.official_url)
        const officialHost = toHost(extracted.official_notification_url)
        const officialSourceResolved = src.source_type === "aggregator"
          ? Boolean(officialHost && sourceHost && officialHost !== sourceHost)
          : Boolean(officialHost)

        if (src.source_type === "aggregator") {
          const listingHash = await sha256hex(
            `${src.id}|${extracted.title}|${extracted.official_notification_url ?? url}|${extracted.apply_end_date ?? ""}`.toLowerCase(),
          )
          const listingStatus = officialSourceResolved ? "official_source_found" : "needs_official_source"

          const { data: listingRow } = await supabase
            .from("aggregator_listings")
            .upsert({
              source_id: src.id,
              listing_url: extracted.official_notification_url ?? url,
              listing_title: extracted.title,
              listing_hash: listingHash,
              listing_published_at: extracted.notification_date
                ? new Date(extracted.notification_date).toISOString()
                : null,
              status: listingStatus,
              updated_at: new Date().toISOString(),
            }, { onConflict: "source_id,listing_hash" })
            .select("id")
            .single()
          aggregatorListingId = listingRow?.id ?? null

          const candidateKey = `${(extracted.organization_name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${(extracted.title ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")}|${extracted.year ?? new Date().getFullYear()}`
          const { data: candRow } = await supabase
            .from("recruitment_candidates")
            .upsert({
              canonical_key: candidateKey,
              title_hint: extracted.title,
              organization_hint: extracted.organization_name,
              year_hint: extracted.year ?? null,
              status: officialSourceResolved ? "official_notification_found" : "aggregator_confirmed",
              updated_at: new Date().toISOString(),
            }, { onConflict: "canonical_key" })
            .select("id")
            .single()
          candidateId = candRow?.id ?? null
        }

        const { data: queueRow, error: queueErr } = await supabase
          .from("scrape_queue")
          .insert({
            source_url:                url,
            source_name:               src.source_name,
            extracted_data:            dataWithoutConf as unknown as Record<string, unknown>,
            confidence_score:          extracted.confidence,
            data_quality_score:        qualityScore,
            status:                    queueStatus,
            scrape_run_id:             runId,
            duplicate_of:              dupId,
            raw_snapshot_hash:         snapshotHash ?? null,
            extraction_provider:       extracted._provider ?? null,
            extraction_model:          extracted._model    ?? null,
            prompt_version:            (extracted._provider === "anthropic" || extracted._provider === "gemini") ? PROMPT_VERSION : null,
            // trust/evidence columns (migration 017)
            notification_document_id:  documentId,
            extraction_status:         extractionStatus,
            evidence_required:         true,
            official_source_resolved:  officialSourceResolved,
            official_source_host:      officialHost,
          })
          .select("id")
          .single()

        // Generate field-level evidence rows (non-fatal — don't block the scrape run)
        if (!queueErr && queueRow?.id && documentId) {
          if (candidateId) {
            await supabase.from("candidate_observations").insert({
              candidate_id:     candidateId,
              listing_id:       aggregatorListingId,
              source_id:        src.id,
              scrape_queue_id:  queueRow.id,
              confidence_score: extracted.confidence ?? null,
              payload: {
                title: extracted.title,
                organization_name: extracted.organization_name,
                official_notification_url: extracted.official_notification_url,
              },
            })
          }
          try {
            const evidenceRows = buildEvidenceRows(
              documentId,
              queueRow.id,
              extracted,
              rawTextForEvidence,
              extracted._provider ?? "system",
              extracted._model ?? null,
              (extracted._provider === "anthropic" || extracted._provider === "gemini") ? PROMPT_VERSION : null,
            )
            if (evidenceRows.length > 0) {
              await supabase
                .from("extracted_field_evidence")
                .insert(evidenceRows)
                .then(({ error: evErr }) => {
                  if (evErr) console.error(`[${src.source_name}] evidence insert:`, evErr.message)
                  else console.log(`[${src.source_name}] ${evidenceRows.length} evidence row(s) inserted`)
                })
            }
          } catch (evEx) {
            console.error(`[${src.source_name}] evidence generation error:`, evEx)
          }
        }

        if (queueStatus === "approved") {
          await supabase.rpc("fn_auto_recompute_eligibility", {
            p_source_name: src.source_name,
          }).then(() => { /* non-fatal */ }).catch(() => { /* non-fatal */ })
        }
      }

      // Update source health once — after all its recruitments are processed
      await supabase.from("source_registry").update({
        last_scraped_at:   now.toISOString(),
        ...(sourceHadNew ? { last_success_at: now.toISOString() } : {}),
        consecutive_fails: 0,
        last_error:        null,
      }).eq("id", src.id)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ source: src.source_name, error: msg, at: now.toISOString() })

      await supabase.from("source_registry").update({
        last_scraped_at:   now.toISOString(),
        consecutive_fails: src.consecutive_fails + 1,
        last_error:        msg.slice(0, 500),
      }).eq("id", src.id)

      await supabase.from("source_health_metrics").insert({
        source_registry_id: src.id,
        source_id:          src.id,
        fetch_duration_ms:  Date.now() - startMs,
        parse_success:      false,
        items_extracted:    0,
        error_message:      msg.slice(0, 500),
      })
    }
  }

  // ── Fan-out pending alert events ───────────────────────────────────────────
  const { data: pendingEvents } = await supabase
    .from("alert_events")
    .select("id")
    .eq("fanout_status", "pending")
    .order("priority",   { ascending: true })
    .order("created_at", { ascending: true })
    .limit(30)

  for (const event of pendingEvents ?? []) {
    const { data: fanned } = await supabase
      .rpc("fn_fanout_alert_event", { p_event_id: event.id })
      .then(r => r)
      .catch(() => ({ data: 0 }))
    totalFanout += (fanned as number) ?? 0
  }

  // ── Finalise run ───────────────────────────────────────────────────────────
  const health    = providersState()
  const bothDown  = health.anthropic === "down" && health.gemini === "down"
  const runStatus =
    bothDown && totalFound === 0                                           ? "failed"
    : errors.length >= dueSources.length && dueSources.length > 0          ? "failed"
    : errors.length > 0 || bothDown                                        ? "partial"
    :                                                                        "completed"

  await supabase.from("scrape_runs").update({
    finished_at:      now.toISOString(),
    status:           runStatus,
    sources_checked:  dueSources.length,
    items_found:      totalFound,
    items_new:        totalNew,
    items_duplicate:  totalDup,
    error_log:        errors,
    providers_health: health,
    function_version: FUNCTION_VERSION,
  }).eq("id", runId)

  // ── TASK 10: Webhook notification ─────────────────────────────────────────
  const webhookUrl = Deno.env.get("SCRAPER_WEBHOOK_URL")
  if (webhookUrl && (totalNew > 0 || errors.length > 0)) {
    const icon    = runStatus === "failed" ? "🔴" : runStatus === "partial" ? "🟡" : "🟢"
    const message = [
      `${icon} Career Copilot scraper run complete`,
      `Sources: ${dueSources.length} checked | New: ${totalNew} | Dupes: ${totalDup} | Skipped: ${totalSkipped}`,
      errors.length > 0
        ? `Errors (${errors.length}): ${errors.slice(0, 3).map(e => e.source).join(", ")}${errors.length > 3 ? " ..." : ""}`
        : "No errors",
    ].join("\n")

    await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: message }),
    }).catch(() => { /* webhook failure is non-fatal */ })
  }

  return new Response(
    JSON.stringify({
      runId,
      sourcesChecked:  dueSources.length,
      totalFound,
      totalNew,
      envWarnings,
      totalDuplicate:  totalDup,
      totalSkipped,
      usersNotified:   totalFanout,
      errors:          errors.length,
      status:          runStatus,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})

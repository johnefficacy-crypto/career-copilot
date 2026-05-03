"use server"

/**
 * actions/inspect-source.ts
 * Career Copilot — Source Inspector Probes
 *
 * Runs the full field-detection workflow from the guide against any URL:
 *  1. SSL / reachability check
 *  2. JSON API probe (wp-json, /api/, XHR patterns)
 *  3. RSS / Atom feed discovery
 *  4. HTML server-render check (content visible in plain fetch)
 *  5. SPA / JS-only detection (empty body heuristic)
 *  6. PDF-only detection (all links are .pdf)
 *  7. Anti-bot risk assessment (response headers + timing)
 *  8. CAPTCHA signal detection
 *  9. robots.txt check
 * 10. Auto-suggest all source_registry fields
 *
 * All probes are standard fetch() calls — the server-side equivalent of curl.
 * No external dependencies required.
 */

import { redirect } from "next/navigation"
import { requireAdminRole } from "@/lib/db/admin"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProbeStatus = "pass" | "fail" | "warn" | "skip" | "running"

export interface ProbeResult {
  id:          string
  label:       string
  status:      ProbeStatus
  detail:      string
  raw?:        string   // excerpt of response body/headers for display
  durationMs?: number
}

export interface InspectionResult {
  url:          string
  inspectedAt:  string
  probes:       ProbeResult[]
  suggested: {
    adapter_type:          string
    requires_playwright:   boolean
    has_captcha:           boolean
    pdf_only:              boolean
    anti_bot_risk:         string
    trust_score:           number
    rss_url:               string | null
    api_url:               string | null
    is_active:             boolean
    scrape_interval_hours: number
  }
  summary: string
}

export interface InspectSourceResult {
  success: boolean
  error?:  string
  data?:   InspectionResult
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const FETCH_OPTS: RequestInit = {
  headers: {
    "User-Agent":      UA,
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control":   "no-cache",
  },
  redirect: "follow",
  signal:   AbortSignal.timeout(12_000),
}

const RSS_PATHS = ["/rss.xml", "/feed", "/feed.xml", "/atom.xml", "/rss/", "/rss", "/feeds/posts/default"]
const JSON_PATHS = ["/wp-json/wp/v2/posts", "/api/recruitments", "/api/jobs", "/api/notifications", "/api/v1/posts"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("http")) return `https://${trimmed}`
  return trimmed
}

function excerpt(text: string, len = 300): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > len ? clean.slice(0, len) + "…" : clean
}

function getOrigin(url: string): string {
  try { return new URL(url).origin } catch { return url }
}

async function timedFetch(url: string, opts: RequestInit = {}): Promise<{
  res: Response | null
  durationMs: number
  error: string | null
}> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { ...FETCH_OPTS, ...opts })
    return { res, durationMs: Date.now() - t0, error: null }
  } catch (err) {
    return { res: null, durationMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Individual probes ────────────────────────────────────────────────────────

async function probeSSL(url: string): Promise<ProbeResult> {
  const { res, durationMs, error } = await timedFetch(url)
  if (error) {
    const isSsl = error.toLowerCase().includes("cert") || error.toLowerCase().includes("ssl") || error.toLowerCase().includes("tls")
    return {
      id: "ssl", label: "SSL / Reachability",
      status: "fail",
      detail: isSsl
        ? `SSL/TLS error — certificate issue detected. ${error}`
        : `Fetch failed: ${error}`,
      durationMs,
    }
  }
  if (!res) return { id: "ssl", label: "SSL / Reachability", status: "fail", detail: "No response", durationMs }

  if (res.status >= 200 && res.status < 400) {
    return {
      id: "ssl", label: "SSL / Reachability",
      status: "pass",
      detail: `HTTP ${res.status} — reachable in ${durationMs}ms. Final URL: ${res.url}`,
      durationMs,
    }
  }
  return {
    id: "ssl", label: "SSL / Reachability",
    status: "warn",
    detail: `HTTP ${res.status} — site responded but with an error status. ${durationMs}ms.`,
    durationMs,
  }
}

async function probeRobots(url: string): Promise<ProbeResult> {
  const robotsUrl = `${getOrigin(url)}/robots.txt`
  const { res, durationMs, error } = await timedFetch(robotsUrl)
  if (error || !res || res.status !== 200) {
    return { id: "robots", label: "robots.txt", status: "skip", detail: "No robots.txt found — no explicit scraping rules.", durationMs }
  }
  const text = await res.text().catch(() => "")
  const disallowsAll = /Disallow:\s*\/\s*$/.test(text)
  const crawlDelayMatch = text.match(/Crawl-delay:\s*(\d+)/)
  const crawlDelay = crawlDelayMatch ? Number(crawlDelayMatch[1]) : null

  if (disallowsAll) {
    return {
      id: "robots", label: "robots.txt",
      status: "warn",
      detail: `robots.txt found — Disallow: / detected for all agents. Proceed with caution.`,
      raw: excerpt(text, 200),
      durationMs,
    }
  }
  return {
    id: "robots", label: "robots.txt",
    status: "pass",
    detail: `robots.txt found.${crawlDelay ? ` Crawl-Delay: ${crawlDelay}s detected.` : " No global Disallow."}`,
    raw: excerpt(text, 200),
    durationMs,
  }
}

async function probeJSON(url: string): Promise<{ probe: ProbeResult; foundUrl: string | null }> {
  const origin = getOrigin(url)

  // 1. Try the URL itself with JSON Accept header
  const { res: directRes, durationMs: d0 } = await timedFetch(url, {
    headers: { ...FETCH_OPTS.headers as Record<string,string>, "Accept": "application/json" },
  })
  if (directRes?.ok) {
    const ct = directRes.headers.get("content-type") ?? ""
    if (ct.includes("json")) {
      const text = await directRes.text().catch(() => "")
      return {
        probe: { id: "json", label: "JSON API", status: "pass", detail: `URL itself returns JSON (Content-Type: ${ct}).`, raw: excerpt(text, 300), durationMs: d0 },
        foundUrl: url,
      }
    }
  }

  // 2. Try common JSON API paths
  for (const path of JSON_PATHS) {
    const testUrl = `${origin}${path}`
    const { res, durationMs } = await timedFetch(testUrl, {
      headers: { ...FETCH_OPTS.headers as Record<string,string>, "Accept": "application/json" },
    })
    if (res?.ok) {
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("json")) {
        const text = await res.text().catch(() => "")
        let isArray = false
        try { const parsed = JSON.parse(text); isArray = Array.isArray(parsed) } catch {}
        return {
          probe: {
            id: "json", label: "JSON API",
            status: "pass",
            detail: `JSON API found at ${path}${isArray ? " — returns array of items ✓" : ""}`,
            raw: excerpt(text, 300),
            durationMs,
          },
          foundUrl: testUrl,
        }
      }
    }
  }

  return {
    probe: { id: "json", label: "JSON API", status: "fail", detail: "No JSON API endpoints found at standard paths.", durationMs: d0 },
    foundUrl: null,
  }
}

async function probeRSS(url: string): Promise<{ probe: ProbeResult; foundUrl: string | null }> {
  const origin = getOrigin(url)

  // 1. Check page source for RSS link declaration
  const { res: pageRes } = await timedFetch(url)
  if (pageRes?.ok) {
    const html = await pageRes.text().catch(() => "")
    const rssMatch = html.match(/application\/(?:rss|atom)\+xml[^>]*href="([^"]+)"/i)
      || html.match(/href="([^"]+)"[^>]*type="application\/(?:rss|atom)\+xml"/i)
    if (rssMatch) {
      const rssHref = rssMatch[1].startsWith("http") ? rssMatch[1] : `${origin}${rssMatch[1]}`
      return {
        probe: {
          id: "rss", label: "RSS / Atom Feed",
          status: "pass",
          detail: `RSS feed declared in page HTML: ${rssHref}`,
          raw: rssHref,
        },
        foundUrl: rssHref,
      }
    }
  }

  // 2. Try common RSS paths
  for (const path of RSS_PATHS) {
    const testUrl = `${origin}${path}`
    const { res, durationMs } = await timedFetch(testUrl)
    if (res?.ok) {
      const text = await res.text().catch(() => "")
      if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
        return {
          probe: {
            id: "rss", label: "RSS / Atom Feed",
            status: "pass",
            detail: `RSS/Atom feed found at ${path}`,
            raw: excerpt(text, 200),
            durationMs,
          },
          foundUrl: testUrl,
        }
      }
    }
  }

  return {
    probe: { id: "rss", label: "RSS / Atom Feed", status: "fail", detail: "No RSS or Atom feed found at standard paths or declared in page HTML." },
    foundUrl: null,
  }
}

async function probeHTML(url: string): Promise<{ probe: ProbeResult; isSPA: boolean; isPdfOnly: boolean; bodyExcerpt: string }> {
  const { res, durationMs, error } = await timedFetch(url)

  if (error || !res) {
    return {
      probe: { id: "html", label: "HTML Content Check", status: "fail", detail: `Fetch failed: ${error}`, durationMs },
      isSPA: false, isPdfOnly: false, bodyExcerpt: "",
    }
  }

  const body = await res.text().catch(() => "")
  const bodyLower = body.toLowerCase()

  // SPA detection — empty root container patterns
  const isSPA = (
    (bodyLower.includes('<div id="root">') && !bodyLower.includes("recruitment") && !bodyLower.includes("vacancy")) ||
    bodyLower.includes("<app-root></app-root>") ||
    bodyLower.includes("<ng-component>") ||
    (bodyLower.includes("react") && body.match(/<div[^>]+id="root">\s*<\/div>/) !== null)
  )

  // PDF-only detection — count links and check what proportion are .pdf
  const allLinks = (body.match(/href="[^"]+"/gi) || []).length
  const pdfLinks = (body.match(/href="[^"]+\.pdf[^"]*"/gi) || []).length
  const isPdfOnly = pdfLinks > 0 && allLinks > 0 && pdfLinks / allLinks > 0.6

  // Content quality check — recruitment-related terms
  const keywords = ["recruit", "vacancy", "notification", "advertis", "examination", "apply", "post"]
  const hits = keywords.filter(k => bodyLower.includes(k))
  const hasContent = hits.length >= 2

  let status: ProbeStatus = "fail"
  let detail = ""

  if (isSPA) {
    status = "warn"
    detail = `SPA detected — page body is mostly empty. Content likely rendered by JavaScript. Playwright may be needed.`
  } else if (isPdfOnly) {
    status = "warn"
    detail = `PDF-heavy page — ${pdfLinks} of ${allLinks} links point to .pdf files (${Math.round(pdfLinks/allLinks*100)}%). Likely PDF-only source.`
  } else if (hasContent) {
    status = "pass"
    detail = `Server-rendered HTML confirmed — found keywords: ${hits.join(", ")}. ${body.length} chars returned in ${durationMs}ms.`
  } else {
    status = "warn"
    detail = `Page loaded (HTTP ${res.status}, ${body.length} chars) but no recruitment-related keywords found. May be wrong URL or JS-rendered.`
  }

  return {
    probe: { id: "html", label: "HTML Content Check", status, detail, raw: excerpt(body, 400), durationMs },
    isSPA,
    isPdfOnly,
    bodyExcerpt: excerpt(body, 400),
  }
}

async function probeAntiBotRisk(url: string): Promise<{ probe: ProbeResult; risk: string }> {
  // Make two requests in quick succession — check for rate limiting
  const [first, second] = await Promise.all([
    timedFetch(url),
    timedFetch(url),
  ])

  const signals: string[] = []
  let risk = "none"

  // Check response headers for known WAF/CDN markers
  if (first.res) {
    const headers = Object.fromEntries(first.res.headers.entries())
    const headerStr = JSON.stringify(headers).toLowerCase()

    if (headers["cf-ray"]) {
      signals.push("Cloudflare detected (cf-ray header)")
      risk = "low"
    }
    if (headers["x-akamai-request-id"] || headers["akamai-origin-hop"]) {
      signals.push("Akamai WAF detected")
      risk = "medium"
    }
    if (headers["x-cache"]?.includes("HIT") || headers["x-cdn"]) {
      signals.push("CDN caching detected")
    }
    if (headers["x-ratelimit-limit"]) {
      signals.push(`Rate limit header present: limit=${headers["x-ratelimit-limit"]}`)
      risk = "medium"
    }
    if (headerStr.includes("imperva") || headerStr.includes("incapsula")) {
      signals.push("Imperva/Incapsula WAF detected")
      risk = "high"
    }
  }

  // Second request got rate limited?
  if (second.res?.status === 429) {
    signals.push("429 Too Many Requests on second call — active rate limiting")
    risk = "high"
  } else if (second.res?.status === 403 && first.res?.status === 200) {
    signals.push("403 on second request — bot detection triggered")
    risk = "medium"
  }

  // Very fast response often means CDN/WAF cache
  if (first.durationMs < 50 && first.res?.status === 200) {
    signals.push("Sub-50ms response — CDN cache hit")
  }

  const status: ProbeStatus = risk === "high" ? "warn" : risk === "medium" ? "warn" : "pass"
  const detail = signals.length
    ? `Anti-bot signals: ${signals.join("; ")}. Assessed risk: ${risk.toUpperCase()}.`
    : `No WAF/CDN headers detected. Both requests returned ${first.res?.status ?? "error"}/${second.res?.status ?? "error"}. Risk: NONE.`

  return {
    probe: {
      id: "antibot", label: "Anti-Bot Risk Assessment",
      status,
      detail,
      raw: first.res ? `Headers: ${JSON.stringify(Object.fromEntries(first.res.headers.entries()), null, 2).slice(0, 300)}` : undefined,
      durationMs: first.durationMs + second.durationMs,
    },
    risk,
  }
}

async function probeCaptcha(url: string): Promise<ProbeResult> {
  const { res, durationMs } = await timedFetch(url)
  if (!res?.ok) {
    return { id: "captcha", label: "CAPTCHA Detection", status: "skip", detail: "Could not fetch page to check for CAPTCHA.", durationMs }
  }

  const body = await res.text().catch(() => "")
  const bodyLower = body.toLowerCase()
  const captchaSignals: string[] = []

  if (bodyLower.includes("recaptcha")) captchaSignals.push("reCAPTCHA script detected")
  if (bodyLower.includes("hcaptcha")) captchaSignals.push("hCaptcha script detected")
  if (bodyLower.includes("captcha")) captchaSignals.push("'captcha' text in page source")
  if (bodyLower.includes("cf-turnstile") || bodyLower.includes("turnstile")) captchaSignals.push("Cloudflare Turnstile detected")
  if (bodyLower.includes("challenge-form") || bodyLower.includes("cf_challenge")) captchaSignals.push("Cloudflare challenge page detected")

  if (captchaSignals.length) {
    return {
      id: "captcha", label: "CAPTCHA Detection",
      status: "warn",
      detail: `CAPTCHA signals found: ${captchaSignals.join("; ")}. Verify whether CAPTCHA appears on the listing page itself (not just login).`,
      durationMs,
    }
  }

  return {
    id: "captcha", label: "CAPTCHA Detection",
    status: "pass",
    detail: "No CAPTCHA scripts detected in page source.",
    durationMs,
  }
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function inspectSource(rawUrl: string): Promise<InspectSourceResult> {
  try { await requireAdminRole("sources") } catch { redirect("/dashboard") }

  if (!rawUrl?.trim()) {
    return { success: false, error: "Please provide a URL to inspect." }
  }

  const url = normalizeUrl(rawUrl)

  // Validate URL
  try { new URL(url) } catch {
    return { success: false, error: `Invalid URL: "${url}". Include https:// or the full domain.` }
  }

  try {
    // Run probes — SSL first (if it fails, most others will too)
    const sslResult   = await probeSSL(url)
    const robotsResult = await probeRobots(url)

    let jsonProbe: ProbeResult, jsonUrl: string | null = null
    let rssProbe: ProbeResult, rssUrl: string | null = null
    let htmlProbe: ProbeResult, isSPA = false, isPdfOnly = false
    let antiBotProbe: ProbeResult, antiBotRisk = "none"
    let captchaProbe: ProbeResult

    if (sslResult.status === "fail") {
      // SSL failed — skip content probes, mark all as skipped
      const skip = (id: string, label: string): ProbeResult => ({
        id, label, status: "skip", detail: "Skipped — SSL/reachability check failed."
      })
      jsonProbe    = skip("json",    "JSON API")
      rssProbe     = skip("rss",     "RSS / Atom Feed")
      htmlProbe    = skip("html",    "HTML Content Check")
      antiBotProbe = skip("antibot", "Anti-Bot Risk Assessment")
      captchaProbe = skip("captcha", "CAPTCHA Detection")
    } else {
      // Run all probes in parallel where safe
      const [jsonRes, rssRes, htmlRes, antiBotRes, captchaRes] = await Promise.all([
        probeJSON(url),
        probeRSS(url),
        probeHTML(url),
        probeAntiBotRisk(url),
        probeCaptcha(url),
      ]);

      ({ probe: jsonProbe, foundUrl: jsonUrl }       = jsonRes)
      ;({ probe: rssProbe, foundUrl: rssUrl }        = rssRes)
      ;({ probe: htmlProbe, isSPA, isPdfOnly }       = htmlRes)
      ;({ probe: antiBotProbe, risk: antiBotRisk }   = antiBotRes)
      captchaProbe = captchaRes
    }

    // ── Build suggested fields ────────────────────────────────────────────

    // Adapter type — priority: json > rss > html > pdf > playwright > manual
    let adapter_type = "html"
    if (jsonProbe.status === "pass")                         adapter_type = "json"
    else if (rssProbe.status === "pass")                     adapter_type = "rss"
    else if (isPdfOnly)                                      adapter_type = "pdf"
    else if (isSPA)                                          adapter_type = "playwright"
    else if (sslResult.status === "fail")                    adapter_type = "manual"

    const requires_playwright = isSPA
    const has_captcha         = captchaProbe.status === "warn"
    const pdf_only            = isPdfOnly
    const is_active           = sslResult.status !== "fail"

    // Trust score heuristic
    let trust_score = 0.70
    const isGovDomain = url.includes(".gov.in") || url.includes(".nic.in") || url.includes(".org.in")
    if (isGovDomain && is_active && !isSPA)          trust_score = 0.90
    else if (isGovDomain && is_active)                trust_score = 0.80
    else if (isGovDomain)                             trust_score = 0.65
    else if (is_active && adapter_type === "json")    trust_score = 0.85
    else if (is_active && adapter_type === "rss")     trust_score = 0.80
    else if (!is_active)                              trust_score = 0.40

    // Scrape interval heuristic (can be overridden by tier assignment)
    const scrape_interval_hours = adapter_type === "playwright" ? 24 :
      antiBotRisk === "high" ? 72 : antiBotRisk === "medium" ? 24 : 12

    const probes: ProbeResult[] = [
      sslResult, robotsResult, jsonProbe, rssProbe,
      htmlProbe, antiBotProbe, captchaProbe,
    ]

    // Summary sentence
    const summaryParts: string[] = []
    summaryParts.push(`Recommended adapter: ${adapter_type.toUpperCase()}`)
    if (rssUrl) summaryParts.push(`RSS URL found`)
    if (jsonUrl) summaryParts.push(`JSON API found`)
    if (requires_playwright) summaryParts.push(`Playwright required`)
    if (has_captcha) summaryParts.push(`CAPTCHA detected`)
    if (!is_active) summaryParts.push(`Site unreachable`)
    summaryParts.push(`Anti-bot risk: ${antiBotRisk}`)
    summaryParts.push(`Suggested trust: ${trust_score.toFixed(2)}`)

    return {
      success: true,
      data: {
        url,
        inspectedAt: new Date().toISOString(),
        probes,
        suggested: {
          adapter_type,
          requires_playwright,
          has_captcha,
          pdf_only,
          anti_bot_risk:         antiBotRisk,
          trust_score,
          rss_url:               rssUrl,
          api_url:               jsonUrl,
          is_active,
          scrape_interval_hours,
        },
        summary: summaryParts.join(" · "),
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error during inspection.",
    }
  }
}
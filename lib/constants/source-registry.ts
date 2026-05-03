/**
 * lib/constants/source-registry.ts
 * Career Copilot — Source Registry Constants
 *
 * SINGLE SOURCE OF TRUTH for all source_registry enum values.
 * Every value here is derived directly from the DB CHECK constraints
 * in Schema-09-04.txt and verified against types/supabase.ts.
 *
 * DO NOT duplicate these arrays in components. Import from here.
 *
 * HOW TO KEEP IN SYNC:
 *   When you run: supabase gen types typescript --project-id ...
 *   cross-check the CHECK constraints in the new schema against these arrays.
 *
 * FIELDS COVERED (with DB CHECK constraints):
 *
 *   category        CHECK (category = ANY (ARRAY[14 values]))
 *   source_type     CHECK (source_type = ANY (ARRAY[17 values]))
 *   adapter_type    CHECK (adapter_type = ANY (ARRAY[6 values]))
 *   anti_bot_risk   CHECK (anti_bot_risk = ANY (ARRAY[5 values]))
 *   jurisdiction    CHECK (jurisdiction = ANY (ARRAY['central','state','ut','autonomous']))
 *   tier            CHECK (tier >= 1 AND tier <= 4)
 *   trust_score     CHECK (trust_score >= 0 AND trust_score <= 1)
 *
 * MISSING FROM EARLIER CODE (now fixed):
 *   - requires_login: boolean column EXISTS in DB, was missing from SourceFormData + form UI
 *   - jurisdiction 'ut' was missing; 'local' was present but does NOT exist in DB
 */

import type { Database } from "@/types/supabase"

// ── Derive the Row type directly from generated types ─────────────────────────
// This is the RIGHT approach — never hand-type a DB row shape.
export type SourceRegistryRow = Database["public"]["Tables"]["source_registry"]["Row"]
export type SourceRegistryInsert = Database["public"]["Tables"]["source_registry"]["Insert"]
export type SourceRegistryUpdate = Database["public"]["Tables"]["source_registry"]["Update"]

// ── Category ──────────────────────────────────────────────────────────────────
// DB: CHECK (category = ANY (ARRAY[14 values]))

export const SOURCE_CATEGORIES = [
  { value: "central_govt",      label: "Central Govt" },
  { value: "banking",           label: "Banking" },
  { value: "regulatory",        label: "Regulatory" },
  { value: "insurance",         label: "Insurance" },
  { value: "psu",               label: "PSU" },
  { value: "state_psc",         label: "State PSC" },
  { value: "state_subordinate", label: "State Boards" },
  { value: "university",        label: "University" },
  { value: "cet",               label: "CET" },
  { value: "defence",           label: "Defence" },
  { value: "courts",            label: "Courts" },
  { value: "municipal",         label: "Municipal" },
  { value: "boards",            label: "Boards" },
  { value: "commissions",       label: "Commissions" },
] as const

export type SourceCategory = typeof SOURCE_CATEGORIES[number]["value"]
export const VALID_CATEGORIES = SOURCE_CATEGORIES.map(c => c.value) as string[]

// ── Source Type ───────────────────────────────────────────────────────────────
// DB: CHECK (source_type = ANY (ARRAY[17 values]))

export const SOURCE_TYPES = [
  { value: "official_central",    label: "Official Central" },
  { value: "official_state",      label: "Official State" },
  { value: "official_psu",        label: "Official PSU" },
  { value: "official_regulator",  label: "Official Regulator" },
  { value: "official_bank",       label: "Official Bank" },
  { value: "official_insurance",  label: "Official Insurance" },
  { value: "official_university", label: "Official University" },
  { value: "official_board",      label: "Official Board" },
  { value: "official_commission", label: "Official Commission" },
  { value: "official_court",      label: "Official Court" },
  { value: "official_defence",    label: "Official Defence" },
  { value: "official_municipal",  label: "Official Municipal" },
  { value: "official_cet",        label: "Official CET" },
  { value: "semi_official",       label: "Semi-Official" },
  { value: "aggregator",          label: "Aggregator" },
  { value: "rss_feed",            label: "RSS Feed" },
  { value: "manual",              label: "Manual" },
] as const

export type SourceType = typeof SOURCE_TYPES[number]["value"]
export const VALID_SOURCE_TYPES = SOURCE_TYPES.map(t => t.value) as string[]

// ── Adapter Type ──────────────────────────────────────────────────────────────
// DB: CHECK (adapter_type = ANY (ARRAY['html','rss','json','pdf','playwright','manual']))

export const ADAPTER_TYPES = [
  { value: "html",        label: "HTML",        desc: "Server-rendered HTML (default for .gov.in sites)" },
  { value: "rss",         label: "RSS",         desc: "RSS or Atom feed" },
  { value: "json",        label: "JSON",        desc: "Public JSON API endpoint" },
  { value: "pdf",         label: "PDF",         desc: "All notifications are PDF-only" },
  { value: "playwright",  label: "Playwright",  desc: "JS-rendered SPA, requires headless browser" },
  { value: "manual",      label: "Manual",      desc: "Cannot be auto-scraped (login/CAPTCHA/intranet)" },
] as const

export type AdapterType = typeof ADAPTER_TYPES[number]["value"]
export const VALID_ADAPTER_TYPES = ADAPTER_TYPES.map(a => a.value) as string[]

// ── Anti-Bot Risk ─────────────────────────────────────────────────────────────
// DB: CHECK (anti_bot_risk = ANY (ARRAY['none','low','medium','high','blocked']))

export const ANTI_BOT_RISKS = [
  { value: "none",    label: "None",    desc: "Open government portals, no protection" },
  { value: "low",     label: "Low",     desc: "Basic rate limits, Cloudflare free tier" },
  { value: "medium",  label: "Medium",  desc: "Cloudflare Pro/Biz, Akamai detected" },
  { value: "high",    label: "High",    desc: "Aggressive blocking, backoff required" },
  { value: "blocked", label: "Blocked", desc: "Cannot scrape — CAPTCHA or IP blocked" },
] as const

export type AntiBotRisk = typeof ANTI_BOT_RISKS[number]["value"]
export const VALID_ANTI_BOT_RISKS = ANTI_BOT_RISKS.map(r => r.value) as string[]

// ── Jurisdiction ──────────────────────────────────────────────────────────────
// DB: CHECK (jurisdiction = ANY (ARRAY['central','state','ut','autonomous']))
// FIX: Previous code had 'local' (WRONG — not in DB) and was missing 'ut'

export const JURISDICTIONS = [
  { value: "central",    label: "Central" },
  { value: "state",      label: "State" },
  { value: "ut",         label: "Union Territory" },   // ← was MISSING in old code
  { value: "autonomous", label: "Autonomous" },
  // NOTE: 'local' has been REMOVED — it does not exist in the DB CHECK constraint
] as const

export type Jurisdiction = typeof JURISDICTIONS[number]["value"]
export const VALID_JURISDICTIONS = JURISDICTIONS.map(j => j.value) as string[]

// ── Tier ──────────────────────────────────────────────────────────────────────
// DB: CHECK (tier >= 1 AND tier <= 4)

export const TIERS = [
  { value: 1, label: "T1 — Critical",   desc: "UPSC, SSC, IBPS, RBI, SEBI, SBI — top 30% user targets",    interval: "4–6h" },
  { value: 2, label: "T2 — Important",  desc: "State PSC, NABARD, LIC, NIACL — major state/banking",        interval: "12–24h" },
  { value: 3, label: "T3 — Secondary",  desc: "PSUs, courts, state CETs, defence boards",                   interval: "48–72h" },
  { value: 4, label: "T4 — Aggregator", desc: "Aggregator portals — discovery only, not primary source",    interval: "6–12h" },
] as const

export type Tier = typeof TIERS[number]["value"]
export const VALID_TIERS = TIERS.map(t => t.value) as number[]

// ── Tier display helpers ──────────────────────────────────────────────────────

export const TIER_LABELS: Record<number, string> = Object.fromEntries(
  TIERS.map(t => [t.value, t.label])
)

export const TIER_COLORS: Record<number, string> = {
  1: "#C9992A",
  2: "rgba(255,255,255,0.65)",
  3: "rgba(255,255,255,0.40)",
  4: "rgba(255,255,255,0.25)",
}

export const CAT_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_CATEGORIES.map(c => [c.value, c.label])
)

// ── Indian States & UTs ───────────────────────────────────────────────────────
// Used when jurisdiction = 'state' or 'ut'

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const

export const UNION_TERRITORIES = [
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry", "Chandigarh",
  "Andaman & Nicobar Islands", "Dadra & Nagar Haveli and Daman & Diu",
  "Lakshadweep",
] as const

export const ALL_STATES_AND_UTS = [...INDIAN_STATES, ...UNION_TERRITORIES]

// ── Scrape Interval Options ───────────────────────────────────────────────────
// Recommended intervals by tier (from Field Detection Guide)

export const SCRAPE_INTERVALS = [
  { value: 4,   label: "Every 4 hours   (T1 standard)" },
  { value: 6,   label: "Every 6 hours   (T1 high-risk)" },
  { value: 12,  label: "Every 12 hours  (T2 fast)" },
  { value: 24,  label: "Daily           (T2 standard)" },
  { value: 48,  label: "Every 2 days    (T3 standard)" },
  { value: 72,  label: "Every 3 days    (T3 high-risk)" },
  { value: 168, label: "Weekly          (T4 / manual)" },
] as const

// ── Default form values ───────────────────────────────────────────────────────
// Matches DB column defaults exactly

export const SOURCE_FORM_DEFAULTS = {
  source_name:           "",
  short_code:            "",
  source_type:           "official_central" as SourceType,
  category:              "central_govt"     as SourceCategory,
  jurisdiction:          "central"          as Jurisdiction,
  state:                 "",
  parent_org:            "",                // DB column: parent organisation name (optional)
  official_url:          "",
  notification_url:      "",
  rss_url:               "",
  api_url:               "",
  pdf_bulletin_url:      "",
  adapter_type:          "html"             as AdapterType,
  scrape_interval_hours: 24,
  tier:                  2,
  trust_score:           0.70,
  anti_bot_risk:         "low"              as AntiBotRisk,
  requires_playwright:   false,
  requires_login:        false,
  has_captcha:           false,
  pdf_only:              false,
  is_active:             true,
  is_verified:           false,
  notes:                 "",
} as const
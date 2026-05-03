/**
 * lib/db/source-registry.ts
 * Career Copilot — Source Registry Data Layer
 *
 * THE SINGLE FILE THAT TOUCHES source_registry IN THE DATABASE.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Previously, source_registry queries were scattered across:
 *   - actions/sources.ts         (CRUD)
 *   - lib/db/notifications.ts    (getSourceRegistry, upsertSourceRegistry, etc.)
 *   - app/admin/sources/page.tsx (getSources inline)
 *   - app/admin/scrape/page.tsx  (via getSourceRegistry)
 *
 * When the DB schema changes you regenerate types/supabase.ts. If queries are
 * scattered, you have to hunt down every reference manually. Many will fail
 * silently at runtime because Supabase query strings are not type-checked.
 *
 * ─── The contract ─────────────────────────────────────────────────────────────
 *
 * 1. ALL source_registry SELECT / INSERT / UPDATE / DELETE goes through here.
 * 2. Every function uses strongly-typed Supabase generics so TypeScript
 *    catches mismatches at compile time, not at runtime.
 * 3. The SELECT column list is defined ONCE as SOURCE_REGISTRY_COLUMNS.
 *    Add/remove a column here → TypeScript immediately shows every place
 *    that uses the returned type so you can update them.
 * 4. Enum validation uses VALID_* arrays from lib/constants/source-registry.ts
 *    which are themselves derived from the DB CHECK constraints.
 *
 * ─── What to do when the schema changes ──────────────────────────────────────
 *
 * 1. Run:  supabase gen types typescript --project-id <id> > types/supabase.ts
 * 2. Fix compile errors in THIS FILE FIRST (the data layer).
 * 3. Fix compile errors that propagate to actions/sources.ts and components.
 * 4. Update lib/constants/source-registry.ts if any CHECK constraints changed.
 *
 * This way you fix schema changes in one central place and TypeScript guides
 * you through every downstream impact.
 */

import { createClient }   from "@/utils/supabase/server"
import type { Database }  from "@/types/supabase"
import {
  VALID_CATEGORIES,
  VALID_ADAPTER_TYPES,
  VALID_ANTI_BOT_RISKS,
  VALID_TIERS,
  VALID_JURISDICTIONS,
  VALID_SOURCE_TYPES,
} from "@/lib/constants/source-registry"

// ─── Generated types (never hand-write these) ─────────────────────────────────

type SR     = Database["public"]["Tables"]["source_registry"]
type SRRow    = SR["Row"]
type SRInsert = SR["Insert"]
type SRUpdate = SR["Update"]

// ─── Column selection ─────────────────────────────────────────────────────────
//
// This is the ONLY place that defines which columns are fetched.
// It drives the SourceRegistryEntry type below via inference.
//
// When you add a column to the DB and regenerate types/supabase.ts,
// TypeScript will error here if the column name doesn't exist on SRRow,
// guiding you to update this list.

const SOURCE_REGISTRY_COLUMNS = `
  id, source_name, short_code, source_type, category,
  jurisdiction, state, parent_org, official_url, notification_url,
  rss_url, api_url, pdf_bulletin_url, adapter_type, parser_config,
  scrape_interval_hours, tier, trust_score, anti_bot_risk,
  requires_playwright, requires_login, has_captcha, pdf_only,
  is_active, is_verified, consecutive_fails, added_by,
  last_scraped_at, last_success_at, last_changed_at, last_error,
  notes, created_at, updated_at
` as const

// ─── Public type ──────────────────────────────────────────────────────────────
//
// Components and actions import THIS type — not Database["public"]["Tables"][...].
// Keeps the rest of the codebase one step removed from Supabase internals.

export type SourceRegistryEntry = Pick<SRRow,
  | "id" | "source_name" | "short_code" | "source_type" | "category"
  | "jurisdiction" | "state" | "parent_org" | "official_url" | "notification_url"
  | "rss_url" | "api_url" | "pdf_bulletin_url" | "adapter_type" | "parser_config"
  | "scrape_interval_hours" | "tier" | "trust_score" | "anti_bot_risk"
  | "requires_playwright" | "requires_login" | "has_captcha" | "pdf_only"
  | "is_active" | "is_verified" | "consecutive_fails" | "added_by"
  | "last_scraped_at" | "last_success_at" | "last_changed_at" | "last_error"
  | "notes" | "created_at" | "updated_at"
>

// ─── Input type for create/update ─────────────────────────────────────────────
//
// This is what SourceFormData in actions/sources.ts maps to.
// It uses SRInsert directly so TypeScript knows the exact allowed column names.

export type SourceWriteInput = Omit<SRInsert,
  | "id" | "created_at" | "updated_at" | "consecutive_fails"
  | "last_scraped_at" | "last_success_at" | "last_changed_at"
  | "last_error" | "added_by" | "parser_config"
>

// ─── Validation helpers ───────────────────────────────────────────────────────

export class SourceValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
    this.name = "SourceValidationError"
  }
}

export function validateSourceInput(data: Partial<SourceWriteInput>): void {
  if (data.source_name !== undefined && !data.source_name.trim())
    throw new SourceValidationError("source_name", "Source name is required")
  if (data.official_url !== undefined && !data.official_url.trim())
    throw new SourceValidationError("official_url", "Official URL is required")
  if (data.category !== undefined && !VALID_CATEGORIES.includes(data.category))
    throw new SourceValidationError("category", `Invalid category: ${data.category}`)
  if (data.adapter_type !== undefined && !VALID_ADAPTER_TYPES.includes(data.adapter_type))
    throw new SourceValidationError("adapter_type", `Invalid adapter_type: ${data.adapter_type}`)
  if (data.anti_bot_risk !== undefined && !VALID_ANTI_BOT_RISKS.includes(data.anti_bot_risk))
    throw new SourceValidationError("anti_bot_risk", `Invalid anti_bot_risk: ${data.anti_bot_risk}`)
  if (data.jurisdiction !== undefined && data.jurisdiction !== null && !VALID_JURISDICTIONS.includes(data.jurisdiction))
    throw new SourceValidationError("jurisdiction", `Invalid jurisdiction: ${data.jurisdiction}`)
  if (data.source_type !== undefined && !VALID_SOURCE_TYPES.includes(data.source_type))
    throw new SourceValidationError("source_type", `Invalid source_type: ${data.source_type}`)
  if (data.tier !== undefined && !VALID_TIERS.includes(data.tier as number))
    throw new SourceValidationError("tier", `Invalid tier: ${data.tier}`)
  if (data.trust_score !== undefined && (data.trust_score < 0 || data.trust_score > 1))
    throw new SourceValidationError("trust_score", `trust_score must be between 0 and 1`)
}

function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  const withProto = t.startsWith("http") ? t : `https://${t}`
  try {
    const u = new URL(withProto)
    return (u.protocol === "http:" || u.protocol === "https:") ? withProto : null
  } catch { return null }
}

// ─── READ ──────────────────────────────────────────────────────────────────────

/** Fetch all sources for the admin registry list, ordered by tier then name. */
export async function dbGetAllSources(): Promise<SourceRegistryEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("source_registry")
    .select(SOURCE_REGISTRY_COLUMNS)
    .order("tier",        { ascending: true })
    .order("source_name", { ascending: true })

  if (error) throw new Error(`dbGetAllSources: ${error.message}`)
  return (data ?? []) as SourceRegistryEntry[]
}

/** Fetch only active sources for the scraper dashboard. */
export async function dbGetActiveSources(): Promise<SourceRegistryEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("source_registry")
    .select(SOURCE_REGISTRY_COLUMNS)
    .eq("is_active", true)
    .order("tier",        { ascending: true })
    .order("source_name", { ascending: true })

  if (error) throw new Error(`dbGetActiveSources: ${error.message}`)
  return (data ?? []) as SourceRegistryEntry[]
}

/** Fetch a single source by ID. Returns null if not found. */
export async function dbGetSourceById(id: string): Promise<SourceRegistryEntry | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("source_registry")
    .select(SOURCE_REGISTRY_COLUMNS)
    .eq("id", id)
    .single()

  if (error?.code === "PGRST116") return null // not found
  if (error) throw new Error(`dbGetSourceById: ${error.message}`)
  return data as SourceRegistryEntry | null
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

/** Insert a new source. Returns the created row's id. */
export async function dbCreateSource(
  data: SourceWriteInput
): Promise<string> {
  validateSourceInput(data)
  const supabase = await createClient()

  const payload: SRInsert = {
    source_name:           data.source_name!.trim(),
    short_code:            data.short_code?.trim()    || null,
    source_type:           data.source_type           ?? "official_central",
    category:              data.category!,
    jurisdiction:          data.jurisdiction          ?? "central",
    state:                 data.state?.trim()         || null,
    parent_org:            data.parent_org?.trim()    || null,
    official_url:          sanitizeUrl(data.official_url)!,
    notification_url:      sanitizeUrl(data.notification_url),
    rss_url:               sanitizeUrl(data.rss_url),
    api_url:               sanitizeUrl(data.api_url),
    pdf_bulletin_url:      sanitizeUrl(data.pdf_bulletin_url),
    adapter_type:          data.adapter_type          ?? "html",
    parser_config:         {},
    scrape_interval_hours: data.scrape_interval_hours ?? 24,
    tier:                  data.tier                  ?? 2,
    trust_score:           Math.min(1, Math.max(0, data.trust_score ?? 0.70)),
    anti_bot_risk:         data.anti_bot_risk         ?? "low",
    requires_playwright:   data.requires_playwright   ?? false,
    requires_login:        data.requires_login        ?? false,
    has_captcha:           data.has_captcha            ?? false,
    pdf_only:              data.pdf_only               ?? false,
    is_active:             data.is_active              ?? true,
    is_verified:           data.is_verified            ?? false,
    notes:                 data.notes?.trim()          || null,
    consecutive_fails:     0,
    added_by:              "admin",
  }

  if (!payload.official_url)
    throw new SourceValidationError("official_url", "Invalid official URL")

  const { data: created, error } = await supabase
    .from("source_registry")
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505")
      throw new SourceValidationError("official_url", "A source with this URL already exists")
    throw new Error(`dbCreateSource: ${error.message}`)
  }

  return created!.id
}

/** Update an existing source. Only updates provided fields. */
export async function dbUpdateSource(
  id: string,
  data: Partial<SourceWriteInput>
): Promise<void> {
  validateSourceInput(data)
  const supabase = await createClient()

  // Build payload from only the fields that are actually provided
  // (undefined = don't touch; null = explicitly clear)
  const payload: SRUpdate = { updated_at: new Date().toISOString() }

  if (data.source_name  !== undefined) payload.source_name           = data.source_name.trim()
  if (data.short_code   !== undefined) payload.short_code            = data.short_code?.trim()  || null
  if (data.source_type  !== undefined) payload.source_type           = data.source_type
  if (data.category     !== undefined) payload.category              = data.category
  if (data.jurisdiction !== undefined) payload.jurisdiction          = data.jurisdiction
  if (data.state        !== undefined) payload.state                 = data.state?.trim()       || null
  if (data.parent_org   !== undefined) payload.parent_org            = data.parent_org?.trim()  || null
  if (data.notes        !== undefined) payload.notes                 = data.notes?.trim()       || null
  if (data.adapter_type !== undefined) payload.adapter_type          = data.adapter_type
  if (data.scrape_interval_hours !== undefined) payload.scrape_interval_hours = data.scrape_interval_hours
  if (data.tier              !== undefined) payload.tier             = data.tier
  if (data.trust_score       !== undefined) payload.trust_score      = Math.min(1, Math.max(0, data.trust_score))
  if (data.anti_bot_risk     !== undefined) payload.anti_bot_risk    = data.anti_bot_risk
  if (data.requires_playwright !== undefined) payload.requires_playwright = data.requires_playwright
  if (data.requires_login    !== undefined) payload.requires_login   = data.requires_login
  if (data.has_captcha       !== undefined) payload.has_captcha      = data.has_captcha
  if (data.pdf_only          !== undefined) payload.pdf_only         = data.pdf_only
  if (data.is_active         !== undefined) payload.is_active        = data.is_active
  if (data.is_verified       !== undefined) payload.is_verified      = data.is_verified

  if (data.official_url     !== undefined) payload.official_url     = sanitizeUrl(data.official_url)     ?? undefined
  if (data.notification_url !== undefined) payload.notification_url = sanitizeUrl(data.notification_url)
  if (data.rss_url          !== undefined) payload.rss_url          = sanitizeUrl(data.rss_url)
  if (data.api_url          !== undefined) payload.api_url          = sanitizeUrl(data.api_url)
  if (data.pdf_bulletin_url !== undefined) payload.pdf_bulletin_url = sanitizeUrl(data.pdf_bulletin_url)

  const { error } = await supabase
    .from("source_registry")
    .update(payload)
    .eq("id", id)

  if (error) throw new Error(`dbUpdateSource: ${error.message}`)
}

/** Delete a source and clean up all related cache tables. */
export async function dbDeleteSource(id: string): Promise<void> {
  const supabase = await createClient()

  // Clean related tables in parallel before deleting the source
  await Promise.all([
    supabase.from("scrape_source_etags").delete().eq("source_id", id),
    supabase.from("scrape_pdf_cache").delete().eq("source_id", id),
    supabase.from("source_health_metrics").delete().eq("source_registry_id", id),
  ])

  const { error } = await supabase
    .from("source_registry")
    .delete()
    .eq("id", id)

  if (error) throw new Error(`dbDeleteSource: ${error.message}`)
}

/** Bulk delete sources and their cache entries. */
export async function dbBulkDeleteSources(ids: string[]): Promise<void> {
  if (!ids.length) return
  const supabase = await createClient()

  await Promise.all([
    supabase.from("scrape_source_etags").delete().in("source_id", ids),
    supabase.from("scrape_pdf_cache").delete().in("source_id", ids),
    supabase.from("source_health_metrics").delete().in("source_registry_id", ids),
  ])

  const { error } = await supabase
    .from("source_registry")
    .delete()
    .in("id", ids)

  if (error) throw new Error(`dbBulkDeleteSources: ${error.message}`)
}

/** Toggle is_active on a single source. */
export async function dbToggleSourceActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("source_registry")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(`dbToggleSourceActive: ${error.message}`)
}

/** Bulk toggle is_active on multiple sources. */
export async function dbBulkToggleSources(ids: string[], active: boolean): Promise<void> {
  if (!ids.length) return
  const supabase = await createClient()
  const { error } = await supabase
    .from("source_registry")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .in("id", ids)
  if (error) throw new Error(`dbBulkToggleSources: ${error.message}`)
}

/** Mark is_verified on a source.
 *  When verifying: also clears consecutive_fails + last_error.
 *  When unverifying: only sets is_verified = false (preserves health data).
 */
export async function dbMarkSourceVerified(id: string, verified: boolean): Promise<void> {
  const supabase = await createClient()
  const payload: SRUpdate = verified
    ? { is_verified: true,  consecutive_fails: 0, last_error: null, updated_at: new Date().toISOString() }
    : { is_verified: false,                                          updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from("source_registry")
    .update(payload)
    .eq("id", id)
  if (error) throw new Error(`dbMarkSourceVerified: ${error.message}`)
}

/** Reset consecutive_fails to 0 and re-enable a source. */
export async function dbResetSourceFails(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("source_registry")
    .update({
      consecutive_fails: 0,
      last_error:        null,
      is_active:         true,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw new Error(`dbResetSourceFails: ${error.message}`)
}
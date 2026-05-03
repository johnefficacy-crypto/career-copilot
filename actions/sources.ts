"use server"

/**
 * actions/sources.ts
 * Career Copilot — Source Registry Server Actions
 *
 * ARCHITECTURE:
 *  These are thin orchestrators. All DB logic lives in lib/db/source-registry.ts.
 *  This file only handles:
 *   1. Authentication / admin guard
 *   2. Input validation plumbing (UUID format)
 *   3. Cache revalidation
 *   4. Translating errors into SourceActionResult
 *
 * When the DB schema changes:
 *   → Update lib/db/source-registry.ts (data layer)
 *   → Update lib/constants/source-registry.ts (enum values)
 *   → TypeScript errors here guide you to update SourceFormData if needed
 *   → Components update automatically via Pick<SourceRegistryEntry>
 */

import { revalidatePath }   from "next/cache"
import { requireAdminRole } from "@/lib/db/admin"
import {
  dbCreateSource,
  dbUpdateSource,
  dbDeleteSource,
  dbBulkDeleteSources,
  dbToggleSourceActive,
  dbBulkToggleSources,
  dbMarkSourceVerified,
  dbResetSourceFails,
  SourceValidationError,
  type SourceWriteInput,
} from "@/lib/db/source-registry"

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * SourceFormData — what the form component sends to actions.
 *
 * This maps 1:1 to SourceWriteInput from the data layer, but uses plain
 * string/number/boolean so form state can use it without Supabase imports.
 * TypeScript will error if you add a field here that doesn't exist in
 * the DB insert type, keeping this in sync automatically.
 */
export type SourceFormData = {
  id?:                   string
  source_name:           string
  short_code:            string
  source_type:           string
  category:              string
  jurisdiction:          string
  state:                 string
  parent_org:            string
  official_url:          string
  notification_url:      string
  rss_url:               string
  api_url:               string
  pdf_bulletin_url:      string
  adapter_type:          string
  scrape_interval_hours: number
  tier:                  number
  trust_score:           number
  anti_bot_risk:         string
  requires_playwright:   boolean
  requires_login:        boolean
  has_captcha:           boolean
  pdf_only:              boolean
  is_active:             boolean
  is_verified:           boolean
  notes:                 string
}

export type SourceActionResult = {
  success: boolean
  error?:  string
  id?:     string
}

// ─── Input mapping ────────────────────────────────────────────────────────────

function formToWriteInput(data: Partial<SourceFormData>): Partial<SourceWriteInput> {
  // Maps the form shape to the DB write shape.
  // Empty strings become null for nullable columns.
  return {
    source_name:           data.source_name?.trim()          || undefined,
    short_code:            data.short_code?.trim()           || null,
    source_type:           data.source_type                  || undefined,
    category:              data.category                     || undefined,
    jurisdiction:          data.jurisdiction                 || undefined,
    state:                 data.state?.trim()                || null,
    parent_org:            data.parent_org?.trim()           || null,
    official_url:          data.official_url?.trim()         || undefined,
    notification_url:      data.notification_url?.trim()     || null,
    rss_url:               data.rss_url?.trim()              || null,
    api_url:               data.api_url?.trim()              || null,
    pdf_bulletin_url:      data.pdf_bulletin_url?.trim()     || null,
    adapter_type:          data.adapter_type                 || undefined,
    scrape_interval_hours: data.scrape_interval_hours        || undefined,
    tier:                  data.tier                         || undefined,
    trust_score:           data.trust_score                  ?? undefined,
    anti_bot_risk:         data.anti_bot_risk                || undefined,
    requires_playwright:   data.requires_playwright          ?? undefined,
    requires_login:        data.requires_login               ?? undefined,
    has_captcha:           data.has_captcha                  ?? undefined,
    pdf_only:              data.pdf_only                     ?? undefined,
    is_active:             data.is_active                    ?? undefined,
    is_verified:           data.is_verified                  ?? undefined,
    notes:                 data.notes?.trim()                || null,
  }
}

// ─── UUID guard ───────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateId(id: string): SourceActionResult | null {
  if (!id?.trim())      return { success: false, error: "ID is required" }
  if (!UUID_RE.test(id)) return { success: false, error: "Invalid ID format" }
  return null
}

// ─── Error translation ────────────────────────────────────────────────────────

function handleError(err: unknown): SourceActionResult {
  if (err instanceof SourceValidationError)
    return { success: false, error: err.message }
  return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
}

// ─── CRUD actions ─────────────────────────────────────────────────────────────

export async function createSource(
  data: Omit<SourceFormData, "id">
): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  try {
    const id = await dbCreateSource(formToWriteInput(data) as SourceWriteInput)
    revalidatePath("/admin/sources")
    revalidatePath("/admin/scrape")
    return { success: true, id }
  } catch (err) {
    return handleError(err)
  }
}

export async function updateSource(
  id: string,
  data: Partial<SourceFormData>
): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  const idErr = validateId(id)
  if (idErr) return idErr
  try {
    await dbUpdateSource(id, formToWriteInput(data))
    revalidatePath("/admin/sources")
    revalidatePath("/admin/scrape")
    return { success: true, id }
  } catch (err) {
    return handleError(err)
  }
}

export async function deleteSource(id: string): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  const idErr = validateId(id)
  if (idErr) return idErr
  try {
    await dbDeleteSource(id)
    revalidatePath("/admin/sources")
    revalidatePath("/admin/scrape")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function toggleSourceActive(
  id: string,
  active: boolean
): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  const idErr = validateId(id)
  if (idErr) return idErr
  try {
    await dbToggleSourceActive(id, active)
    revalidatePath("/admin/sources")
    revalidatePath("/admin/scrape")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function markSourceVerified(
  id: string,
  verified: boolean
): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  const idErr = validateId(id)
  if (idErr) return idErr
  try {
    await dbMarkSourceVerified(id, verified)
    revalidatePath("/admin/sources")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function resetSourceFails(id: string): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  const idErr = validateId(id)
  if (idErr) return idErr
  try {
    await dbResetSourceFails(id)
    revalidatePath("/admin/sources")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function bulkToggleSources(
  ids: string[],
  active: boolean
): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  if (!ids.length) return { success: false, error: "No IDs provided" }
  if (ids.some(id => !UUID_RE.test(id))) return { success: false, error: "Invalid ID in batch" }
  try {
    await dbBulkToggleSources(ids, active)
    revalidatePath("/admin/sources")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function bulkDeleteSources(ids: string[]): Promise<SourceActionResult> {
  await requireAdminRole("sources")
  if (!ids.length) return { success: false, error: "No IDs provided" }
  if (ids.some(id => !UUID_RE.test(id))) return { success: false, error: "Invalid ID in batch" }
  try {
    await dbBulkDeleteSources(ids)
    revalidatePath("/admin/sources")
    return { success: true }
  } catch (err) {
    return handleError(err)
  }
}
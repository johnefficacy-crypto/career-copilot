/**
 * app/admin/sources/page.tsx
 * Career Copilot — Source Registry Management Page
 *
 * CHANGE: Inspector is now a side panel (SourceInspectorPanel) embedded here,
 * not a separate /admin/sources/inspect page. The panel is triggered by a
 * button in the SourceRegistryManager header.
 */

import { redirect }         from "next/navigation"
import { createClient }     from "@/utils/supabase/server"
import { requireAdminRole } from "@/lib/db/admin"
import { dbGetAllSources }  from "@/lib/db/source-registry"
import { SourceRegistryManager } from "@/components/admin/SourceRegistryManager"
import type { PrefillData }  from "@/components/admin/SourceRegistryManager"

export const dynamic  = "force-dynamic"
export const metadata = { title: "Source Registry — Admin" }

const VALID_ADAPTERS = ["html", "rss", "json", "pdf", "playwright", "manual"]
const VALID_RISKS    = ["none", "low", "medium", "high", "blocked"]

function parsePrefill(params: Record<string, string | undefined>): PrefillData | undefined {
  if (!params.prefill_url) return undefined
  const raw: PrefillData = {}
  if (params.prefill_url)                                         raw.official_url          = params.prefill_url.trim()
  if (params.prefill_rss?.trim())                                 raw.rss_url               = params.prefill_rss.trim()
  if (params.prefill_api?.trim())                                 raw.api_url               = params.prefill_api.trim()
  if (VALID_ADAPTERS.includes(params.prefill_adapter ?? ""))      raw.adapter_type          = params.prefill_adapter
  if (VALID_RISKS.includes(params.prefill_risk ?? ""))            raw.anti_bot_risk         = params.prefill_risk
  if (params.prefill_trust)    raw.trust_score           = Math.min(1, Math.max(0, parseFloat(params.prefill_trust)))
  if (params.prefill_interval) raw.scrape_interval_hours = Math.max(1, parseInt(params.prefill_interval, 10))
  if (params.prefill_playwright !== undefined) raw.requires_playwright  = params.prefill_playwright === "true"
  if (params.prefill_captcha    !== undefined) raw.has_captcha          = params.prefill_captcha    === "true"
  if (params.prefill_pdfonly    !== undefined) raw.pdf_only             = params.prefill_pdfonly    === "true"
  if (params.prefill_active     !== undefined) raw.is_active            = params.prefill_active     !== "false"
  return Object.keys(raw).length ? raw : undefined
}

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; cat?: string; tier?: string; status?: string
    prefill_url?: string; prefill_adapter?: string; prefill_rss?: string
    prefill_api?: string; prefill_risk?: string; prefill_trust?: string
    prefill_playwright?: string; prefill_captcha?: string
    prefill_pdfonly?: string; prefill_interval?: string; prefill_active?: string
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  try { await requireAdminRole("sources") } catch { redirect("/dashboard") }

  const params  = await searchParams
  const sources = await dbGetAllSources().catch(() => [])
  const prefill = parsePrefill(params)

  return (
    <SourceRegistryManager
      sources={sources}
      initialSearch={params.q ?? ""}
      initialCategory={params.cat ?? "all"}
      initialTier={params.tier ?? "all"}
      initialStatus={params.status ?? "all"}
      prefill={prefill}
    />
  )
}
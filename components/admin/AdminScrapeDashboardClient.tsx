"use client"

/**
 * components/admin/AdminScrapeDashboardClient.tsx
 *
 * Thin client wrapper around AdminScrapeDashboard.
 * Purpose: next/dynamic with ssr:false is only allowed inside Client Components.
 * The page (app/admin/scrape/page.tsx) is a Server Component, so the dynamic
 * import lives here instead.
 *
 * AdminScrapeDashboard.tsx is unchanged — do NOT delete it.
 */

import dynamic from "next/dynamic"
import type { ScrapeRun, ScraperStats, QueueReviewItem, SourceHealthSnapshot } from "@/types/notifications"
import type { SourceRegistryEntry } from "@/lib/db/source-registry"
import type { PaginatedResult } from "@/lib/db/notifications"

const AdminScrapeDashboard = dynamic(
  () => import("@/components/admin/AdminScrapeDashboard").then(m => m.AdminScrapeDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading scrape dashboard…</p>
      </div>
    ),
  }
)

interface Props {
  stats:          ScraperStats
  pendingQueue:   PaginatedResult<QueueReviewItem>
  runsPage:       PaginatedResult<ScrapeRun>
  sourceHealth:   SourceHealthSnapshot[]
  sourceRegistry: SourceRegistryEntry[]
  errorMessage?:  string
  activeTab:      string
}

export function AdminScrapeDashboardClient(props: Props) {
  return <AdminScrapeDashboard {...props} />
}